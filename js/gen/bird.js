/* TRex Profile & Config Builder - BIRD routing config generator (TRex v3.06).
 *
 * Emits bird_<name>.conf (BGP / OSPF / RIP / static-route protocol blocks in
 * the exact shapes of the shipped bird/cfg examples) plus a BIRD_RUNBOOK.txt.
 * TRex runs BIRD in a Linux network namespace: trex_cfg.yaml needs
 * "stack: linux_based", the server starts with --bird-server, and the console
 * bird plugin (plugins load bird) creates veth nodes and pushes the config
 * (verified against console/plugins/plugin_bird.py and doc_stl/api/bird_node.rst).
 * Registered as TB.gen.registry["3.06"].bird.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  /* Emitting a million route lines would hang the browser; above this count
   * the runbook's --total-routes path (server-side generation) is the tool. */
  var MAX_EMITTED_ROUTES = 5000;

  function set(v) { return v !== null && v !== undefined && v !== ''; }

  function ip4ToInt(s) {
    var p = s.split('.');
    return ((+p[0]) * 16777216) + ((+p[1]) * 65536) + ((+p[2]) * 256) + (+p[3]);
  }

  function intToIp4(n) {
    return [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256,
            Math.floor(n / 256) % 256, n % 256].join('.');
  }

  function collectWarnings(model) {
    var w = [];
    if (!TB.util.isIpv4(model.routerId)) {
      w.push('router id "' + (model.routerId || '') + '" is not in IPv4 form (BIRD requires a dotted-quad router id).');
    }
    (model.bgp || []).forEach(function (b, i) {
      var label = 'BGP instance ' + (i + 1) + ' (' + (b.name || '?') + ')';
      var check = b.ipv6 ? TB.util.isIpv6 : TB.util.isIpv4;
      if (!check(b.localIp)) { w.push(label + ': local IP "' + (b.localIp || '') + '" is not valid ' + (b.ipv6 ? 'IPv6' : 'IPv4') + '.'); }
      if (!check(b.neighborIp)) { w.push(label + ': neighbor IP "' + (b.neighborIp || '') + '" is not valid ' + (b.ipv6 ? 'IPv6' : 'IPv4') + '.'); }
      [['local AS', b.localAs], ['neighbor AS', b.neighborAs]].forEach(function (a) {
        if (!set(a[1]) || a[1] < 1 || a[1] > 4294967295) { w.push(label + ': ' + a[0] + ' must be 1-4294967295.'); }
      });
    });
    var names = {};
    (model.bgp || []).forEach(function (b) {
      var n = b.name || '';
      if (names[n]) { w.push('Two BGP instances share the name "' + n + '" - BIRD protocol names must be unique.'); }
      names[n] = true;
    });
    (model.staticRoutes || []).forEach(function (r, i) {
      var label = 'Static route block ' + (i + 1);
      if (r.ipv6) {
        if (!TB.util.isIpv6(r.prefix)) { w.push(label + ': prefix "' + (r.prefix || '') + '" is not valid IPv6.'); }
        if (!TB.util.isIpv6(r.nextHop)) { w.push(label + ': next hop "' + (r.nextHop || '') + '" is not valid IPv6.'); }
        if (!set(r.prefixLen) || r.prefixLen < 1 || r.prefixLen > 128) { w.push(label + ': prefix length must be 1-128.'); }
        if (set(r.count) && r.count > 1) {
          w.push(label + ': route generation (count > 1) is IPv4-only in this builder; the IPv6 block emits one route.');
        }
      } else {
        if (!TB.util.isIpv4(r.prefix)) { w.push(label + ': prefix "' + (r.prefix || '') + '" is not valid IPv4.'); }
        if (!TB.util.isIpv4(r.nextHop)) { w.push(label + ': next hop "' + (r.nextHop || '') + '" is not valid IPv4.'); }
        if (!set(r.prefixLen) || r.prefixLen < 1 || r.prefixLen > 32) { w.push(label + ': prefix length must be 1-32.'); }
      }
      if (!set(r.count) || r.count < 1) { w.push(label + ': route count must be at least 1.'); }
      if (!r.ipv6 && set(r.count) && r.count > MAX_EMITTED_ROUTES) {
        w.push(label + ': ' + r.count + ' routes requested; only the first ' + MAX_EMITTED_ROUTES +
          ' are written to the file. For big tables generate server-side: plugins bird set_config -f <conf> ' +
          '--first-ip ' + (r.prefix || '<ip>') + ' --total-routes ' + r.count + ' --next-hop ' + (r.nextHop || '<ip>') + '.');
      }
    });
    var any = (model.bgp || []).length || (model.ospf && model.ospf.enabled) ||
      (model.rip && model.rip.enabled) || (model.staticRoutes || []).length;
    if (!any) { w.push('No protocols or routes defined - the config only answers device scans.'); }

    var node = model.node || {};
    if (!TB.util.isMac(node.mac)) { w.push('Bird node MAC "' + (node.mac || '') + '" is not a valid MAC (used by add_node in the runbook).'); }
    if (!TB.util.isIpv4(node.ipv4)) { w.push('Bird node IPv4 "' + (node.ipv4 || '') + '" is not valid (used by add_node in the runbook).'); }
    return w;
  }

  function channelBlock(af, indent) {
    return [indent + af + ' {',
            indent + '    import all;',
            indent + '    export all;',
            indent + '};'];
  }

  function generate(model, opts) {
    opts = opts || {};
    var warnings = collectWarnings(model);
    var name = (model.meta && model.meta.name) ? model.meta.name : 'bird';
    var fileBase = name.replace(/[^\w.-]+/g, '_');
    var confName = 'bird_' + fileBase + '.conf';
    var now = opts.now || TB.util.todayIso();
    var trexVersion = model.trexVersion || '3.06';

    var lines = [
      '# ' + new Array(78).join('-'),
      '# TRex Profile & Config Builder - BIRD routing config',
      '# Generated: ' + now + '   Target: TRex v' + trexVersion + ' (BIRD integration)',
      '# Push from trex-console: plugins bird set_config -f ' + confName,
      '# Re-edit: load ' + fileBase + '.trexb.json in TRex Profile & Config Builder'
    ];
    var sumSet = TB.gen.registry[trexVersion];
    var sentences = (sumSet && sumSet.summarize && sumSet.summarize.bird) ? sumSet.summarize.bird(model) : [];
    lines = lines.concat(TB.gen.py.summaryComment(sentences));
    lines.push('# ' + new Array(78).join('-'));
    lines.push('');
    lines.push('router id ' + (model.routerId || '100.100.100.100') + ';');
    lines.push('');
    lines.push('# device scan keeps BIRD tracking the veth interfaces TRex creates');
    lines.push('protocol device {');
    lines.push('    scan time 1;');
    lines.push('}');

    (model.bgp || []).forEach(function (b) {
      lines.push('');
      lines.push('protocol bgp ' + (b.name || 'my_bgp') + ' {');
      lines.push('    local ' + (b.localIp || '?') + ' as ' + (set(b.localAs) ? b.localAs : '?') + ';');
      lines.push('    neighbor ' + (b.neighborIp || '?') + ' as ' + (set(b.neighborAs) ? b.neighborAs : '?') + ';');
      lines = lines.concat(channelBlock(b.ipv6 ? 'ipv6' : 'ipv4', '    '));
      lines.push('}');
    });

    if (model.ospf && model.ospf.enabled) {
      lines.push('');
      lines.push('protocol ospf {');
      lines = lines.concat(channelBlock('ipv4', '    '));
      lines.push('    area ' + (set(model.ospf.area) ? model.ospf.area : 0) + ' {');
      lines.push('        interface "*" {');
      lines.push('            type broadcast;');
      lines.push('        };');
      lines.push('    };');
      lines.push('}');
    }

    if (model.rip && model.rip.enabled) {
      lines.push('');
      lines.push('protocol rip {');
      lines = lines.concat(channelBlock('ipv4', '    '));
      lines.push('    interface "*" {');
      lines.push('        mode multicast;');
      lines.push('    };');
      lines.push('}');
    }

    var v4Routes = (model.staticRoutes || []).filter(function (r) { return !r.ipv6; });
    var v6Routes = (model.staticRoutes || []).filter(function (r) { return r.ipv6; });
    if (v4Routes.length) {
      lines.push('');
      lines.push('protocol static {');
      lines = lines.concat(channelBlock('ipv4', '    '));
      lines.push('');
      v4Routes.forEach(function (r) {
        if (!TB.util.isIpv4(r.prefix) || !set(r.prefixLen)) { return; }
        var count = Math.min(set(r.count) ? r.count : 1, MAX_EMITTED_ROUTES);
        var step = Math.pow(2, 32 - r.prefixLen);
        var base = ip4ToInt(r.prefix);
        for (var i = 0; i < count; i++) {
          var addr = base + i * step;
          if (addr > 4294967295) { break; }
          lines.push('    route ' + intToIp4(addr) + '/' + r.prefixLen + ' via ' + (r.nextHop || '?') + ';');
        }
      });
      lines.push('}');
    }
    if (v6Routes.length) {
      lines.push('');
      lines.push('protocol static {');
      lines = lines.concat(channelBlock('ipv6', '    '));
      lines.push('');
      v6Routes.forEach(function (r) {
        lines.push('    route ' + (r.prefix || '?') + '/' + (set(r.prefixLen) ? r.prefixLen : 64) +
          ' via ' + (r.nextHop || '?') + ';');
      });
      lines.push('}');
    }
    lines.push('');

    /* ---- runbook ---- */
    var node = model.node || {};
    var trexDir = model.trexDir || '/opt/trex/v3.06';
    var addNode = 'plugins bird add_node -p ' + (set(node.port) ? node.port : 0) +
      ' -m ' + (node.mac || '00:00:00:01:00:07') +
      ' --ipv4 ' + (node.ipv4 || '1.1.1.3') +
      ' --ipv4-subnet ' + (set(node.ipv4Subnet) ? node.ipv4Subnet : 24);
    if (node.ipv6Enabled) {
      addNode += ' --ipv6-enable --ipv6 ' + (node.ipv6 || '::1') +
        ' --ipv6-subnet ' + (set(node.ipv6Subnet) ? node.ipv6Subnet : 124);
    }
    var runbook = [
      '# ' + new Array(78).join('-'),
      '# TRex Profile & Config Builder - BIRD routing runbook',
      '# Generated: ' + now + '   Target: TRex v' + trexVersion,
      '# BIRD runs inside TRex; routes learned/advertised flow through the DUT.',
      '# ' + new Array(78).join('-'),
      '',
      '# 0) PREREQUISITE - trex_cfg.yaml must use the Linux namespace stack:',
      '#        stack: linux_based',
      '#    (top-level key in /etc/trex_cfg.yaml, next to port_info)',
      '',
      '# 1) start the TRex server with the PyBird server:',
      'cd ' + trexDir,
      'sudo ./t-rex-64 -i --bird-server',
      '',
      '# 2) SECOND terminal - console; load the bird plugin:',
      'cd ' + trexDir,
      './trex-console',
      'trex>plugins load bird',
      '',
      '# 3) give BIRD an interface on the traffic port (a veth in its namespace):',
      'trex>' + addNode,
      '',
      '# 4) push this config:',
      'trex>plugins bird set_config -f ' + confName,
      '',
      '#    for very large route tables, generate them server-side instead of',
      '#    writing every line into the conf:',
      '# trex>plugins bird set_config -f ' + confName + ' --first-ip 10.10.10.0 --total-routes 1000000 --next-hop ' + (node.ipv4 || '1.1.1.3'),
      '',
      '# 5) verify:',
      'trex>plugins bird show_protocols',
      'trex>plugins bird show_nodes -p ' + (set(node.port) ? node.port : 0),
      'trex>plugins bird show_config',
      ''
    ];

    return {
      files: [
        { name: confName, language: 'shell', content: lines.join('\n') },
        { name: 'BIRD_RUNBOOK.txt', language: 'shell', content: runbook.join('\n') }
      ],
      warnings: warnings
    };
  }

  TB.gen.register('3.06', 'bird', generate);
})(typeof window !== 'undefined' ? window : globalThis);
