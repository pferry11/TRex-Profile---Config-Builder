/* TRex Profile & Config Builder - minimal ZIP writer for bundle export.
 * Store method only (no compression - generated text files are small), CRC-32,
 * classic ZIP structure: local headers + central directory + EOCD.
 * Pure and environment-agnostic so the test suite can verify the byte layout.
 * TB.zip.build(files, opts) -> Uint8Array
 *   files: [{ name, content }]  content: string (UTF-8 encoded on write)
 *   opts.date: Date used for all entries (defaults to now; fix it for tests) */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  var CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) { return CRC_TABLE; }
    CRC_TABLE = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
      CRC_TABLE[n] = c >>> 0;
    }
    return CRC_TABLE;
  }

  function crc32(bytes) {
    var t = crcTable();
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) { c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') { return new TextEncoder().encode(str); }
    var s = unescape(encodeURIComponent(str));
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) { b[i] = s.charCodeAt(i); }
    return b;
  }

  /* MS-DOS packed date/time (2-second resolution, epoch 1980) */
  function dosDateTime(d) {
    var year = Math.max(1980, d.getFullYear());
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  function build(files, opts) {
    opts = opts || {};
    var dt = dosDateTime(opts.date || new Date());
    var entries = files.map(function (f) {
      var nameB = utf8(f.name);
      var dataB = utf8(f.content);
      return { nameB: nameB, dataB: dataB, crc: crc32(dataB), offset: 0 };
    });

    var localSize = 0, centralSize = 0;
    entries.forEach(function (e) {
      localSize += 30 + e.nameB.length + e.dataB.length;
      centralSize += 46 + e.nameB.length;
    });
    var out = new Uint8Array(localSize + centralSize + 22);
    var pos = 0;

    function u16(v) { out[pos++] = v & 0xFF; out[pos++] = (v >>> 8) & 0xFF; }
    function u32(v) { u16(v & 0xFFFF); u16((v >>> 16) & 0xFFFF); }
    function put(bytes) { out.set(bytes, pos); pos += bytes.length; }

    /* local file headers + data */
    entries.forEach(function (e) {
      e.offset = pos;
      u32(0x04034B50);            // local header signature
      u16(20); u16(0); u16(0);    // version 2.0, no flags, method 0 (store)
      u16(dt.time); u16(dt.date);
      u32(e.crc); u32(e.dataB.length); u32(e.dataB.length);
      u16(e.nameB.length); u16(0);
      put(e.nameB); put(e.dataB);
    });

    /* central directory */
    var cdStart = pos;
    entries.forEach(function (e) {
      u32(0x02014B50);            // central header signature
      u16(20); u16(20); u16(0); u16(0);
      u16(dt.time); u16(dt.date);
      u32(e.crc); u32(e.dataB.length); u32(e.dataB.length);
      u16(e.nameB.length); u16(0); u16(0);
      u16(0); u16(0); u32(0);     // disk, internal attrs, external attrs
      u32(e.offset);
      put(e.nameB);
    });

    /* end of central directory */
    var cdSize = pos - cdStart;
    u32(0x06054B50);
    u16(0); u16(0);               // disk numbers
    u16(entries.length); u16(entries.length);
    u32(cdSize);
    u32(cdStart);
    u16(0);                       // comment length

    return out;
  }

  TB.zip = { crc32: crc32, utf8: utf8, build: build };
})(typeof window !== 'undefined' ? window : globalThis);
