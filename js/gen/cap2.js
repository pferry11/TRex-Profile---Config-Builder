/* TRex Profile & Config Builder - cap2 legacy STF YAML profile generator (TRex v3.06).
 *
 * These profiles replay pcap templates with IP rewriting and are run with:
 *   t-rex-64 -f <profile.yaml> -d <duration> --cfg /etc/trex_cfg.yaml
 * CRITICAL FORMAT RULE: like trex_cfg.yaml, a cap2 profile is a single-element
 * YAML LIST (mandatory leading "- " on the first key).
 * Registered as TB.gen.registry["3.06"].cap2.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  function pad(key, width) {
    return key.length >= width ? key : key + new Array(width - key.length + 1).join(' ');
  }

  function ip2num(ip) {
    var p = ip.split('.');
    return ((+p[0]) << 24 >>> 0) + ((+p[1]) << 16) + ((+p[2]) << 8) + (+p[3]);
  }

  function durationStr(d) {
    var n = Number(d);
    return (isFinite(n) && Number.isInteger(n)) ? n + '.0' : String(d);
  }

  function collectWarnings(model) {
    var w = [];
    var g = model.generator;
    ['clientsStart', 'clientsEnd', 'serversStart', 'serversEnd'].forEach(function (k) {
      if (!TB.util.isIpv4(g[k])) { w.push('generator: ' + k + ' "' + (g[k] || '') + '" is not a valid IPv4 address.'); }
    });
    if (TB.util.isIpv4(g.clientsStart) && TB.util.isIpv4(g.clientsEnd) &&
        TB.util.isIpv4(g.serversStart) && TB.util.isIpv4(g.serversEnd)) {
      var cs = ip2num(g.clientsStart), ce = ip2num(g.clientsEnd);
      var ss = ip2num(g.serversStart), se = ip2num(g.serversEnd);
      if (cs > ce) { w.push('generator: clients_start is above clients_end.'); }
      if (ss > se) { w.push('generator: servers_start is above servers_end.'); }
      if (Math.max(cs, ss) <= Math.min(ce, se)) {
        w.push('generator: client and server IP ranges overlap; TRex needs disjoint ranges.');
      }
    }
    if (!(model.duration > 0)) { w.push('duration must be greater than 0.'); }

    (model.capInfo || []).forEach(function (c, i) {
      var label = 'cap_info[' + i + '] (' + (c.name || '?') + ')';
      if (!(c.cps > 0)) { w.push(label + ': cps must be greater than 0.'); }
      if (!c.name) { w.push(label + ': pcap path is required.'); }
      if (c.plugin_id === 4 && c.name && c.name.toLowerCase().indexOf('http') === -1) {
        w.push(label + ': plugin_id 4 is the HTTP plugin but the pcap name does not mention http (hint only).');
      }
      if (c.plugin_id === 5 && c.name && c.name.toLowerCase().indexOf('dhcp') === -1) {
        w.push(label + ': plugin_id 5 is the DHCP plugin but the pcap name does not mention dhcp (hint only).');
      }
      (c.dynPyload || []).forEach(function (d, j) {
        if (d.pyldOffset > 1400) {
          w.push(label + ' dyn_pyload[' + j + ']: offset ' + d.pyldOffset + ' is beyond a typical payload (hint only).');
        }
        if (d.type !== 0 && d.type !== 1) {
          w.push(label + ' dyn_pyload[' + j + ']: type must be 0 (random) or 1 (client_ip).');
        }
      });
    });
    return w;
  }

  function generate(model, opts) {
    opts = opts || {};
    var warnings = collectWarnings(model);
    var name = (model.meta && model.meta.name) ? model.meta.name : 'stf_profile';
    var fileBase = name.replace(/[^\w.-]+/g, '_');
    var g = model.generator;
    var f = model.flags || {};
    var set = function (v) { return v !== null && v !== undefined && v !== ''; };

    var lines = [
      '# ' + new Array(78).join('-'),
      '# TRex Profile & Config Builder - cap2 legacy STF profile',
      '# Generated: ' + (opts.now || TB.util.todayIso()) + '   Target: TRex v' + (model.trexVersion || '3.06'),
      '# Run: ./t-rex-64 -f ' + fileBase + '.yaml -d ' + (model.duration || 10) + ' --cfg /etc/trex_cfg.yaml',
      '# Re-edit: load ' + fileBase + '.trexb.json in TRex Profile & Config Builder',
      '# ' + new Array(78).join('-')
    ];

    var body = [];
    body.push('  duration : ' + durationStr(model.duration));
    body.push('  generator :');
    var GI = '          ';
    body.push(GI + pad('distribution', 14) + ' : "' + (g.distribution || 'seq') + '"');
    body.push(GI + pad('clients_start', 14) + ' : "' + g.clientsStart + '"');
    body.push(GI + pad('clients_end', 14) + ' : "' + g.clientsEnd + '"');
    body.push(GI + pad('servers_start', 14) + ' : "' + g.serversStart + '"');
    body.push(GI + pad('servers_end', 14) + ' : "' + g.serversEnd + '"');
    if (set(g.clientsPerGb)) { body.push(GI + pad('clients_per_gb', 14) + ' : ' + g.clientsPerGb); }
    if (set(g.minClients)) { body.push(GI + pad('min_clients', 14) + ' : ' + g.minClients); }
    if (set(g.dualPortMask)) { body.push(GI + pad('dual_port_mask', 14) + ' : "' + g.dualPortMask + '"'); }
    if (set(g.tcpAging)) { body.push(GI + pad('tcp_aging', 14) + ' : ' + g.tcpAging); }
    if (set(g.udpAging)) { body.push(GI + pad('udp_aging', 14) + ' : ' + g.udpAging); }

    if (f.capIpg === true) { body.push('  cap_ipg : true'); }
    if (set(f.capOverrideIpg)) { body.push('  cap_override_ipg : ' + f.capOverrideIpg); }
    if (set(f.capIpgMin)) { body.push('  cap_ipg_min : ' + f.capIpgMin); }
    if (f.vlan && f.vlan.enabled) {
      body.push('  vlan : { enable : 1, vlan0 : ' + f.vlan.vlan0 + ', vlan1 : ' + f.vlan.vlan1 + ' }');
    }
    if (set(f.macOverrideByIp)) { body.push('  mac_override_by_ip : ' + f.macOverrideByIp); }

    body.push('  cap_info :');
    (model.capInfo || []).forEach(function (c) {
      body.push('     - name: ' + c.name);
      body.push('       ' + pad('cps', 3) + ' : ' + c.cps);
      body.push('       ' + pad('ipg', 3) + ' : ' + c.ipg);
      body.push('       ' + pad('rtt', 3) + ' : ' + c.rtt);
      body.push('       ' + pad('w', 3) + ' : ' + c.w);
      if (set(c.limit)) { body.push('       limit : ' + c.limit); }
      if (set(c.plugin_id)) { body.push('       plugin_id : ' + c.plugin_id); }
      if (c.dynPyload && c.dynPyload.length) {
        body.push('       dyn_pyload :');
        c.dynPyload.forEach(function (d) {
          body.push('            - pkt_id : ' + d.pktId);
          body.push('              pyld_offset : ' + d.pyldOffset);
          body.push('              type : ' + d.type);
          body.push('              len : ' + d.len);
          body.push('              mask : ' + d.mask);
        });
      }
    });

    /* mandatory leading dash of the single-element list */
    body[0] = '- ' + body[0].slice(2);
    lines = lines.concat(body);
    lines.push('');

    return {
      files: [{ name: fileBase + '.yaml', language: 'yaml', content: lines.join('\n') }],
      warnings: warnings
    };
  }

  TB.gen.register('3.06', 'cap2', generate);
})(typeof window !== 'undefined' ? window : globalThis);
