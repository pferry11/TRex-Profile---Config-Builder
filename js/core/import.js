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
             limit: null, plugin_id: null, oneAppServer: null, serverAddr: null,
             clientPool: null, serverPool: null, dynPyload: null };
  }

  /* "[0x0,0x0,0x0,0x1,0x0,0x00]" -> [0,0,0,1,0,0], or null if not a numeric list.
     Used for the 6-byte source mac and the 6-word src/dst_ipv6 base arrays. */
  function parseHexArray(v) {
    var m = /\[([^\]]*)\]/.exec(String(v || ''));
    if (!m) { return null; }
    var parts = m[1].split(',').map(function (x) { x = x.trim(); return parseInt(x, x.indexOf('0x') === 0 ? 16 : 10); });
    return parts.every(function (n) { return isFinite(n); }) ? parts : null;
  }

  TB.imp.parsers.cap2 = function (text) {
    var model = {
      kind: 'cap2', schemaVersion: 1, trexVersion: '3.06',
      meta: { name: 'imported_stf_profile', description: '', modified: '' },
      duration: 10,
      generator: { distribution: 'seq', clientsStart: '', clientsEnd: '',
                   serversStart: '', serversEnd: '', clientsPerGb: null, minClients: null,
                   dualPortMask: null, tcpAging: null, udpAging: null,
                   clientPools: null, serverPools: null },
      flags: { capIpg: null, capOverrideIpg: null, capIpgMin: null,
               vlan: { enabled: false, vlan0: 100, vlan1: 200 }, macOverrideByIp: null, mac: null,
               srcIpv6: null, dstIpv6: null, tw: null,
               minSrcIp: null, maxSrcIp: null, minDstIp: null, maxDstIp: null },
      capInfo: []
    };
    var mapped = 0, total = 0, unmapped = [];
    var section = null;   // null | 'generator' | 'gen_clients' | 'gen_servers' | 'cap_info'
    var cap = null, dyn = null, inDyn = false, pool = null;

    String(text).split(/\r?\n/).forEach(function (raw) {
      var t = raw.trim();
      if (!t || t.charAt(0) === '#') { return; }              // comment / blank - ignore
      var content = t.replace(/^-\s+/, '');                   // strip YAML list dash
      var mk = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(content);
      if (!mk) { total++; unmapped.push(t); return; }
      var key = mk[1], val = mk[2].trim();

      /* structural section headers - not counted as settings */
      if (key === 'generator' && val === '') { section = 'generator'; inDyn = false; return; }
      if (key === 'generator_clients' && val === '') { section = 'gen_clients'; pool = null; return; }
      if (key === 'generator_servers' && val === '') { section = 'gen_servers'; pool = null; return; }
      if (key === 'cap_info' && val === '') { section = 'cap_info'; inDyn = false; pool = null; return; }
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
        var mm = parseHexArray(val);
        if (mm && mm.length === 6) { model.flags.mac = mm; mapped++; total++; section = null; return; }
        /* not a 6-byte source-mac (e.g. a per-pool mac) - leave for the unmapped tally */
      }
      if (key === 'src_ipv6' || key === 'dst_ipv6') {
        var v6 = parseHexArray(val);
        if (v6 && v6.length === 6) {
          model.flags[key === 'src_ipv6' ? 'srcIpv6' : 'dstIpv6'] = v6;
          mapped++; total++; section = null; return;
        }
      }
      if (key === 'min_src_ip' || key === 'max_src_ip' || key === 'min_dst_ip' || key === 'max_dst_ip') {
        var camel = key.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
        model.flags[camel] = String(pv(val)); mapped++; total++; section = null; return;
      }
      /* timer wheel: "tw :" opens a nested map; its sub-keys follow at deeper indent */
      if (key === 'tw') { model.flags.tw = { buckets: null, levels: null, bucketTimeUsec: null }; section = null; return; }
      if (model.flags.tw && (key === 'buckets' || key === 'levels' || key === 'bucket_time_usec')) {
        model.flags.tw[key === 'bucket_time_usec' ? 'bucketTimeUsec' : key] = pv(val); mapped++; total++; return;
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

      /* per-template generator pools (generator_clients / generator_servers).
         Each "- name : .." opens a pool item; its distribution/ip_start/ip_end
         (+ track_ports for servers) follow at deeper indent. */
      if (section === 'gen_clients' || section === 'gen_servers') {
        var arrKey = section === 'gen_clients' ? 'clientPools' : 'serverPools';
        if (key === 'name') {
          pool = { name: String(pv(val)), distribution: 'seq', ipStart: '', ipEnd: '' };
          if (section === 'gen_servers') { pool.trackPorts = false; }
          if (!model.generator[arrKey]) { model.generator[arrKey] = []; }
          model.generator[arrKey].push(pool);
          mapped++; total++; return;
        }
        if (pool) {
          if (key === 'distribution') { pool.distribution = String(pv(val)); mapped++; total++; return; }
          if (key === 'ip_start') { pool.ipStart = String(pv(val)); mapped++; total++; return; }
          if (key === 'ip_end') { pool.ipEnd = String(pv(val)); mapped++; total++; return; }
          if (key === 'track_ports') { pool.trackPorts = /^(true|1)$/i.test(val); mapped++; total++; return; }
        }
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
        if (cap && key === 'client_pool') { cap.clientPool = String(pv(val)); mapped++; total++; return; }
        if (cap && key === 'server_pool') { cap.serverPool = String(pv(val)); mapped++; total++; return; }
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

  /* ---- STL (.py) structural parser --------------------------------------
   * Reverses the deterministic output of js/gen/stl.js: an STLGenProfile class
   * with create_stream_<n> methods (packet / vm / mode) and a get_streams
   * argparse block - or a single load_pcap get_streams for pcap-replay mode.
   * Values are read straight from the body, so hand-edits are honoured. A file
   * this tool generated maps fully; arbitrary hand-written Python is best-effort
   * (this parser reads the shapes we emit, it does not interpret Python).
   * ---------------------------------------------------------------------- */

  /* strip a matching pair of surrounding quotes, else return trimmed as-is */
  function unq(s) {
    s = String(s == null ? '' : s).trim();
    if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
        (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) { return s.slice(1, -1); }
    return s;
  }
  /* value of `key=<number>` inside an arg string, or null */
  function kwNum(args, key) {
    var m = new RegExp(key + '\\s*=\\s*(-?[0-9.]+)').exec(args);
    return m ? pv(m[1]) : null;
  }
  /* value of `key="str"` (or 'str') inside an arg string, or null */
  function kwStr(args, key) {
    var m = new RegExp(key + '\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')').exec(args);
    return m ? unq(m[1]) : null;
  }
  /* value of `key=...` accepting a quoted string OR a bare token (number /
     dotted offset like IP.src). Returns the unquoted text, or null. */
  function kwAny(args, key) {
    var m = new RegExp(key + '\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'|[^,)]+)').exec(args);
    return m ? unq(m[1]) : null;
  }

  function newStlStream(name) {
    return {
      id: 's_' + (name || 'S0') + '_' + Math.random().toString(36).slice(2, 7),
      name: name || 'S0', enabled: true,
      packet: {
        l2: { srcMac: null, dstMac: null },
        vlan: { enabled: false, id: 100, prio: 0 },
        l3: { type: 'ipv4', src: '16.0.0.1', dst: '48.0.0.1', tos: null, ttl: null,
              fragOffset: null, moreFrags: false, ext: 'none' },
        l4: { type: 'udp', sport: 1025, dport: 12, tcpFlags: null,
              icmpKind: 'echo-request', icmpId: null, icmpSeq: null },
        tunnel: { type: 'none', outerSrc: '10.0.0.1', outerDst: '10.0.0.2', vni: 5000,
                  label: 100, mplsTtl: null, outerVlanId: 100, spi: 42, si: 1 },
        payload: { mode: 'pad', frameSize: 64, frameSizeTunable: null, fill: 'x', rawScapy: null }
      },
      mode: { type: 'cont', rateUnit: 'pps', pps: 100, totalPkts: 1000, pktsPerBurst: 4, ibgUsec: 1000000, count: 5 },
      isgUsec: 0,
      chain: { selfStart: true, next: null, actionCount: null },
      vm: { cacheSize: null, vars: [], tuple: null },
      flowStats: { type: 'none', pgId: null, addPortId: false }
    };
  }

  /* split a scapy expression into its top-level "/" layers. Our emitted
     expressions never contain "/" inside a layer's args, so a plain split is
     safe (IPs use ".", IPv6 uses ":"). Returns [{name, args}]. */
  function splitLayers(expr) {
    return String(expr).split('/').map(function (tok) {
      var m = /^\s*([A-Za-z0-9_]+)\s*\((.*)\)\s*$/.exec(tok.trim());
      return m ? { name: m[1], args: m[2] } : { name: tok.trim(), args: '' };
    });
  }

  /* Decode a structured base_pkt expression onto packet fields, in the exact
     layer order js/gen/stl.js emits: Ether, [Dot1AD qinq], [Dot1Q vlan],
     [tunnel], IP|IPv6, [ext], L4. Returns true if it looked structured. */
  function decodePacket(expr, p) {
    var L = splitLayers(expr);
    var i = 0;
    if (!L.length || L[0].name !== 'Ether') { return false; }
    p.l2.srcMac = kwStr(L[0].args, 'src');
    p.l2.dstMac = kwStr(L[0].args, 'dst');
    i = 1;

    if (L[i] && L[i].name === 'Dot1AD') {            // QinQ outer tag
      p.tunnel.type = 'qinq';
      var ov = kwNum(L[i].args, 'vlan'); if (ov !== null) { p.tunnel.outerVlanId = ov; }
      i++;
    }
    if (L[i] && L[i].name === 'Dot1Q') {             // 802.1Q VLAN
      p.vlan.enabled = true;
      var vid = kwNum(L[i].args, 'vlan'); if (vid !== null) { p.vlan.id = vid; }
      var pr = kwNum(L[i].args, 'prio'); p.vlan.prio = pr === null ? 0 : pr;
      i++;
    }
    if (L[i] && L[i].name === 'MPLS') {
      p.tunnel.type = 'mpls';
      var lb = kwNum(L[i].args, 'label'); if (lb !== null) { p.tunnel.label = lb; }
      p.tunnel.mplsTtl = kwNum(L[i].args, 'ttl');
      i++;
    } else if (L[i] && L[i].name === 'NSH') {
      p.tunnel.type = 'nsh';
      var spi = kwNum(L[i].args, 'spi'); if (spi !== null) { p.tunnel.spi = spi; }
      var si = kwNum(L[i].args, 'si'); if (si !== null) { p.tunnel.si = si; }
      i++;
    } else if (L[i] && L[i].name === 'IP' && L[i + 1] && L[i + 1].name === 'GRE') {
      p.tunnel.type = 'gre';
      p.tunnel.outerSrc = kwStr(L[i].args, 'src') || p.tunnel.outerSrc;
      p.tunnel.outerDst = kwStr(L[i].args, 'dst') || p.tunnel.outerDst;
      i += 2;
    } else if (L[i] && L[i].name === 'IP' && L[i + 1] && L[i + 1].name === 'UDP' &&
               L[i + 2] && L[i + 2].name === 'VXLAN') {
      p.tunnel.type = 'vxlan';
      p.tunnel.outerSrc = kwStr(L[i].args, 'src') || p.tunnel.outerSrc;
      p.tunnel.outerDst = kwStr(L[i].args, 'dst') || p.tunnel.outerDst;
      var vni = kwNum(L[i + 2].args, 'vni'); if (vni !== null) { p.tunnel.vni = vni; }
      i += 3;
      if (L[i] && L[i].name === 'Ether') { i++; }   // inner Ether()
    }

    if (L[i] && L[i].name === 'IP') {
      p.l3.type = 'ipv4';
      p.l3.src = kwStr(L[i].args, 'src') || p.l3.src;
      p.l3.dst = kwStr(L[i].args, 'dst') || p.l3.dst;
      p.l3.tos = kwNum(L[i].args, 'tos');
      p.l3.ttl = kwNum(L[i].args, 'ttl');
      p.l3.moreFrags = /flags\s*=\s*"MF"/.test(L[i].args);
      p.l3.fragOffset = kwNum(L[i].args, 'frag');
      i++;
    } else if (L[i] && L[i].name === 'IPv6') {
      p.l3.type = 'ipv6';
      p.l3.src = kwStr(L[i].args, 'src') || p.l3.src;
      p.l3.dst = kwStr(L[i].args, 'dst') || p.l3.dst;
      i++;
      if (L[i] && L[i].name === 'IPv6ExtHdrHopByHop') { p.l3.ext = 'hbh'; i++; }
      else if (L[i] && L[i].name === 'IPv6ExtHdrFragment') { p.l3.ext = 'frag'; i++; }
    }

    if (L[i] && L[i].name === 'UDP') {
      p.l4.type = 'udp';
      var ud = kwNum(L[i].args, 'dport'); if (ud !== null) { p.l4.dport = ud; }
      var us = kwNum(L[i].args, 'sport'); if (us !== null) { p.l4.sport = us; }
    } else if (L[i] && L[i].name === 'TCP') {
      p.l4.type = 'tcp';
      var td = kwNum(L[i].args, 'dport'); if (td !== null) { p.l4.dport = td; }
      var ts = kwNum(L[i].args, 'sport'); if (ts !== null) { p.l4.sport = ts; }
      p.l4.tcpFlags = kwStr(L[i].args, 'flags');
    } else if (L[i] && (L[i].name === 'ICMP' || L[i].name === 'ICMPv6EchoRequest' || L[i].name === 'ICMPv6EchoReply')) {
      p.l4.type = 'icmp';
      if (L[i].name === 'ICMP') {
        p.l4.icmpKind = kwNum(L[i].args, 'type') === 0 ? 'echo-reply' : 'echo-request';
      } else {
        p.l4.icmpKind = L[i].name === 'ICMPv6EchoReply' ? 'echo-reply' : 'echo-request';
      }
      p.l4.icmpId = kwNum(L[i].args, 'id');
      p.l4.icmpSeq = kwNum(L[i].args, 'seq');
    } else {
      p.l4.type = 'none';
    }
    return true;
  }

  /* Reconstruct the field-engine (VM) from a stream block's body. */
  function decodeVm(body, stream) {
    var vm = stream.vm;
    var m;
    var writes = {};   // fv_name -> { pkt_offset, offset_fixup }
    var wRe = /vm\.write\(([^)]*)\)/g;
    while ((m = wRe.exec(body))) {
      var wn = kwStr(m[1], 'fv_name');
      if (wn) { writes[wn] = { writeTo: kwAny(m[1], 'pkt_offset'), offsetFixup: kwNum(m[1], 'offset_fixup') }; }
    }
    var hasFix = /vm\.fix_chksum\(\)/.test(body);
    var tupleM = /vm\.tuple_var\(([^)]*)\)/.exec(body);

    var vRe = /vm\.var\(([^)]*)\)/g;
    while ((m = vRe.exec(body))) {
      var a = m[1];
      var nm = kwStr(a, 'name');
      var w = writes[nm] || {};
      var stepV = kwNum(a, 'step');
      vm.vars.push({
        name: nm, sizeBytes: kwNum(a, 'size') || 4, op: kwStr(a, 'op') || 'inc',
        min: kwAny(a, 'min_value'), max: kwAny(a, 'max_value'),
        step: stepV === null ? 1 : stepV,
        nextVar: kwStr(a, 'next_var'),
        splitToCores: /split_to_cores\s*=\s*False/.test(a) ? false : true,
        writeTo: w.writeTo || 'IP.src', offsetFixup: (w.offsetFixup === undefined ? null : w.offsetFixup),
        /* the generator emits a single fix_chksum() when ANY var wants it or a
           tuple is present; with no tuple, attribute it to the vars. */
        fixChecksum: hasFix && !tupleM
      });
    }

    if (tupleM) {
      var ta = tupleM[1];
      var tname = kwStr(ta, 'name') || 'tuple';
      var ipW = writes[tname + '.ip'] || {};
      var portW = writes[tname + '.port'] || {};
      vm.tuple = {
        name: tname, ipMin: kwStr(ta, 'ip_min') || '', ipMax: kwStr(ta, 'ip_max') || '',
        portMin: kwNum(ta, 'port_min'), portMax: kwNum(ta, 'port_max'),
        limitFlows: kwNum(ta, 'limit_flows'),
        writeIpTo: ipW.writeTo || 'IP.src', writePortTo: portW.writeTo || 'UDP.sport'
      };
    }
    var cached = /vm\.set_cached\((\d+)\)/.exec(body);
    if (cached) { vm.cacheSize = parseInt(cached[1], 10); }
  }

  /* Decode the STLTX... mode call into stream.mode. */
  function decodeMode(body, mode) {
    var m = /mode\s*=\s*(STLTXCont|STLTXSingleBurst|STLTXMultiBurst)\s*\(([^)]*)\)/.exec(body);
    if (!m) { return; }
    mode.type = m[1] === 'STLTXCont' ? 'cont' : (m[1] === 'STLTXSingleBurst' ? 'single_burst' : 'multi_burst');
    var a = m[2];
    var units = ['pps', 'bps_L1', 'bps_L2', 'percentage'];
    for (var i = 0; i < units.length; i++) {
      var rv = kwNum(a, units[i]);
      if (rv !== null) { mode.rateUnit = units[i]; mode.pps = rv; break; }
    }
    var tp = kwNum(a, 'total_pkts'); if (tp !== null) { mode.totalPkts = tp; }
    var ppb = kwNum(a, 'pkts_per_burst'); if (ppb !== null) { mode.pktsPerBurst = ppb; }
    var ibg = kwNum(a, 'ibg'); if (ibg !== null) { mode.ibgUsec = ibg; }
    var cnt = kwNum(a, 'count'); if (cnt !== null) { mode.count = cnt; }
  }

  /* argparse tunables -> [{name, type, default, help, choices?}] */
  function decodeTunables(text) {
    var out = [];
    var re = /parser\.add_argument\('--(\w+)',\s*type=(int|float|str)(?:,\s*choices=\[([^\]]*)\])?,\s*default=(.+?),\s*help=('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\)/g;
    var m;
    while ((m = re.exec(text))) {
      var name = m[1], pyType = m[2], choicesRaw = m[3], def = m[4].trim(), help = unq(m[5]);
      /* the two pcap-replay knobs are not user tunables */
      if (name === 'ipg_usec' || name === 'loop_count') { continue; }
      var t = { name: name, help: help };
      if (choicesRaw !== undefined) {
        t.type = 'choice';
        t.choices = choicesRaw.split(',').map(function (c) { return unq(c); }).filter(function (c) { return c !== ''; });
        t.default = unq(def);
      } else if (pyType === 'int') { t.type = 'int'; t.default = parseInt(def, 10); }
      else if (pyType === 'float') { t.type = 'float'; t.default = parseFloat(def); }
      else { t.type = 'str'; t.default = unq(def); }
      out.push(t);
    }
    return out;
  }

  /* ---- foreign (hand-written) STL best-effort ---------------------------
   * Shipped STL profiles are arbitrary Python; we can only resolve the simple,
   * common shapes: one or more STLStream(...) calls whose packet/vm are built
   * from local `base_pkt = ...` / `pkt = STLPktBuilder(...)` / `vm = STLVM()` or
   * `STLScVmRaw([...])` assignments. Anything we can't resolve statically (a
   * packet built by a function call, a list comprehension) is preserved as a
   * raw-scapy expression and reported partial. This never runs on our own files
   * (they use create_stream_N and are handled above). ------------------- */

  /* content between the '(' at openIdx and its matching ')', quote-aware */
  function balanced(str, openIdx) {
    var depth = 0, q = null;
    for (var i = openIdx; i < str.length; i++) {
      var c = str[i];
      if (q) { if (c === q) { q = null; } continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(' || c === '[') { depth++; }
      else if (c === ')' || c === ']') { depth--; if (depth === 0) { return str.slice(openIdx + 1, i); } }
    }
    return null;
  }
  /* split top-level comma args (respecting nested brackets and quotes) */
  function splitArgs(inner) {
    var out = [], depth = 0, q = null, cur = '';
    for (var i = 0; i < inner.length; i++) {
      var c = inner[i];
      if (q) { cur += c; if (c === q) { q = null; } continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(' || c === '[' || c === '{') { depth++; }
      else if (c === ')' || c === ']' || c === '}') { depth--; }
      if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else { cur += c; }
    }
    if (cur.trim()) { out.push(cur); }
    return out;
  }
  /* map of `key = value` from a top-level arg list */
  function kwMap(inner) {
    var map = {};
    splitArgs(inner || '').forEach(function (piece) {
      var m = /^\s*([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(piece);
      if (m) { map[m[1]] = m[2].trim(); }
    });
    return map;
  }

  /* low-level field engine: STLScVmRaw([ STLVmFlowVar, STLVmWrFlowVar,
     STLVmFixIpv4, STLVmTupleGen ]) - the class-based equivalent of decodeVm. */
  function decodeLowLevelVm(txt, vm) {
    var writes = {}, m;
    var wRe = /STLVmWrFlowVar\(([^)]*)\)/g;
    while ((m = wRe.exec(txt))) {
      var wn = kwStr(m[1], 'fv_name');
      if (wn) { writes[wn] = { writeTo: kwAny(m[1], 'pkt_offset'), offsetFixup: kwNum(m[1], 'offset_fixup') }; }
    }
    var hasFix = /STLVmFixIpv4\(/.test(txt);
    var tupleM = /STLVmTupleGen\(([^)]*)\)/.exec(txt);
    var vRe = /STLVmFlowVar\(([^)]*)\)/g;
    while ((m = vRe.exec(txt))) {
      var a = m[1], nm = kwStr(a, 'name'), w = writes[nm] || {}, stepV = kwNum(a, 'step');
      vm.vars.push({
        name: nm, sizeBytes: kwNum(a, 'size') || 4, op: kwStr(a, 'op') || 'inc',
        min: kwAny(a, 'min_value'), max: kwAny(a, 'max_value'), step: stepV === null ? 1 : stepV,
        nextVar: kwStr(a, 'next_var'), splitToCores: /split_to_cores\s*=\s*False/.test(a) ? false : true,
        writeTo: w.writeTo || 'IP.src', offsetFixup: (w.offsetFixup === undefined ? null : w.offsetFixup),
        fixChecksum: hasFix && !tupleM
      });
    }
    if (tupleM) {
      var ta = tupleM[1], tname = kwStr(ta, 'name') || 'tuple';
      var ipW = writes[tname + '.ip'] || {}, portW = writes[tname + '.port'] || {};
      vm.tuple = {
        name: tname, ipMin: kwStr(ta, 'ip_min') || '', ipMax: kwStr(ta, 'ip_max') || '',
        portMin: kwNum(ta, 'port_min'), portMax: kwNum(ta, 'port_max'), limitFlows: kwNum(ta, 'limit_flows'),
        writeIpTo: ipW.writeTo || 'IP.src', writePortTo: portW.writeTo || 'UDP.sport'
      };
    }
  }

  /* Extract a full `<name> = STLScVmRaw(...)` (possibly multi-line) from text. */
  function grabAssignedCall(text, callName) {
    var re = new RegExp(callName + '\\s*\\(');
    var m = re.exec(text);
    if (!m) { return null; }
    var open = m.index + m[0].length - 1;
    return balanced(text, open);
  }

  function parseForeignStl(text, model, unmapped) {
    /* single-line simple assignments: var -> rhs (last wins) */
    var assign = {};
    text.split(/\r?\n/).forEach(function (line) {
      var m = /^\s*([A-Za-z_]\w*)\s*=\s*(.+?)\s*;?\s*$/.exec(line);
      if (m) { assign[m[1]] = m[2]; }
    });
    var hasFluentVm = /\bvm\s*=\s*STLVM\(\)/.test(text);
    var lowLevelVm = /STLScVmRaw\s*\(/.test(text) ? grabAssignedCall(text, 'STLScVmRaw') : null;

    var found = [], idx = 0, marker = 'STLStream(';
    while ((idx = text.indexOf(marker, idx)) !== -1) {
      var open = idx + marker.length - 1;
      var inner = balanced(text, open);
      idx = open + (inner ? inner.length : 0) + 2;
      if (inner != null) { found.push(inner); }
    }
    var mapped = 0;
    found.forEach(function (inner) {
      var kw = kwMap(inner);
      var s = newStlStream('S' + model.streams.length);
      if (kw.name) { s.name = unq(kw.name); }

      /* resolve packet -> STLPktBuilder(pkt=<expr>, vm=<ref>) */
      var builder = kw.packet;
      if (builder && builder.indexOf('STLPktBuilder') === -1 && assign[builder.trim()]) { builder = assign[builder.trim()]; }
      var pktExpr = null, vmRef = null;
      if (builder && builder.indexOf('STLPktBuilder') !== -1) {
        var bkw = kwMap(balanced(builder, builder.indexOf('(')) || '');
        pktExpr = bkw.pkt; vmRef = bkw.vm;
      }
      if (pktExpr) {
        var expr = pktExpr.replace(/\s*\/\s*pad\b/, '');          // drop /pad
        if (expr !== pktExpr) { s.packet.payload.mode = 'pad'; }
        expr = expr.replace(/\s*\/\s*\([^()]*\*[^()]*\)\s*$/, ''); // drop inline /(N*'x')
        expr = expr.trim();
        if (assign[expr]) { expr = assign[expr].trim(); }          // follow base_pkt var
        if (!decodePacket(expr, s.packet)) {
          s.packet.payload.rawScapy = expr;
          unmapped.push('unresolved packet: ' + expr.slice(0, 80));
        }
      }

      /* vm: inline STLScVmRaw, or a separately-assigned one, or fluent STLVM.
         Non-inline vm is only attributed when this is the sole stream. */
      if (vmRef && /STLScVmRaw/.test(vmRef)) {
        decodeLowLevelVm(vmRef, s.vm);
      } else if (vmRef && vmRef !== '[]' && found.length === 1) {
        if (lowLevelVm) { decodeLowLevelVm(lowLevelVm, s.vm); }
        else if (hasFluentVm) { decodeVm(text, s); }
      }

      decodeMode(inner, s.mode);
      var isgM = /\bisg\s*=\s*([0-9.]+)/.exec(inner); if (isgM) { s.isgUsec = pv(isgM[1]); }
      var nextM = /\bnext\s*=\s*(['"])([^'"]*)\1/.exec(inner); if (nextM) { s.chain.next = nextM[2]; }
      if (/self_start\s*=\s*False/.test(inner)) { s.chain.selfStart = false; }
      var acM = /action_count\s*=\s*(\d+)/.exec(inner); if (acM) { s.chain.actionCount = parseInt(acM[1], 10); }
      var fsM = /flow_stats\s*=\s*(STLFlowStats|STLFlowLatencyStats)\s*\(\s*pg_id\s*=\s*([^)]+)\)/.exec(inner);
      if (fsM) {
        s.flowStats.type = fsM[1] === 'STLFlowLatencyStats' ? 'latency' : 'stats';
        s.flowStats.addPortId = /\+\s*port_id/.test(fsM[2]);
        s.flowStats.pgId = parseInt(fsM[2], 10);
      }
      model.streams.push(s);
      mapped++;
    });
    return mapped;
  }

  TB.imp.parsers.stl = function (text) {
    text = String(text);
    var model = {
      kind: 'stl', schemaVersion: 1, trexVersion: '3.06',
      meta: { name: 'imported_stl_profile', description: '', modified: '' },
      tunables: [],
      pcapReplay: { enabled: false, file: 'cap2/dns.pcap', ipgUsec: 10, loopCount: 5, speedup: 1 },
      streams: []
    };
    var nameM = /#\s*Re-edit:\s*load\s+(.+?)\.trexb\.json/.exec(text);
    if (nameM) { model.meta.name = nameM[1]; }

    var mapped = 0, total = 0, unmapped = [];

    /* ---- pcap-replay mode (STLProfile.load_pcap) ---- */
    var pcapM = /STLProfile\.load_pcap\('([^']*)',\s*([^)]*)\)\.get_streams\(\)/.exec(text);
    if (pcapM) {
      var ipgM = /--ipg_usec',\s*type=float,\s*default=([^,]+),/.exec(text);
      var loopM = /--loop_count',\s*type=int,\s*default=(\d+),/.exec(text);
      var speedM = /speedup=([0-9.]+)/.exec(pcapM[2]);
      model.pcapReplay = {
        enabled: true, file: pcapM[1],
        ipgUsec: (ipgM && /None/.test(ipgM[1])) ? null : (ipgM ? pv(ipgM[1].trim()) : 10),
        loopCount: loopM ? parseInt(loopM[1], 10) : 5,
        speedup: speedM ? pv(speedM[1]) : 1
      };
      mapped += 1; total += 1;
      return { ok: true, model: model, coverage: 1, mapped: mapped, total: total, unmapped: unmapped };
    }

    /* ---- stream mode ---- */
    model.tunables = decodeTunables(text);
    if (model.tunables.length) { mapped += model.tunables.length; total += model.tunables.length; }

    var blockRe = /def create_stream_(\d+)\s*\(self, args[^)]*\):([\s\S]*?)(?=\n {4}def |\ndef |$)/g;
    var bm;
    while ((bm = blockRe.exec(text))) {
      var body = bm[2];
      var nm = /name='([^']*)'/.exec(body);
      var s = newStlStream(nm ? nm[1] : 'S' + bm[1]);

      var raw = /# UNVALIDATED raw scapy expression/.test(body);
      var pktM = /base_pkt\s*=\s*(.+)/.exec(body);
      if (pktM) {
        if (raw) { s.packet.payload.rawScapy = pktM[1].trim(); }
        else if (!decodePacket(pktM[1].trim(), s.packet)) { s.packet.payload.rawScapy = pktM[1].trim(); }
      }
      var padM = /pad\s*=\s*max\(0,\s*(.+?)\s*-\s*len\(base_pkt\)\)\s*\*\s*'([^']*)'/.exec(body);
      if (padM) {
        s.packet.payload.mode = 'pad';
        if (/^args\./.test(padM[1])) { s.packet.payload.frameSizeTunable = padM[1].replace(/^args\./, ''); }
        else { s.packet.payload.frameSize = pv(padM[1]); }
        s.packet.payload.fill = padM[2] ? padM[2].charAt(0) : 'x';
      }

      decodeVm(body, s);
      decodeMode(body, s.mode);

      var isgM = /\bisg=([0-9.]+)/.exec(body);
      if (isgM) { s.isgUsec = pv(isgM[1]); }
      var fsM = /flow_stats=(STLFlowStats|STLFlowLatencyStats)\(pg_id=([^)]+)\)/.exec(body);
      if (fsM) {
        s.flowStats.type = fsM[1] === 'STLFlowLatencyStats' ? 'latency' : 'stats';
        s.flowStats.addPortId = /\+\s*port_id/.test(fsM[2]);
        s.flowStats.pgId = parseInt(fsM[2], 10);
      }
      var nextM = /next='([^']*)'/.exec(body);
      if (nextM) { s.chain.next = nextM[1]; }
      if (/self_start=False/.test(body)) { s.chain.selfStart = false; }
      var acM = /action_count=(\d+)/.exec(body);
      if (acM) { s.chain.actionCount = parseInt(acM[1], 10); }

      model.streams.push(s);
      mapped += 1; total += 1;
    }

    /* foreign fallback: no create_stream_N blocks means this file wasn't
       generated by us - best-effort extraction of the common hand-written
       shapes (comments stripped first so they can't break paren matching). */
    if (!model.streams.length) {
      var fn = parseForeignStl(text.replace(/#[^\n]*/g, ''), model, unmapped);
      mapped += fn; total += fn;
    }

    /* coverage: count code lines we did not consume as unmapped. A tool file
       leaves none; for foreign Python the structural boilerplate is skipped and
       the real gaps (unresolved packets) are pushed to unmapped above. */
    var SKIP = /^(from |import |class |def |return|self\.|parser|args =|formatter_class=|base_pkt|pad =|size|pkt|vm|t ?=|t ?\[|STL|Ether|IP|IPv6|UDP|TCP|Dot1|MPLS|NSH|GRE|VXLAN|name ?=|packet|mode|isg|flow_stats|next|self_start|action_count|"""|'''|[)\]},])/;
    String(text).split(/\r?\n/).forEach(function (raw) {
      var t = raw.trim();
      if (!t || t.charAt(0) === '#') { return; }
      if (SKIP.test(t)) { return; }
      total += 1; unmapped.push(t);
    });

    if (!model.streams.length && !model.tunables.length) {
      return { ok: false, error: 'Could not recognise any STL streams in this file.' };
    }
    return { ok: true, model: model,
             coverage: total ? mapped / total : 1,
             mapped: mapped, total: total, unmapped: unmapped };
  };

  /* ---- ASTF (.py) structural parser -------------------------------------
   * Reverses the deterministic output of js/gen/astf.js: an ASTFGenProfile
   * class whose get_profile builds an ASTFIPGen, optional c/s ASTFGlobalInfo,
   * and either a cap_list (ASTFCapInfo) or program-mode templates (ASTFProgram
   * -> ASTFTCPClient/ServerTemplate -> ASTFTemplate). Values are read from the
   * body; a file this tool generated maps fully. The companion _topo.py is a
   * separate file and is not re-imported (tunnelsTopo stays default). ------ */

  var ASTF_TCP_FIELDS = ['mss', 'rxbufsize', 'txbufsize', 'initwnd', 'no_delay', 'do_rfc1323',
                         'keepinit', 'keepidle', 'keepintvl', 'no_delay_counter', 'delay_ack_msec'];

  /* undo python string escaping (\n \r \t \\ \' \") */
  function pyUnescape(s) {
    return String(s).replace(/\\([nrt"'\\])/g, function (_, c) {
      return c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c;
    });
  }
  /* leading python string literal of an expression -> its unescaped JS value */
  function pyStrValue(expr) {
    var m = /^\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/.exec(String(expr));
    return m ? pyUnescape(m[1].slice(1, -1)) : null;
  }

  function astfSideGlobals() {
    return {
      tcp: { mss: null, rxbufsize: null, txbufsize: null, initwnd: null, no_delay: null,
             do_rfc1323: null, keepinit: null, keepidle: null, keepintvl: null,
             no_delay_counter: null, delay_ack_msec: null },
      ip: { tos: null, ttl: null },
      scheduler: { rampupSec: null },
      ipv6: { enable: false, srcMsb: '', dstMsb: '' }
    };
  }

  /* ASTFIPGenDist(ip_range=["a","b"], distribution="seq"[, per_core_distribution="x"]) */
  function parseIpGenDist(args) {
    var r = /ip_range\s*=\s*\[\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\]/.exec(args);
    return {
      start: r ? r[1] : '', end: r ? r[2] : '',
      distribution: kwStr(args, 'distribution') || 'seq',
      perCore: kwStr(args, 'per_core_distribution')
    };
  }
  /* the ip_gen<sfx> block: ip_gen_c<sfx>/ip_gen_s<sfx> dists + the ip_offset */
  function parseIpGenBlock(text, sfx) {
    var e = sfx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var cM = new RegExp('ip_gen_c' + e + '\\s*=\\s*ASTFIPGenDist\\(([^)]*)\\)').exec(text);
    var sM = new RegExp('ip_gen_s' + e + '\\s*=\\s*ASTFIPGenDist\\(([^)]*)\\)').exec(text);
    if (!cM || !sM) { return null; }
    var offM = new RegExp('ip_gen' + e + '\\s*=\\s*ASTFIPGen\\(glob=ASTFIPGenGlobal\\(ip_offset=("[^"]*"|\'[^\']*\')').exec(text);
    return { client: parseIpGenDist(cM[1]), server: parseIpGenDist(sM[1]),
             ipOffset: offM ? unq(offM[1]) : '1.0.0.0' };
  }

  function parseGlobalsInto(text, varName, g, counters) {
    var hit = false;
    ASTF_TCP_FIELDS.forEach(function (f) {
      var m = new RegExp(varName + '\\.tcp\\.' + f + '\\s*=\\s*(-?\\d+)').exec(text);
      if (m) { g.tcp[f] = parseInt(m[1], 10); hit = true; }
    });
    ['tos', 'ttl'].forEach(function (f) {
      var m = new RegExp(varName + '\\.ip\\.' + f + '\\s*=\\s*(-?\\d+)').exec(text);
      if (m) { if (!g.ip) { g.ip = { tos: null, ttl: null }; } g.ip[f] = parseInt(m[1], 10); hit = true; }
    });
    var r = new RegExp(varName + '\\.scheduler\\.rampup_sec\\s*=\\s*(-?\\d+)').exec(text);
    if (r) { g.scheduler.rampupSec = parseInt(r[1], 10); hit = true; }
    if (new RegExp(varName + '\\.ipv6\\.enable\\s*=\\s*1').test(text)) {
      g.ipv6.enable = true; hit = true;
      var s = new RegExp(varName + '\\.ipv6\\.src_msb\\s*=\\s*"([^"]*)"').exec(text);
      if (s) { g.ipv6.srcMsb = s[1]; }
      var d = new RegExp(varName + '\\.ipv6\\.dst_msb\\s*=\\s*"([^"]*)"').exec(text);
      if (d) { g.ipv6.dstMsb = d[1]; }
    }
    if (hit) { counters.mapped++; counters.total++; }
  }

  /* payload var defs -> { varName: { payload, len } } */
  function parseAstfPayloads(text) {
    var HTTP_REQ = (TB.gen && TB.gen.astfHttpReq) || null;
    var respHeader = (TB.gen && TB.gen.astfHttpResponseHeader) || function () { return ''; };
    var map = {};
    text.split(/\r?\n/).forEach(function (raw) {
      var m = /^\s*([A-Za-z_]\w*)\s*=\s*(('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")(\s*\+\s*\('\*'\s*\*\s*(\d+)\))?)\s*$/.exec(raw);
      if (!m) { return; }
      var strVal = pyStrValue(m[3]);
      if (m[5] !== undefined) {                       // '<header>' + ('*' * N) -> httpResponse
        var body = parseInt(m[5], 10);
        map[m[1]] = { payload: { kind: 'httpResponse', bodyBytes: body }, len: respHeader(body).length + body };
      } else if (HTTP_REQ !== null && strVal === HTTP_REQ) {
        map[m[1]] = { payload: { kind: 'httpRequest' }, len: HTTP_REQ.length };
      } else {
        map[m[1]] = { payload: { kind: 'text', text: strVal }, len: strVal.length };
      }
    });
    return map;
  }

  /* collect prog_* command programs -> { varName: { isUdp, commands } } */
  function parseAstfPrograms(text, paymap) {
    var progs = {};
    text.split(/\r?\n/).forEach(function (raw) {
      var t = raw.trim();
      var def = /^(prog_[cs]\w*)\s*=\s*ASTFProgram\(([^)]*)\)/.exec(t);
      if (def) { progs[def[1]] = { isUdp: /stream\s*=\s*False/.test(def[2]), commands: [] }; return; }
      var call = /^(prog_[cs]\w*)\.(\w+)\((.*)\)\s*$/.exec(t);
      if (!call) { return; }
      var cur = progs[call[1]];
      if (!cur) { return; }
      var op = call[2], a = call[3].trim();
      switch (op) {
        case 'send': case 'send_msg': {
          var pe = paymap[a]; cur.commands.push({ op: op, payload: pe ? pe.payload : { kind: 'text', text: '' } }); break;
        }
        case 'recv': {
          var lm = /^len\(([A-Za-z_]\w*)\)(?:\s*\*\s*(\d+))?$/.exec(a);
          if (lm && lm[2]) {                                    // len(var) * N -> explicit count
            var pl = paymap[lm[1]];
            cur.commands.push({ op: 'recv', bytes: (pl ? pl.len : 0) * parseInt(lm[2], 10) });
          } else if (lm) {                                      // len(var) alone -> "auto" (match peer send)
            cur.commands.push({ op: 'recv', bytes: null });
          } else {                                              // a literal byte count
            cur.commands.push({ op: 'recv', bytes: /^\d+$/.test(a) ? parseInt(a, 10) : null });
          }
          break;
        }
        case 'recv_msg': cur.commands.push({ op: 'recv_msg', count: parseInt(a, 10) || 1 }); break;
        case 'delay': cur.commands.push({ op: 'delay', usec: parseInt(a, 10) || 0 }); break;
        case 'delay_rand': {
          var dr = /(\d+)\s*,\s*(\d+)/.exec(a);
          cur.commands.push({ op: 'delay_rand', minUsec: dr ? +dr[1] : 0, maxUsec: dr ? +dr[2] : 0 }); break;
        }
        case 'set_var': {
          var sv = /("(?:[^"]*)"|'(?:[^']*)')\s*,\s*(-?\d+)/.exec(a);
          cur.commands.push({ op: 'set_var', id: sv ? unq(sv[1]) : 'var1', value: sv ? parseInt(sv[2], 10) : 0 }); break;
        }
        case 'set_label': cur.commands.push({ op: 'set_label', name: unq(a) }); break;
        case 'jmp_nz': {
          var jm = /("(?:[^"]*)"|'(?:[^']*)')\s*,\s*("(?:[^"]*)"|'(?:[^']*)')/.exec(a);
          cur.commands.push({ op: 'jmp_nz', id: jm ? unq(jm[1]) : 'var1', label: jm ? unq(jm[2]) : 'a:' }); break;
        }
        case 'wait_for_peer_close': cur.commands.push({ op: 'wait_for_peer_close' }); break;
      }
    });
    return progs;
  }

  TB.imp.parsers.astf = function (text) {
    text = String(text);
    var model = {
      kind: 'astf', schemaVersion: 1, trexVersion: '3.06',
      meta: { name: 'imported_astf_profile', description: '', modified: '' },
      ipGen: { client: { start: '16.0.0.1', end: '16.0.0.255', distribution: 'seq', perCore: null },
               server: { start: '48.0.0.1', end: '48.0.255.255', distribution: 'seq', perCore: null },
               ipOffset: '1.0.0.0' },
      globals: { client: astfSideGlobals(), server: astfSideGlobals() },
      mode: 'pcap', capList: [], templates: [],
      tunnelsTopo: { enabled: false, ctxs: [{ srcStart: '16.0.0.1', srcEnd: '16.0.0.255',
        initialTeid: 0, teidJump: 1, sport: 5000, version: 4, srcIp: '1.1.1.11', dstIp: '12.2.2.2', activate: true }] }
    };
    var nameM = /#\s*Re-edit:\s*load\s+(.+?)\.trexb\.json/.exec(text);
    if (nameM) { model.meta.name = nameM[1]; }
    var counters = { mapped: 0, total: 0 };
    var unmapped = [];

    var mainIpGen = parseIpGenBlock(text, '');
    if (mainIpGen) { model.ipGen = mainIpGen; counters.mapped++; counters.total++; }
    parseGlobalsInto(text, 'c_glob_info', model.globals.client, counters);
    parseGlobalsInto(text, 's_glob_info', model.globals.server, counters);

    function overrideFor(ipGenVar) {
      if (!ipGenVar || ipGenVar === 'ip_gen') { return null; }
      var sfx = ipGenVar.replace(/^ip_gen/, '');
      return parseIpGenBlock(text, sfx);
    }

    if (/cap_list\s*=\s*\[/.test(text)) {
      model.mode = 'pcap';
      var capRe = /ASTFCapInfo\(([^)]*)\)/g, cm;
      while ((cm = capRe.exec(text))) {
        var a = cm[1];
        model.capList.push({
          file: kwStr(a, 'file') || '', cps: kwNum(a, 'cps'),
          port: kwNum(a, 'port'), sDelayUsec: kwNum(a, 's_delay'),
          ipGenOverride: overrideFor(kwAny(a, 'ip_gen'))
        });
        counters.mapped++; counters.total++;
      }
    } else if (/templates\s*=\s*\[/.test(text)) {
      model.mode = 'program';
      var paymap = parseAstfPayloads(text);
      var progs = parseAstfPrograms(text, paymap);

      var tempC = {}, tempS = {}, tpls = {}, m2;
      var tcRe = /(temp_c\w*)\s*=\s*ASTFTCPClientTemplate\(([^)]*)\)/g;
      while ((m2 = tcRe.exec(text))) {
        var ca = m2[2];
        tempC[m2[1]] = { prog: kwAny(ca, 'program'), ipGen: kwAny(ca, 'ip_gen'),
                         port: kwNum(ca, 'port'), cps: kwNum(ca, 'cps') };
      }
      var tsRe = /(temp_s\w*)\s*=\s*ASTFTCPServerTemplate\(([\s\S]*?)\)\s*$/gm;
      while ((m2 = tsRe.exec(text))) {
        var sa = m2[2];
        var assoc = /assoc\s*=\s*ASTFAssociationRule\((\d+)\)/.exec(sa);
        tempS[m2[1]] = { prog: /program\s*=\s*(prog_s\w*)/.exec(sa) ? RegExp.$1 : null,
                         assocPort: assoc ? parseInt(assoc[1], 10) : null };
      }
      var tplRe = /(template\w*)\s*=\s*ASTFTemplate\(([^)]*)\)/g;
      while ((m2 = tplRe.exec(text))) {
        var ta = m2[2];
        tpls[m2[1]] = { cVar: /client_template\s*=\s*(temp_c\w*)/.exec(ta) ? RegExp.$1 : null,
                        sVar: /server_template\s*=\s*(temp_s\w*)/.exec(ta) ? RegExp.$1 : null,
                        tgName: kwStr(ta, 'tg_name') };
      }
      var listM = /templates\s*=\s*\[([^\]]*)\]/.exec(text);
      var order = listM ? listM[1].split(',').map(function (x) { return x.trim(); }).filter(Boolean) : Object.keys(tpls);
      order.forEach(function (tvar) {
        var tp = tpls[tvar]; if (!tp) { return; }
        var tc = tempC[tp.cVar] || {}, ts = tempS[tp.sVar] || {};
        var pc = progs[tc.prog] || { isUdp: false, commands: [] };
        var ps = progs[ts.prog] || { isUdp: false, commands: [] };
        model.templates.push({
          id: 't_' + (tp.tgName || model.templates.length),
          tgName: tp.tgName || null,
          cps: tc.cps === null || tc.cps === undefined ? 1 : tc.cps,
          assocPort: tc.port !== null && tc.port !== undefined ? tc.port : ts.assocPort,
          stream: !pc.isUdp,
          client: { commands: pc.commands },
          server: { commands: ps.commands },
          ipGenOverride: overrideFor(tc.ipGen)
        });
        counters.mapped++; counters.total++;
      });
    }

    /* coverage: surface body lines we did not consume (foreign files show gaps) */
    var ASKIP = /^(from |import |class |def |return|parser|args =|formatter_class=|ip_gen|dist_|glob=|default_|cap_list|templates|c_glob_info|s_glob_info|prog_[cs]|temp_[cs]|template|ASTF|http_req|http_response|payload|\)|\]|,|#)/;
    text.split(/\r?\n/).forEach(function (raw) {
      var t = raw.trim();
      if (!t || t.charAt(0) === '#') { return; }
      if (ASKIP.test(t)) { return; }
      counters.total++; unmapped.push(t);
    });

    if (!model.capList.length && !model.templates.length) {
      return { ok: false, error: 'Could not recognise any ASTF cap list or templates in this file.' };
    }
    return { ok: true, model: model,
             coverage: counters.total ? counters.mapped / counters.total : 1,
             mapped: counters.mapped, total: counters.total, unmapped: unmapped };
  };
})(typeof window !== 'undefined' ? window : globalThis);
