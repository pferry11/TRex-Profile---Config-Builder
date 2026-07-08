/* TRex Profile & Config Builder - trex_cfg.yaml platform config generator (TRex v3.06).
 *
 * Input is a server object from the settings registry (see js/core/settings.js).
 * CRITICAL FORMAT RULE: trex_cfg.yaml is a single-element YAML LIST - the first
 * key line starts with "- " and every other top-level key aligns under it.
 * TRex rejects the file without the leading dash.
 * Registered as TB.gen.registry["3.06"].cfg.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  var PCI_RE = /^([0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-9a-fA-F]$/;

  function pad(key, width) {
    return key.length >= width ? key : key + new Array(width - key.length + 1).join(' ');
  }

  function macToBytes(mac) {
    if (!TB.util.isMac(mac)) { return null; }
    return '[' + mac.split(':').map(function (b) { return '0x' + b.toLowerCase(); }).join(',') + ']';
  }

  function topKey(key, value) {
    return '  ' + pad(key, 16) + ' : ' + value;
  }

  function collectWarnings(server) {
    var w = [];
    var i;
    var ifaces = server.interfaces || [];
    for (i = 0; i < ifaces.length; i++) {
      if (!PCI_RE.test(ifaces[i])) {
        w.push('Interface "' + ifaces[i] + '" is not a valid PCI address (expected hh:hh.h or hhhh:hh:hh.h).');
      }
    }
    if (server.portLimit && ifaces.length !== server.portLimit) {
      w.push('port_limit is ' + server.portLimit + ' but ' + ifaces.length + ' interface(s) are listed.');
    }

    var ports = server.ports || [];
    for (i = 0; i + 1 < ports.length; i += 2) {
      var a = ports[i], b = ports[i + 1];
      if (a.mode !== b.mode) {
        w.push('Ports ' + i + ' and ' + (i + 1) + ' mix MAC and IP mode; TRex expects a consistent pair.');
      }
      if (a.mode === 'mac' && b.mode === 'mac' &&
          TB.util.isMac(a.srcMac) && TB.util.isMac(a.destMac) &&
          TB.util.isMac(b.srcMac) && TB.util.isMac(b.destMac)) {
        var crossed = a.destMac.toLowerCase() === b.srcMac.toLowerCase() &&
                      b.destMac.toLowerCase() === a.srcMac.toLowerCase();
        if (!crossed) {
          w.push('Ports ' + i + '/' + (i + 1) + ' MACs are not cross-wired (typical loopback convention: ' +
            'port A dest_mac = port B src_mac and vice versa). Fine if traffic goes via a router/DUT.');
        }
      }
    }
    for (i = 0; i < ports.length; i++) {
      if (ports[i].mode === 'mac') {
        if (!TB.util.isMac(ports[i].srcMac)) { w.push('Port ' + i + ': src_mac "' + (ports[i].srcMac || '') + '" is not a valid MAC.'); }
        if (!TB.util.isMac(ports[i].destMac)) { w.push('Port ' + i + ': dest_mac "' + (ports[i].destMac || '') + '" is not a valid MAC.'); }
      } else {
        if (!TB.util.isIpv4(ports[i].ip)) { w.push('Port ' + i + ': ip "' + (ports[i].ip || '') + '" is not a valid IPv4 address.'); }
        if (!TB.util.isIpv4(ports[i].defaultGw)) { w.push('Port ' + i + ': default_gw "' + (ports[i].defaultGw || '') + '" is not a valid IPv4 address.'); }
      }
    }

    var p = server.platform;
    if (p && p.enabled) {
      var all = [];
      (p.dualIf || []).forEach(function (d) { all = all.concat(d.threads || []); });
      if (all.indexOf(p.masterThreadId) !== -1) {
        w.push('platform: master_thread_id ' + p.masterThreadId + ' is also listed in dual_if threads.');
      }
      if (all.indexOf(p.latencyThreadId) !== -1) {
        w.push('platform: latency_thread_id ' + p.latencyThreadId + ' is also listed in dual_if threads.');
      }
      if (p.masterThreadId === p.latencyThreadId) {
        w.push('platform: master_thread_id and latency_thread_id are the same core.');
      }
      if (server.cores && all.length && server.cores > all.length) {
        w.push('c=' + server.cores + ' exceeds the ' + all.length + ' thread(s) listed in dual_if.');
      }
    }
    return w;
  }

  function generate(server, opts) {
    opts = opts || {};
    var warnings = collectWarnings(server);
    var safeName = (server.name || 'server').replace(/[^\w.-]+/g, '_');
    var fileName = 'trex_cfg_' + safeName + '.yaml';
    var set = function (v) { return v !== null && v !== undefined && v !== ''; };

    var lines = [
      '# ' + new Array(78).join('-'),
      '# TRex Profile & Config Builder - platform config (trex_cfg.yaml)',
      '# Generated: ' + (opts.now || TB.util.todayIso()) + '   Target: TRex v' + (opts.trexVersion || '3.06'),
      '# Server: ' + (server.name || '?') + (server.mgmtHost ? ' (' + server.mgmtHost + ')' : ''),
      '# Install as /etc/trex_cfg.yaml (or pass --cfg <path> to t-rex-64)',
      '# Find PCI addresses with: ./dpdk_setup_ports.py -s'
    ];
    var sumSet = TB.gen.registry[opts.trexVersion || '3.06'];
    var sentences = (sumSet && sumSet.summarize && sumSet.summarize.cfg) ? sumSet.summarize.cfg(server) : [];
    lines = lines.concat(TB.gen.py.summaryComment(sentences));
    lines.push('# ' + new Array(78).join('-'));

    /* first key carries the mandatory leading dash of the single-element list */
    var body = [];
    body.push(topKey('version', '2'));
    body.push(topKey('interfaces', '[' + (server.interfaces || []).map(function (x) { return '"' + x + '"'; }).join(', ') + ']'));
    if (set(server.portLimit)) { body.push(topKey('port_limit', String(server.portLimit))); }
    if (set(server.cores)) { body.push(topKey('c', String(server.cores))); }
    if (set(server.portBandwidthGb)) { body.push(topKey('port_bandwidth_gb', String(server.portBandwidthGb))); }
    if (set(server.limitMemory)) { body.push(topKey('limit_memory', String(server.limitMemory))); }
    if (set(server.prefix)) { body.push(topKey('prefix', String(server.prefix))); }
    if (server.enableZmqPub === true) { body.push(topKey('enable_zmq_pub', 'true')); }
    if (set(server.telnetPort)) { body.push(topKey('telnet_port', String(server.telnetPort))); }

    var p = server.platform;
    if (p && p.enabled) {
      body.push('  platform :');
      body.push('      ' + pad('master_thread_id', 18) + ' : ' + p.masterThreadId);
      body.push('      ' + pad('latency_thread_id', 18) + ' : ' + p.latencyThreadId);
      body.push('      dual_if :');
      (p.dualIf || []).forEach(function (d) {
        body.push('          - ' + pad('socket', 8) + ' : ' + d.socket);
        body.push('            ' + pad('threads', 8) + ' : [' + (d.threads || []).join(',') + ']');
      });
    }

    if (server.memory && server.memory.enabled && set(server.memory.dpFlows)) {
      body.push('  memory :');
      body.push('      dp_flows : ' + server.memory.dpFlows);
    }

    var ports = server.ports || [];
    if (ports.length) {
      body.push('  port_info :');
      ports.forEach(function (port, idx) {
        if (port.mode === 'mac') {
          var dest = macToBytes(port.destMac) || '[0x00,0x00,0x00,0x00,0x00,0x00]';
          var src = macToBytes(port.srcMac) || '[0x00,0x00,0x00,0x00,0x00,0x00]';
          body.push('      - ' + pad('dest_mac', 8) + ' : ' + dest + '  # port ' + idx);
          body.push('        ' + pad('src_mac', 8) + ' : ' + src);
        } else {
          body.push('      - ' + pad('ip', 10) + ' : ' + (port.ip || '0.0.0.0') + '  # port ' + idx);
          body.push('        ' + pad('default_gw', 10) + ' : ' + (port.defaultGw || '0.0.0.0'));
        }
      });
    }

    /* convert the first body line into the leading-dash form: "- key ..." */
    body[0] = '- ' + body[0].slice(2);
    lines = lines.concat(body);
    lines.push('');

    return {
      files: [{ name: fileName, language: 'yaml', content: lines.join('\n') }],
      warnings: warnings
    };
  }

  TB.gen.register('3.06', 'cfg', generate);
})(typeof window !== 'undefined' ? window : globalThis);
