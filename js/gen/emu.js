/* TRex Profile & Config Builder - TRex-EMU profile generator (TRex v3.06).
 *
 * Emits a client-emulation Python profile (from trex.emu.api import *) plus an
 * EMU_CONSOLE.txt runbook. EMU is its own process (./trex-emu) next to the
 * TRex server; profiles are loaded from trex-console started with --emu.
 * Modeled on the shipped emu/simple_*.py examples: a Prof1 class holding
 * def_ns_plugs / def_c_plugs, create_profile() iterating namespaces (vport)
 * and clients (mac[i]/ipv4[i]/ipv6[i] increments), and --ns/--clients tunables.
 * Registered as TB.gen.registry["3.06"].emu.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  function set(v) { return v !== null && v !== undefined && v !== ''; }

  /* ---- plugin assembly: [nsPlugs, clientPlugs, defClientPlugs] ----
   * ns-level entries follow the shipped examples: icmp/arp everywhere,
   * igmp/ipv6 carry the router dmac. Client entries carry init-json options. */
  function buildPlugs(model, warnings) {
    var p = model.plugins || {};
    var py = TB.gen.py;
    var ns = [];      /* ['key', 'python expr'] pairs, order fixed */
    var defC = [];
    var client = [];

    if (p.arp && p.arp.enabled) {
      var arpOpts = set(p.arp.timer) ? "{'enable': True, 'timer': " + p.arp.timer + '}' : "{'enable': True}";
      ns.push(['arp', "{'enable': True}"]);
      defC.push(['arp', arpOpts]);
    }
    if (p.icmp && p.icmp.enabled) {
      ns.push(['icmp', '{}']);
      defC.push(['icmp', '{}']);
    }
    if (p.igmp && p.igmp.enabled) {
      var igmpDmac = set(p.igmp.dmac) ? p.igmp.dmac : (model.clients && model.clients.mac);
      if (!TB.util.isMac(igmpDmac)) {
        warnings.push('IGMP dmac "' + (igmpDmac || '') + '" is not a valid MAC.');
        igmpDmac = '00:00:00:00:00:00';
      }
      ns.push(['igmp', "{'dmac': Mac(" + py.sq(igmpDmac) + ').V()}']);
      client.push(['igmp', '{}']);
    }
    if (p.ipv6nd && p.ipv6nd.enabled) {
      var ndDmac = set(p.ipv6nd.dmac) ? p.ipv6nd.dmac : (model.clients && model.clients.mac);
      if (!TB.util.isMac(ndDmac)) {
        warnings.push('IPv6 ND dmac "' + (ndDmac || '') + '" is not a valid MAC.');
        ndDmac = '00:00:00:00:00:00';
      }
      ns.push(['ipv6', "{'dmac': Mac(" + py.sq(ndDmac) + ').V()}']);
      client.push(['ipv6', '{}']);
    }
    if (p.dhcpv4 && p.dhcpv4.enabled) {
      var o = [];
      if (set(p.dhcpv4.discoverClassId)) { o.push("'discoverDhcpClassIdOption': " + py.sq(p.dhcpv4.discoverClassId)); }
      if (set(p.dhcpv4.requestClassId)) { o.push("'requestDhcpClassIdOption': " + py.sq(p.dhcpv4.requestClassId)); }
      client.push(['dhcp', o.length ? "{'options': {" + o.join(', ') + '}}' : '{}']);
    }
    if (p.dhcpv6 && p.dhcpv6.enabled) {
      client.push(['dhcpv6', '{}']);
    }
    if (p.dns && p.dns.enabled) {
      if (p.dns.mode === 'server') {
        client.push(['dns', 'self.get_dns_init_json()']);
      } else {
        var dnsIp = p.dns.serverIp || '';
        if (!TB.util.isIpv4(dnsIp) && !TB.util.isIpv6(dnsIp)) {
          warnings.push('DNS resolver: server IP "' + dnsIp + '" is not a valid IPv4/IPv6 address.');
        }
        client.push(['dns', "{'name_server': False, 'dns_server_ip': " + py.sq(dnsIp) + '}']);
      }
    }
    if (p.mdns && p.mdns.enabled) {
      client.push(['mdns', 'self.get_mdns_init_json(j)']);
    }
    return { ns: ns, defC: defC, client: client };
  }

  function plugDictLines(pairs, indent) {
    /* {'arp': {...},\n 'icmp': {...}} aligned like the shipped examples */
    if (!pairs.length) { return ['None']; }
    var out = [];
    pairs.forEach(function (kv, i) {
      var line = (i === 0 ? '{' : indent) + "'" + kv[0] + "': " + kv[1];
      line += (i === pairs.length - 1) ? '}' : ',';
      out.push(line);
    });
    return out;
  }

  function collectWarnings(model) {
    var w = [];
    var c = model.clients || {};
    var p = model.plugins || {};
    if (!TB.util.isMac(c.mac)) { w.push('Client MAC "' + (c.mac || '') + '" is not a valid MAC address.'); }
    if (c.ipv4Enabled) {
      if (!TB.util.isIpv4(c.ipv4)) { w.push('Client IPv4 "' + (c.ipv4 || '') + '" is not a valid IPv4 address.'); }
      if (!TB.util.isIpv4(c.dg)) { w.push('Default gateway "' + (c.dg || '') + '" is not a valid IPv4 address.'); }
    }
    if (c.ipv6Enabled && !TB.util.isIpv6(c.ipv6)) {
      w.push('Client IPv6 "' + (c.ipv6 || '') + '" is not a valid IPv6 address.');
    }
    if (!set(c.count) || c.count <= 0) { w.push('Client count must be positive.'); }
    if (!set(model.nsCount) || model.nsCount <= 0) { w.push('Namespace count must be positive.'); }

    var any = ['arp', 'icmp', 'igmp', 'ipv6nd', 'dhcpv4', 'dhcpv6', 'dns', 'mdns'].some(function (k) {
      return p[k] && p[k].enabled;
    });
    if (!any) { w.push('No plugins enabled - the emulated clients will do nothing.'); }

    if (p.dhcpv4 && p.dhcpv4.enabled && c.ipv4Enabled) {
      w.push('DHCPv4 is enabled but clients have static IPv4 addresses; DHCP clients normally start at 0.0.0.0 ' +
        '(untick IPv4 to let DHCP assign addresses, like the shipped emu/simple_dhcp.py).');
    }
    if (p.dhcpv6 && p.dhcpv6.enabled && !(p.ipv6nd && p.ipv6nd.enabled)) {
      w.push('DHCPv6 needs the IPv6 (ND) plugin on the client (see emu/simple_dhcpv6.py); enable IPv6 ND.');
    }
    if (p.ipv6nd && p.ipv6nd.enabled && !c.ipv6Enabled && !(p.dhcpv6 && p.dhcpv6.enabled)) {
      w.push('IPv6 ND is enabled but clients have no IPv6 address (and no DHCPv6 to assign one).');
    }
    if (p.dns && p.dns.enabled && p.dns.mode === 'server' && !(p.dns.records || []).length) {
      w.push('DNS name server has an empty database - add at least one record.');
    }
    if (p.igmp && p.igmp.enabled && !c.ipv4Enabled) { w.push('IGMP needs an IPv4 address on the clients.'); }
    return w;
  }

  function generate(model, opts) {
    opts = opts || {};
    var py = TB.gen.py;
    var warnings = collectWarnings(model);
    var name = (model.meta && model.meta.name) ? model.meta.name : 'emu_profile';
    var fileBase = name.replace(/[^\w.-]+/g, '_');
    var c = model.clients || {};
    var p = model.plugins || {};
    var plugs = buildPlugs(model, warnings);
    var now = opts.now || TB.util.todayIso();
    var trexVersion = model.trexVersion || '3.06';

    var lines = [
      '# ' + new Array(78).join('-'),
      '# TRex Profile & Config Builder - TRex-EMU client emulation profile',
      '# Generated: ' + now,
      '# Target: TRex v' + trexVersion,
      '# Load on the box: ./trex-console --emu   then   trex>load_profile -f ' + fileBase + '.py',
      '# Re-edit: load ' + fileBase + '.trexb.json in TRex Profile & Config Builder'
    ];
    var sumSet = TB.gen.registry[trexVersion];
    var sentences = (sumSet && sumSet.summarize && sumSet.summarize.emu) ? sumSet.summarize.emu(model) : [];
    lines = lines.concat(py.summaryComment(sentences));
    lines.push('# ' + new Array(78).join('-'));
    lines.push('from trex.emu.api import *');
    lines.push('import argparse');
    lines.push('');
    lines.push('');
    lines.push('class Prof1():');
    lines.push('    def __init__(self):');

    var nsHead = '        self.def_ns_plugs = ';
    var nsLines = plugDictLines(plugs.ns, new Array(nsHead.length + 2).join(' '));
    lines.push(nsHead + nsLines[0]);
    for (var i = 1; i < nsLines.length; i++) { lines.push(nsLines[i]); }
    var cHead = '        self.def_c_plugs = ';
    var defCLines = plugDictLines(plugs.defC, new Array(cHead.length + 2).join(' '));
    lines.push(cHead + defCLines[0]);
    for (i = 1; i < defCLines.length; i++) { lines.push(defCLines[i]); }
    lines.push('');

    /* ---- DNS name-server database helper ---- */
    if (p.dns && p.dns.enabled && p.dns.mode === 'server') {
      lines.push('    def get_dns_init_json(self):');
      lines.push('        """Init json for an EMU DNS name server (see emu/simple_dns.py)."""');
      lines.push('        return {');
      lines.push("            'name_server': True,");
      lines.push("            'database': {");
      var recs = p.dns.records || [];
      var byDomain = {};
      var order = [];
      recs.forEach(function (r) {
        var d = r.domain || 'example.com';
        if (!(d in byDomain)) { byDomain[d] = []; order.push(d); }
        byDomain[d].push(r);
      });
      order.forEach(function (d, di) {
        lines.push('                ' + py.sq(d) + ': [');
        byDomain[d].forEach(function (r, ri) {
          var comma = (ri === byDomain[d].length - 1) ? '' : ',';
          lines.push("                    {'type': " + py.sq(r.type || 'A') + ", 'class': 'IN', 'answer': " +
            py.sq(r.answer || '') + '}' + comma);
        });
        lines.push('                ]' + (di === order.length - 1 ? '' : ','));
      });
      lines.push('            }');
      lines.push('        }');
      lines.push('');
    }

    /* ---- mDNS init-json helper ---- */
    if (p.mdns && p.mdns.enabled) {
      var pattern = set(p.mdns.hostPattern) ? p.mdns.hostPattern : 'client-{}.emu';
      lines.push('    def get_mdns_init_json(self, client):');
      lines.push('        """Init json for an EMU mDNS client (see emu/simple_mdns.py)."""');
      lines.push('        init_json = {');
      lines.push("            'hosts': [" + py.sq(pattern) + '.format(client)],');
      lines.push("            'ttl': " + (set(p.mdns.ttl) ? p.mdns.ttl : 240));
      lines.push('        }');
      if (set(p.mdns.domainName)) {
        lines.push("        init_json['domain_name'] = " + py.sq(p.mdns.domainName));
      }
      lines.push('        return init_json');
      lines.push('');
    }

    /* ---- create_profile ---- */
    lines.push('    def create_profile(self, ns_size, clients_size):');
    lines.push('        ns_list = []');
    if (model.vlan && model.vlan.enabled) {
      lines.push('        # one 802.1Q tag per namespace: tci increments with the vport');
      lines.push('        vport, tci, tpid = 0, ' + (set(model.vlan.tci) ? model.vlan.tci : 1) + ', 0x8100');
    } else {
      lines.push('        vport, tci, tpid = 0, [0, 0], [0x00, 0x00]');
    }
    lines.push('        for i in range(vport, ns_size + vport):');
    if (model.vlan && model.vlan.enabled) {
      lines.push('            ns_key = EMUNamespaceKey(vport = i,');
      lines.push('                                     tci   = tci + i,');
      lines.push('                                     tpid  = tpid)');
    } else {
      lines.push('            ns_key = EMUNamespaceKey(vport = i,');
      lines.push('                                     tci   = tci,');
      lines.push('                                     tpid  = tpid)');
    }
    lines.push('            ns = EMUNamespaceObj(ns_key = ns_key, def_c_plugs = self.def_c_plugs)');
    lines.push('');
    lines.push('            mac  = Mac(' + py.sq(c.mac || '00:00:00:70:00:01') + ')');
    if (c.ipv4Enabled) {
      lines.push('            ipv4 = Ipv4(' + py.sq(c.ipv4 || '0.0.0.0') + ')');
      lines.push('            dg   = Ipv4(' + py.sq(c.dg || '0.0.0.0') + ')');
    } else if (p.dhcpv4 && p.dhcpv4.enabled) {
      lines.push('            # DHCP assigns addresses: clients start at 0.0.0.0');
      lines.push("            ipv4 = Ipv4('0.0.0.0')");
      lines.push("            dg   = Ipv4('0.0.0.0')");
    }
    if (c.ipv6Enabled) {
      lines.push('            ipv6 = Ipv6(' + py.sq(c.ipv6 || '::') + ')');
    }
    lines.push('');
    lines.push('            # each client increments mac' +
      (c.ipv4Enabled ? '/ipv4' : '') + (c.ipv6Enabled ? '/ipv6' : '') + ' from the base value');
    lines.push('            for j in range(clients_size):');

    var kwargs = [];
    kwargs.push('mac     = mac[j].V()');
    if (c.ipv4Enabled) {
      kwargs.push('ipv4    = ipv4[j].V()');
      kwargs.push('ipv4_dg = dg.V()');
    } else if (p.dhcpv4 && p.dhcpv4.enabled) {
      kwargs.push('ipv4    = ipv4.V()');
      kwargs.push('ipv4_dg = dg.V()');
    }
    if (c.ipv6Enabled) { kwargs.push('ipv6    = ipv6[j].V()'); }
    var pad = '                client = EMUClientObj(';
    var contPad = new Array(pad.length + 1).join(' ');
    if (plugs.client.length) {
      /* the plugs dict aligns its continuation lines under its opening brace */
      var dictPad = contPad + new Array('plugs   = '.length + 2).join(' ');
      var cpLines = plugDictLines(plugs.client, dictPad);
      kwargs.push('plugs   = ' + cpLines[0]);
      for (var k = 1; k < cpLines.length; k++) { kwargs.push('\x00' + cpLines[k]); }
    }
    kwargs.forEach(function (kw, idx) {
      var isCont = kw.charAt(0) === '\x00';
      var body = isCont ? kw.slice(1) : kw;
      var prefix = idx === 0 ? pad : (isCont ? '' : contPad);
      /* a kwarg followed by dict continuation lines already ends with ',' */
      var nextIsCont = idx + 1 < kwargs.length && kwargs[idx + 1].charAt(0) === '\x00';
      var suffix = (idx === kwargs.length - 1) ? ')' : (nextIsCont ? '' : ',');
      lines.push(prefix + body + suffix);
    });
    lines.push('                ns.add_clients(client)');
    lines.push('            ns_list.append(ns)');
    lines.push('');
    lines.push('        return EMUProfile(ns = ns_list, def_ns_plugs = self.def_ns_plugs)');
    lines.push('');
    lines.push('    def get_profile(self, tuneables):');
    lines.push("        parser = argparse.ArgumentParser(description='trexb generated EMU profile',");
    lines.push('                                         formatter_class=argparse.ArgumentDefaultsHelpFormatter)');
    lines.push("        parser.add_argument('--ns', type=int, default=" + (set(model.nsCount) ? model.nsCount : 1) + ',');
    lines.push("                            help='Number of namespaces to create')");
    lines.push("        parser.add_argument('--clients', type=int, default=" + (set(c.count) ? c.count : 15) + ',');
    lines.push("                            help='Number of clients to create in each namespace')");
    lines.push('        args = parser.parse_args(tuneables)');
    lines.push('');
    lines.push("        assert 0 < args.ns < 65535, 'Namespaces must be positive and below 65535!'");
    lines.push("        assert 0 < args.clients, 'Clients must be positive!'");
    lines.push('');
    lines.push('        return self.create_profile(args.ns, args.clients)');
    lines.push('');
    lines.push('');
    lines.push('def register():');
    lines.push('    return Prof1()');
    lines.push('');

    /* ---- EMU_CONSOLE.txt runbook ---- */
    var trexDir = model.trexDir || '/opt/trex/v3.06';
    var consoleLines = [
      '# ' + new Array(78).join('-'),
      '# TRex Profile & Config Builder - EMU launch runbook',
      '# Generated: ' + now + '   Target: TRex v' + trexVersion,
      '# EMU is a separate process (Golang) that rides next to the TRex server.',
      '# ' + new Array(78).join('-'),
      '',
      '# 1) FIRST terminal - start the TRex server (interactive mode):',
      'cd ' + trexDir,
      'sudo ./t-rex-64 -i',
      '',
      '# 2) SECOND terminal - start the EMU server',
      '#    (logs to /var/log/trex/emu_daemon_server.log):',
      'cd ' + trexDir,
      'sudo ./trex-emu',
      '',
      '# 3) THIRD terminal - console with the EMU plugin loaded:',
      'cd ' + trexDir,
      './trex-console --emu',
      '',
      '# load this profile (tunables after -t):',
      'trex>load_profile -f ' + fileBase + '.py -t --ns ' + (set(model.nsCount) ? model.nsCount : 1) +
        ' --clients ' + (set(c.count) ? c.count : 15),
      '',
      '# when done:',
      'trex>remove_profile',
      ''
    ];

    return {
      files: [
        { name: fileBase + '.py', language: 'python', content: lines.join('\n') },
        { name: 'EMU_CONSOLE.txt', language: 'shell', content: consoleLines.join('\n') }
      ],
      warnings: warnings
    };
  }

  TB.gen.register('3.06', 'emu', generate);
})(typeof window !== 'undefined' ? window : globalThis);
