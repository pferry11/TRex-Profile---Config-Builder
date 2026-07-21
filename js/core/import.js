/* TRex Profile & Config Builder - artifact re-import.
 *
 * Turns a previously *generated* profile file back into an editable model.
 *
 * The file body is the single source of truth: values live only there, so any
 * hand-edit (a tweaked IP, a changed rate) is honoured on re-import. A one-line
 * self-describing tag ("# trexb: <kind> schemaVersion=<n>", see
 * TB.gen.py.fileTag) marks a file this tool generated and names the field map to
 * use; it carries no values. The per-kind parser reads the recognised keys back
 * out of the body and reports how much of the file it could map - anything it
 * does not understand is listed so the UI can flag it (only tool-generated files
 * are guaranteed to map fully).
 *
 * There is deliberately no attempt to *execute* or fully understand arbitrary
 * Python/YAML - this tool has no interpreter. It maps the shapes it emits.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.imp = TB.imp || {};

  /* Self-describing tag: "# trexb: cap2 schemaVersion=1 - ..." */
  var TAG_RE = /^#\s*trexb:\s*([A-Za-z0-9_]+)\s+schemaVersion=(\d+)/m;
  /* trexVersion rides in the header comment: "# ... Target: TRex v3.06" */
  var TREX_VER_RE = /Target:\s*TRex\s*v([0-9][0-9.]*)/;

  /* Read the self-describing tag, or null if the file has none. */
  TB.imp.readTag = function (text) {
    var m = TAG_RE.exec(String(text || ''));
    return m ? { kind: m[1], schemaVersion: parseInt(m[2], 10) } : null;
  };

  /* value coercion for structural parsing: strip quotes, numbers become numbers. */
  function pv(v) {
    v = String(v == null ? '' : v).trim();
    if ((v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') ||
        (v.charAt(0) === "'" && v.charAt(v.length - 1) === "'")) {
      return v.slice(1, -1);
    }
    if (/^-?\d+$/.test(v)) { return parseInt(v, 10); }
    if (/^-?\d+\.\d+$/.test(v)) { return parseFloat(v); }
    return v;
  }

  /* ---------------------------------------------------------------------------
   * Main entry. opts.kind selects the field-map parser (defaults to the kind in
   * the file's tag). The body is always the source of values.
   * Returns:
   *   { ok:true, source:'tool'|'foreign', tag, model, coverage, mapped, total, unmapped }
   *   { ok:false, source:'none', error }
   * 'tool'    = carries our tag (generated here);
   * 'foreign' = no tag (hand-written / third-party), parsed best-effort.
   * ------------------------------------------------------------------------- */
  TB.imp.parse = function (text, opts) {
    opts = opts || {};
    text = String(text || '');
    var tag = TB.imp.readTag(text);
    var parser = TB.imp.parsers[opts.kind || (tag && tag.kind)];
    if (!parser) {
      return { ok: false, source: 'none',
               error: 'This file type can\'t be read back into the builder yet.' };
    }
    var res = parser(text);
    if (!res.ok) { return res; }
    res.source = tag ? 'tool' : 'foreign';
    res.tag = tag;
    /* recover metadata the body itself doesn't carry */
    if (tag) { res.model.schemaVersion = tag.schemaVersion; }
    var tv = TREX_VER_RE.exec(text);
    if (tv) { res.model.trexVersion = tv[1]; }
    return res;
  };

  TB.imp.parsers = {};

  /* ---- cap2 (legacy STF YAML) structural parser -------------------------- */
  var CAP2_GEN = {
    distribution: 'distribution', clients_start: 'clientsStart', clients_end: 'clientsEnd',
    servers_start: 'serversStart', servers_end: 'serversEnd', clients_per_gb: 'clientsPerGb',
    min_clients: 'minClients', dual_port_mask: 'dualPortMask', tcp_aging: 'tcpAging', udp_aging: 'udpAging'
  };
  var CAP2_NUM_GEN = { clients_per_gb: 1, min_clients: 1, tcp_aging: 1, udp_aging: 1 };
  var CAP2_CAP = { cps: 1, ipg: 1, rtt: 1, w: 1, limit: 1, plugin_id: 1 };
  var CAP2_DYN = { pyld_offset: 'pyldOffset', type: 'type', len: 'len', mask: 'mask' };

  function cap2Cap(name) {
    return { name: name, cps: 1, ipg: 10000, rtt: 10000, w: 1,
             limit: null, plugin_id: null, oneAppServer: null, serverAddr: null, dynPyload: null };
  }

  /* "[0x0,0x0,0x0,0x1,0x0,0x00]" -> [0,0,0,1,0,0], or null if not 6 bytes. */
  function parseMacArray(v) {
    var m = /\[([^\]]*)\]/.exec(String(v || ''));
    if (!m) { return null; }
    var parts = m[1].split(',').map(function (x) { return parseInt(x.trim(), x.trim().indexOf('0x') === 0 ? 16 : 10); });
    return (parts.length === 6 && parts.every(function (n) { return isFinite(n); })) ? parts : null;
  }

  TB.imp.parsers.cap2 = function (text) {
    var model = {
      kind: 'cap2', schemaVersion: 1, trexVersion: '3.06',
      meta: { name: 'imported_stf_profile', description: '', modified: '' },
      duration: 10,
      generator: { distribution: 'seq', clientsStart: '', clientsEnd: '',
                   serversStart: '', serversEnd: '', clientsPerGb: null, minClients: null,
                   dualPortMask: null, tcpAging: null, udpAging: null },
      flags: { capIpg: null, capOverrideIpg: null, capIpgMin: null,
               vlan: { enabled: false, vlan0: 100, vlan1: 200 }, macOverrideByIp: null, mac: null },
      capInfo: []
    };
    var mapped = 0, total = 0, unmapped = [];
    var section = null;   // null | 'generator' | 'cap_info'
    var cap = null, dyn = null, inDyn = false;

    String(text).split(/\r?\n/).forEach(function (raw) {
      var t = raw.trim();
      if (!t || t.charAt(0) === '#') { return; }              // comment / blank - ignore
      var content = t.replace(/^-\s+/, '');                   // strip YAML list dash
      var mk = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(content);
      if (!mk) { total++; unmapped.push(t); return; }
      var key = mk[1], val = mk[2].trim();

      /* structural section headers - not counted as settings */
      if (key === 'generator' && val === '') { section = 'generator'; inDyn = false; return; }
      if (key === 'cap_info' && val === '') { section = 'cap_info'; inDyn = false; return; }
      if (key === 'dyn_pyload' && val === '') {
        if (cap) { cap.dynPyload = []; inDyn = true; } return;
      }

      /* top-level duration */
      if (key === 'duration') { model.duration = pv(val); mapped++; total++; return; }

      /* global replay flags (any position) */
      if (key === 'cap_ipg') { model.flags.capIpg = /^(true|1)$/i.test(val) ? true : null; mapped++; total++; section = null; return; }
      if (key === 'cap_override_ipg') { model.flags.capOverrideIpg = pv(val); mapped++; total++; section = null; return; }
      if (key === 'cap_ipg_min') { model.flags.capIpgMin = pv(val); mapped++; total++; section = null; return; }
      if (key === 'mac_override_by_ip') { model.flags.macOverrideByIp = pv(val); mapped++; total++; section = null; return; }
      if (key === 'mac') {
        var mm = parseMacArray(val);
        if (mm) { model.flags.mac = mm; mapped++; total++; section = null; return; }
        /* not a 6-byte source-mac (e.g. a per-pool mac) - leave for the unmapped tally */
      }
      if (key === 'vlan') {
        var en = /enable\s*:\s*(\d+)/.exec(val), v0 = /vlan0\s*:\s*(\d+)/.exec(val), v1 = /vlan1\s*:\s*(\d+)/.exec(val);
        model.flags.vlan = { enabled: !!(en && +en[1]),
                             vlan0: v0 ? +v0[1] : 100, vlan1: v1 ? +v1[1] : 200 };
        mapped++; total++; section = null; return;
      }

      /* generator block */
      if (section === 'generator' && CAP2_GEN.hasOwnProperty(key)) {
        model.generator[CAP2_GEN[key]] = CAP2_NUM_GEN[key] ? pv(val) : String(pv(val));
        mapped++; total++; return;
      }

      /* cap_info entries */
      if (section === 'cap_info') {
        if (key === 'name') { cap = cap2Cap(pv(val)); model.capInfo.push(cap); inDyn = false; mapped++; total++; return; }
        if (inDyn && cap) {
          if (key === 'pkt_id') { dyn = { pktId: pv(val), pyldOffset: 0, type: 0, len: 4, mask: '0xffffffff' }; cap.dynPyload.push(dyn); mapped++; total++; return; }
          if (dyn && CAP2_DYN.hasOwnProperty(key)) { dyn[CAP2_DYN[key]] = (key === 'mask') ? String(val) : pv(val); mapped++; total++; return; }
        }
        if (cap && key === 'server_addr') { cap.serverAddr = String(pv(val)); mapped++; total++; return; }
        if (cap && key === 'one_app_server') { cap.oneAppServer = /^(true|1)$/i.test(val); mapped++; total++; return; }
        if (cap && CAP2_CAP.hasOwnProperty(key)) { cap[key] = pv(val); mapped++; total++; return; }
      }

      /* fell through - a data line we don't map */
      total++; unmapped.push(t);
    });

    if (mapped === 0) {
      return { ok: false, error: 'Could not recognise any cap2 settings in this file.' };
    }
    return { ok: true, model: model,
             coverage: total ? mapped / total : 1,
             mapped: mapped, total: total, unmapped: unmapped };
  };
})(typeof window !== 'undefined' ? window : globalThis);
