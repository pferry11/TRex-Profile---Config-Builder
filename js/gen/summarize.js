/* TRex Profile & Config Builder - plain-English summaries of generated artifacts.
 *
 * Pure functions (model) -> [sentence, ...], registered per TRex version so a
 * future version can override phrasing alongside its generators. Used by the
 * output pane ("What this does" box) and embedded as comment lines in
 * generated file headers.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  function n(x, unit) { return x + ' ' + unit + (x === 1 ? '' : 's'); }

  /* ---------------- STL ---------------- */

  function stlRatePhrase(value, unit) {
    if (unit === 'bps_L1') { return value + ' bps (L1)'; }
    if (unit === 'bps_L2') { return value + ' bps (L2)'; }
    if (unit === 'percentage') { return value + '% of line rate'; }
    return value + ' pps';
  }

  function stlModePhrase(m) {
    var rate = stlRatePhrase(m.pps, m.rateUnit);
    if (m.type === 'cont') { return 'transmits continuously at ' + rate; }
    if (m.type === 'single_burst') { return 'sends a single burst of ' + n(m.totalPkts, 'packet') + ' at ' + rate; }
    return 'sends ' + n(m.count, 'burst') + ' of ' + n(m.pktsPerBurst, 'packet') +
      ' at ' + rate + ' (gap ' + m.ibgUsec + ' usec)';
  }

  function stlPacketPhrase(s) {
    var p = s.packet;
    if (p.payload && p.payload.rawScapy) { return 'a raw scapy-defined packet'; }
    var l4 = p.l4.type === 'none' ? (p.l3.type === 'ipv6' ? 'IPv6' : 'IPv4') : p.l4.type.toUpperCase();
    if (p.l4.type === 'icmp') { l4 = 'ICMP ' + (p.l4.icmpKind === 'echo-reply' ? 'echo-reply' : 'echo-request'); }
    var out = p.payload.frameSizeTunable
      ? l4 + ' frames sized by --' + p.payload.frameSizeTunable
      : p.payload.frameSize + '-byte ' + l4 + ' frames';
    out += ' ' + p.l3.src + ' -> ' + p.l3.dst;
    if (p.vlan && p.vlan.enabled) { out += ' on VLAN ' + p.vlan.id; }
    if (p.l3.type === 'ipv4' && (p.l3.moreFrags || (p.l3.fragOffset !== null && p.l3.fragOffset !== undefined && p.l3.fragOffset !== ''))) {
      out += ' (IPv4 fragment)';
    }
    if (p.l3.type === 'ipv6' && p.l3.ext === 'hbh') { out += ' (hop-by-hop ext header)'; }
    if (p.l3.type === 'ipv6' && p.l3.ext === 'frag') { out += ' (fragment ext header)'; }
    var t = p.tunnel || {};
    if (t.type === 'vxlan') { out += ', VXLAN vni ' + t.vni + ' via ' + t.outerSrc + ' -> ' + t.outerDst; }
    else if (t.type === 'gre') { out += ', GRE tunnel ' + t.outerSrc + ' -> ' + t.outerDst; }
    else if (t.type === 'mpls') { out += ', MPLS label ' + t.label; }
    else if (t.type === 'qinq') { out += ', QinQ outer VLAN ' + t.outerVlanId; }
    else if (t.type === 'nsh') { out += ', NSH spi ' + t.spi + ' si ' + t.si; }
    return out;
  }

  function stlStreamExtras(s) {
    var out = [];
    (s.vm && s.vm.vars ? s.vm.vars : []).forEach(function (v) {
      var verb = v.op === 'random' ? 'randomises' : (v.op === 'dec' ? 'sweeps down' : 'sweeps');
      var extra = '';
      if (v.nextVar) { extra += ' (steps ' + v.nextVar + ' on wrap)'; }
      if (v.splitToCores === false) { extra += ' (not split per core)'; }
      out.push(verb + ' ' + v.writeTo + ' over ' + v.min + '-' + v.max + extra);
    });
    if (s.vm && s.vm.tuple) {
      var t = s.vm.tuple;
      out.push('generates client tuples ' + t.ipMin + '-' + t.ipMax + ' ports ' + t.portMin + '-' + t.portMax +
        ' (limit ' + t.limitFlows + ' flows)');
    }
    if (s.isgUsec) { out.push('starts ' + s.isgUsec + ' usec in'); }
    if (s.chain && s.chain.selfStart === false) { out.push('waits to be triggered'); }
    if (s.chain && s.chain.next) {
      out.push('then triggers ' + s.chain.next +
        (s.chain.actionCount ? ' (' + n(s.chain.actionCount, 'loop') + ')' : ''));
    }
    if (s.flowStats && s.flowStats.type === 'stats') {
      out.push('per-flow counters on pg_id ' + s.flowStats.pgId + (s.flowStats.addPortId ? ' + port_id' : ''));
    }
    if (s.flowStats && s.flowStats.type === 'latency') {
      out.push('latency measured on pg_id ' + s.flowStats.pgId + (s.flowStats.addPortId ? ' + port_id' : ''));
    }
    return out;
  }

  function stl(model) {
    var lines = [];
    if (model.pcapReplay && model.pcapReplay.enabled) {
      var r = model.pcapReplay;
      var ipgPart = (r.ipgUsec === null || r.ipgUsec === undefined || r.ipgUsec === '')
        ? "at the pcap's native timing" + (r.speedup && r.speedup !== 1 ? ' (speedup x' + r.speedup + ')' : '')
        : 'at ' + r.ipgUsec + ' usec between packets';
      var loopPart = r.loopCount === 0 ? 'looped forever' : 'looped ' + n(r.loopCount, 'time');
      return ['Replays ' + (r.file || '<no pcap set>') + ' as stateless streams ' + ipgPart + ', ' + loopPart + '.',
              'Override at load time with -t ipg_usec=...,loop_count=...'];
    }
    var enabled = (model.streams || []).filter(function (s) { return s.enabled !== false; });
    if (!enabled.length) { return ['Empty profile: no enabled streams.']; }
    enabled.forEach(function (s) {
      var extras = stlStreamExtras(s);
      lines.push(s.name + ': ' + stlModePhrase(s.mode) + ' - ' + stlPacketPhrase(s) +
        (extras.length ? '; ' + extras.join('; ') : '') + '.');
    });
    /* aggregate per rate unit so mixed-unit profiles stay honest, e.g.
     * "48 pps + 25% of line rate at -m 1" */
    var aggByUnit = {};
    var unitOrder = [];
    enabled.forEach(function (s) {
      if (s.mode.type === 'cont' && !(s.chain && s.chain.selfStart === false)) {
        var u = s.mode.rateUnit || 'pps';
        if (!(u in aggByUnit)) { aggByUnit[u] = 0; unitOrder.push(u); }
        aggByUnit[u] += s.mode.pps;
      }
    });
    if (unitOrder.length) {
      var parts = unitOrder.map(function (u) { return stlRatePhrase(aggByUnit[u], u); });
      lines.push('Aggregate self-starting continuous rate: ' + parts.join(' + ') + ' at -m 1.');
    }
    if (model.tunables && model.tunables.length) {
      lines.push('Tunables: ' + model.tunables.map(function (t) { return '--' + t.name; }).join(', ') + '.');
    }
    if (enabled.some(function (s) { return s.flowStats && s.flowStats.type === 'latency'; })) {
      lines.push('Latency streams keep their fixed pps and ignore the -m multiplier.');
    }
    return lines;
  }

  /* ---------------- ASTF ---------------- */

  function astfCmdPhrase(c) {
    switch (c.op) {
      case 'send': case 'send_msg': {
        var p = c.payload || {};
        if (p.kind === 'httpRequest') { return 'sends an HTTP request'; }
        if (p.kind === 'httpResponse') { return 'sends an HTTP response with a ' + (p.bodyBytes || 0) + '-byte body'; }
        return 'sends ' + ((p.text || '').length) + ' bytes';
      }
      case 'recv':
        return (c.bytes === null || c.bytes === undefined) ? 'receives the peer payload' : 'receives ' + c.bytes + ' bytes';
      case 'recv_msg': return 'receives ' + n(c.count || 1, 'message');
      case 'delay': return 'waits ' + (c.usec / 1000) + ' ms';
      case 'delay_rand': return 'waits ' + (c.minUsec / 1000) + '-' + (c.maxUsec / 1000) + ' ms';
      case 'jmp_nz': return 'loops back to ' + c.label + ' while ' + c.id + ' > 0';
      case 'wait_for_peer_close': return 'waits for the peer to close';
      default: return null; /* set_var / set_label are loop plumbing */
    }
  }

  function astfProgPhrase(prog) {
    var parts = [];
    (prog.commands || []).forEach(function (c) {
      var p = astfCmdPhrase(c);
      if (p) { parts.push(p); }
    });
    return parts.join(', ');
  }

  function astf(model) {
    var lines = [];
    var g = model.ipGen;
    var rangePart = 'clients ' + g.client.start + '-' + g.client.end + ' talk to servers ' +
      g.server.start + '-' + g.server.end;
    var total = 0;

    if (model.mode === 'pcap') {
      var caps = model.capList || [];
      lines.push('Replays ' + n(caps.length, 'pcap template') + '; ' + rangePart + '.');
      caps.forEach(function (c) {
        total += c.cps || 0;
        lines.push(((c.file || '?').split('/').pop()) + ': ' + c.cps + ' connections/s at -m 1' +
          (c.port !== null && c.port !== undefined && c.port !== '' ? ', pinned to port ' + c.port : '') +
          (c.sDelayUsec ? ', server delayed ' + c.sDelayUsec + ' usec' : '') + '.');
      });
    } else {
      var tmpls = model.templates || [];
      lines.push('Runs ' + n(tmpls.length, 'program-defined template') + '; ' + rangePart + '.');
      tmpls.forEach(function (t, i) {
        total += t.cps || 0;
        lines.push((t.tgName || 'template ' + (i + 1)) + ' (port ' + t.assocPort + ', ' +
          (t.stream === false ? 'UDP' : 'TCP') + '): client ' + astfProgPhrase(t.client) +
          '; server ' + astfProgPhrase(t.server) + '; ' + t.cps + ' cps at -m 1.');
      });
    }
    lines.push('Total offered load: ' + Math.round(total * 1000) / 1000 + ' connections/s at -m 1.');

    if (model.tunnelsTopo && model.tunnelsTopo.enabled) {
      var ctxs = model.tunnelsTopo.ctxs || [];
      var parts = ctxs.map(function (c) {
        return c.srcStart + '-' + c.srcEnd + ' via ' + c.srcIp + ' -> ' + c.dstIp +
          ' (TEIDs from ' + c.initialTeid + ' step ' + c.teidJump + ')' +
          (c.activate === false ? ' [inactive]' : '');
      });
      lines.push('GTP-U tunnel topology (' + n(ctxs.length, 'context') + '): ' + parts.join('; ') +
        '. Load the _topo.py file first: tunnels_topo load -f <file>.');
    }

    var cg = model.globals && model.globals.client;
    if (cg && cg.scheduler && cg.scheduler.rampupSec) {
      lines.push('CPS ramps linearly to the full rate over ' + cg.scheduler.rampupSec + ' s (client side).');
    }
    ['client', 'server'].forEach(function (side) {
      var s = model.globals && model.globals[side];
      if (!s || !s.tcp) { return; }
      var tuned = [];
      for (var k in s.tcp) {
        if (Object.prototype.hasOwnProperty.call(s.tcp, k) && s.tcp[k] !== null && s.tcp[k] !== undefined && s.tcp[k] !== '') {
          tuned.push(k + '=' + s.tcp[k]);
        }
      }
      if (tuned.length) { lines.push('TCP tuning (' + side + '): ' + tuned.join(', ') + '.'); }
      if (s.ipv6 && s.ipv6.enable) { lines.push('IPv6 enabled on the ' + side + ' side.'); }
    });
    return lines;
  }

  /* ---------------- cap2 ---------------- */

  function cap2(model) {
    var lines = [];
    var g = model.generator;
    lines.push('Legacy STF replay for ' + model.duration + ' s; clients ' + g.clientsStart + '-' + g.clientsEnd +
      ' talk to servers ' + g.serversStart + '-' + g.serversEnd + ' (' + (g.distribution || 'seq') + ').');
    (model.capInfo || []).forEach(function (c) {
      var line = (c.name || '?').split('/').pop() + ': ' + c.cps + ' flows/s, ipg ' + c.ipg +
        ' usec, rtt ' + c.rtt + ' usec, weight ' + c.w;
      if (c.limit !== null && c.limit !== undefined && c.limit !== '') { line += ', max ' + c.limit + ' active flows'; }
      if (c.plugin_id === 4) { line += ', HTTP plugin'; }
      if (c.plugin_id === 5) { line += ', DHCP plugin'; }
      lines.push(line + '.');
      (c.dynPyload || []).forEach(function (d) {
        lines.push('  rewrites ' + n(d.len, 'uint32') + ' at payload offset ' + d.pyldOffset +
          ' of packet ' + d.pktId + ' with ' + (d.type === 1 ? 'the client IP' : 'random data') +
          ' (mask ' + d.mask + ').');
      });
    });
    var f = model.flags || {};
    if (f.capIpg === true) { lines.push("Uses each pcap's own inter-packet gaps."); }
    if (f.capOverrideIpg !== null && f.capOverrideIpg !== undefined && f.capOverrideIpg !== '') {
      lines.push('Overrides inter-packet gaps to ' + f.capOverrideIpg + ' usec.');
    }
    if (f.vlan && f.vlan.enabled) { lines.push('VLAN load-balancing with tags ' + f.vlan.vlan0 + '/' + f.vlan.vlan1 + '.'); }
    if (f.macOverrideByIp !== null && f.macOverrideByIp !== undefined && f.macOverrideByIp !== '') {
      lines.push('MAC addresses derived from IPs (mac_override_by_ip ' + f.macOverrideByIp + ').');
    }
    return lines;
  }

  /* ---------------- cfg (server object) ---------------- */

  function cfg(server) {
    var lines = [];
    lines.push(((server.interfaces || []).length) + '-port platform config on PCI ' +
      (server.interfaces || []).join(', ') +
      (server.cores ? '; ' + n(server.cores, 'core') + ' per dual-interface' : '') +
      (server.portBandwidthGb ? '; ' + server.portBandwidthGb + ' Gb ports' : '') + '.');
    (server.ports || []).forEach(function (p, i) {
      if (p.mode === 'mac') {
        lines.push('Port ' + i + ': L2 mode, src ' + (p.srcMac || '?') + ' -> dest ' + (p.destMac || '?') + '.');
      } else {
        lines.push('Port ' + i + ': L3 mode, ip ' + (p.ip || '?') + ' via gateway ' + (p.defaultGw || '?') + '.');
      }
    });
    if (server.platform && server.platform.enabled) {
      var socks = (server.platform.dualIf || []).map(function (d) {
        return 'socket ' + d.socket + ' threads [' + (d.threads || []).join(',') + ']';
      });
      lines.push('Thread pinning: master ' + server.platform.masterThreadId + ', latency ' +
        server.platform.latencyThreadId + '; ' + socks.join('; ') + '.');
    }
    if (server.memory && server.memory.enabled && server.memory.dpFlows) {
      lines.push('Memory sized for ' + server.memory.dpFlows + ' data-plane flows.');
    }
    if (server.limitMemory) { lines.push('Memory capped at ' + server.limitMemory + ' MB.'); }
    return lines;
  }

  /* ---------------- cli ---------------- */

  function cli(model) {
    var lines = [];
    var cores = (model.cores !== null && model.cores !== undefined && model.cores !== '') ? model.cores : 4;
    if (model.mode === 'legacy') {
      lines.push('Runs the legacy STF profile ' + (model.profile || '<profile>') +
        (model.durationSec ? ' for ' + model.durationSec + ' s' : '') +
        ' at multiplier ' + (model.mult || 1) + ' with ' + n(cores, 'core') +
        (model.latencyPps ? ', latency probes at ' + model.latencyPps + ' pps' : '') +
        (model.flowPortAffinity ? ', flow-port affinity on' : '') + '.');
    } else {
      var role = '';
      if (model.mode === 'astf' && model.astfServerOnly) { role = ' as the SERVER side only (answers connections, sends no load)'; }
      else if (model.mode === 'astf' && model.astfClientMask) { role = ' as the client side on port mask ' + model.astfClientMask; }
      lines.push('Starts TRex interactively in ' + model.mode.toUpperCase() + ' mode with ' + n(cores, 'core') +
        (model.cfgPath ? ' using ' + model.cfgPath : '') + role + '.');
      if (!(model.mode === 'astf' && model.astfServerOnly)) {
        lines.push('The console then starts ' + (model.profile || '<profile>') + ' at -m ' + (model.mult || 1) +
          (model.durationSec ? ' for ' + model.durationSec + ' s' : '') + '.');
      }
    }
    return lines;
  }

  /* ---------------- registry + dispatcher ---------------- */

  TB.gen.registry['3.06'] = TB.gen.registry['3.06'] || {};
  TB.gen.registry['3.06'].summarize = { stl: stl, astf: astf, cap2: cap2, cfg: cfg, cli: cli };

  var KIND_MAP = { stl: 'stl', astf: 'astf', cap2: 'cap2', server: 'cfg', cli: 'cli' };

  TB.gen.summary = function (model) {
    if (!model || !model.kind) { return []; }
    var key = KIND_MAP[model.kind];
    if (!key) { return []; }
    var version = model.trexVersion || TB.gen.versions()[0];
    var set = TB.gen.registry[version];
    if (!set || !set.summarize || !set.summarize[key]) { return []; }
    try {
      return set.summarize[key](model);
    } catch (e) {
      return [];
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
