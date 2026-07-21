/* TRex Profile & Config Builder - Manual tab: a full user manual rendered from
 * structured chapter data. Field-reference tables are generated from TB.help
 * (js/help/content.js) so tooltips and the manual can never drift apart.
 * Screenshots load from docs/img/<tab>.png and hide gracefully if missing
 * (regenerate them with tools/screenshots.ps1). */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  /* Field labels for the reference tables: TB.help key -> human label. */
  var FIELD_LABELS = {
    stl: {
      profileName: 'Profile name', streamName: 'Stream name', srcMac: 'Src MAC', dstMac: 'Dst MAC',
      vlan: 'VLAN', vlanId: 'VLAN id', vlanPrio: 'VLAN priority',
      tunnel: 'Tunnel', tunnelOuterSrc: 'Outer src IP', tunnelOuterDst: 'Outer dst IP', vni: 'VXLAN VNI',
      mplsLabel: 'MPLS label', mplsTtl: 'MPLS TTL', qinqOuter: 'QinQ outer VLAN', nshSpi: 'NSH SPI', nshSi: 'NSH SI',
      l3: 'L3', srcIp: 'Src IP', dstIp: 'Dst IP',
      tos: 'TOS', ttl: 'TTL', fragOffset: 'Frag offset', moreFrags: 'MF flag', ipv6Ext: 'IPv6 ext header',
      l4: 'L4', sport: 'Src port', dport: 'Dst port', tcpFlags: 'TCP flags',
      icmpKind: 'ICMP kind', icmpId: 'ICMP id', icmpSeq: 'ICMP seq', packetPresets: 'Packet presets',
      frameSize: 'Frame size', bindTunable: 'Bind to tunable', fill: 'Fill char', rawScapy: 'Raw scapy',
      mode: 'TX mode', pps: 'Rate', rateUnit: 'Rate unit', totalPkts: 'Total packets', pktsPerBurst: 'Packets per burst',
      ibg: 'Inter-burst gap', count: 'Burst count', isg: 'ISG (start delay)', selfStart: 'Self start',
      next: 'Next stream', actionCount: 'Action count', vmVarName: 'VM variable name', vmSize: 'VM size',
      vmOp: 'VM operation', vmMin: 'VM min', vmMax: 'VM max', vmStep: 'VM step', vmWriteTo: 'VM write target',
      vmNextVar: 'VM wrap dependency', vmOffsetFixup: 'VM offset fixup', vmSplitCores: 'VM split to cores',
      vmFixCsum: 'Fix IPv4 checksum', tuple: 'Tuple generator', tupleLimit: 'Tuple flow limit',
      cacheSize: 'VM cache size', fsType: 'Flow stats type', pgId: 'pg_id', addPortId: 'Add port_id',
      tunableName: 'Tunable name', tunableType: 'Tunable type', tunableDefault: 'Tunable default',
      tunableHelp: 'Tunable help', trexVersion: 'TRex version',
      pcapReplayOn: 'Pcap replay', pcapReplayFile: 'Replay pcap path', pcapReplayIpg: 'Replay IPG',
      pcapReplaySpeedup: 'Replay speedup', pcapReplayLoop: 'Replay loop count'
    },
    astf: {
      profileName: 'Profile name', mode: 'Mode', clientRange: 'Client IP range', serverRange: 'Server IP range',
      distribution: 'Distribution', perCore: 'Per-core distribution', ipOffset: 'ip_offset',
      pcapFile: 'Pcap file', cps: 'cps', portPin: 'Port pin', sDelay: 's_delay',
      ipGenOverride: 'IP generator override', tgName: 'Template group name', assocPort: 'Association port',
      transport: 'Transport', cmdSend: 'send command', cmdRecv: 'recv command', cmdDelay: 'delay command',
      cmdLoop: 'loop commands', httpBodyBytes: 'HTTP body bytes', tcpTuning: 'TCP tuning fields',
      rampupSec: 'rampup_sec', ipv6: 'IPv6',
      topoOn: 'GTP-U topology', topoSrcRange: 'Tunnel client range', topoTeid: 'Initial TEID',
      topoTeidJump: 'TEID jump', topoSport: 'Tunnel src port', topoVersion: 'Outer IP version',
      topoSrcIp: 'Outer src IP', topoDstIp: 'Outer dst IP', topoActivate: 'Activate'
    },
    cap2: {
      profileName: 'Profile name', duration: 'Duration', clientsRange: 'Clients range', serversRange: 'Servers range',
      clientsPerGb: 'clients_per_gb', minClients: 'min_clients', dualPortMask: 'dual_port_mask', aging: 'tcp/udp aging',
      capIpg: 'cap_ipg', capOverrideIpg: 'cap_override_ipg', capIpgMin: 'cap_ipg_min', vlanLb: 'VLAN load balance',
      macOverrideByIp: 'mac_override_by_ip', pcapName: 'Pcap path', cps: 'cps', ipg: 'ipg', rtt: 'rtt', w: 'weight',
      limit: 'Flow limit', pluginId: 'plugin_id', dynPktId: 'dyn_pyload pkt_id', dynOffset: 'dyn_pyload offset',
      dynType: 'dyn_pyload type', dynLen: 'dyn_pyload len', dynMask: 'dyn_pyload mask'
    },
    scenarios: {
      mechanismTwoServer: 'Two-server mechanism', senderHost: 'Sender box', receiverHost: 'Receiver box',
      bidirectional: 'Bidirectional', rampMechanism: 'Ramp mechanism', rampStages: 'Stage rates', stageSec: 'Stage duration',
      pingDst: 'Ping destination', latencyProbe: 'Latency probe', probePps: 'Probe rate',
      ndrEngine: 'NDR engine', ndrRate: 'NDR profile rate', ndrPorts: 'NDR ports', ndrPdr: 'PDR %',
      ndrMults: 'NDR search bounds', ndrQfull: 'q-full %', ndrLatGate: 'NDR latency gate'
    },
    emu: {
      profileName: 'Profile name', nsCount: 'Namespaces (--ns)', vlan: 'VLAN per namespace', vlanTci: 'First VLAN tag',
      clientCount: 'Clients (--clients)', clientMac: 'First client MAC', ipv4Enabled: 'IPv4', ipv4: 'First IPv4',
      dg: 'Default gateway', ipv6Enabled: 'IPv6', ipv6: 'First IPv6',
      arp: 'ARP plugin', arpTimer: 'ARP timer', icmp: 'ICMP plugin', igmp: 'IGMP plugin', igmpDmac: 'IGMP dmac',
      ipv6nd: 'IPv6 ND plugin', ipv6ndDmac: 'ND dmac', dhcpv4: 'DHCPv4 plugin', dhcpClassId: 'DHCP class-id',
      dhcpv6: 'DHCPv6 plugin', dns: 'DNS plugin', dnsMode: 'DNS role', dnsServerIp: 'Name server IP',
      dnsDomain: 'DNS record domain', dnsType: 'DNS record type', dnsAnswer: 'DNS record answer',
      mdns: 'mDNS plugin', mdnsHosts: 'mDNS host pattern', mdnsTtl: 'mDNS TTL', mdnsDomain: 'mDNS domain'
    },
    tpg: {
      name: 'Config name', minVlan: 'Min VLAN', maxVlan: 'Max VLAN', qinqInner: 'QinQ inner VLAN',
      qinqOuter: 'QinQ outer VLAN', numTpgids: 'num-tpgids', ports: 'Ports'
    },
    bird: {
      name: 'Config name', routerId: 'Router id', nodePort: 'Node port', nodeMac: 'Node MAC', nodeIp: 'Node IPv4',
      nodeSubnet: 'Node subnet', nodeIpv6: 'Node IPv6', bgpName: 'BGP instance name', bgpAf: 'BGP address family',
      bgpLocal: 'BGP local IP', bgpNeighbor: 'BGP neighbor IP', bgpAs: 'AS number', ospf: 'OSPF', ospfArea: 'OSPF area',
      rip: 'RIP', routeAf: 'Route address family', routePrefix: 'First prefix', routeLen: 'Prefix length',
      routeCount: 'Route count', routeNextHop: 'Next hop'
    },
    cfg: { server: 'Server' },
    cli: {
      server: 'Server', mode: 'Mode', profile: 'Profile', cfgPath: '--cfg path', cores: 'Cores (-c)',
      mult: 'Multiplier (-m)', duration: 'Duration (-d)', latency: 'Latency (-l)', flowAffinity: '-p',
      serverOnly: '--astf-server-only', clientMask: '--astf-client-mask', extraArgs: 'Extra args'
    },
    settings: {
      trexVersion: 'Default TRex version', pcapDir: 'Pcap directory', activeServer: 'Active server',
      name: 'Server name', mgmtHost: 'Mgmt host', trexDir: 'TRex dir', cores: 'Cores', portLimit: 'Port limit',
      bandwidth: 'Bandwidth', interfaces: 'PCI interfaces', portMode: 'Port mode', platform: 'Platform block',
      memory: 'Memory block', limitMemory: 'limit_memory', prefix: 'prefix', zmqPub: 'ZMQ pub', telnetPort: 'telnet_port'
    }
  };

  function esc(s) { return TB.util.escapeHtml(s); }

  function fieldTable(tabId) {
    var help = TB.help[tabId] || {};
    var labels = FIELD_LABELS[tabId] || {};
    var rows = '';
    for (var key in labels) {
      if (Object.prototype.hasOwnProperty.call(labels, key) && help[key]) {
        rows += '<tr><td>' + esc(labels[key]) + '</td><td>' + esc(help[key]) + '</td></tr>';
      }
    }
    if (!rows) { return ''; }
    return '<h4>Field reference</h4><table class="man-table"><tr><th>Field</th><th>What it does</th></tr>' + rows + '</table>';
  }

  function shot(tabId) {
    return '<img class="man-shot" src="docs/img/' + tabId + '.png" alt="' + tabId + ' tab screenshot"' +
      ' onerror="this.style.display=\'none\'">';
  }

  function tabIntro(tabId) {
    return '<p class="man-purpose">' + esc((TB.help[tabId] && TB.help[tabId]._tab) || '') + '</p>' + shot(tabId);
  }

  var CHAPTERS = [
    { id: 'start', title: 'Getting started', html: function () {
      return '<p>This app builds Cisco TRex configuration artifacts through forms: traffic profiles ' +
        '(STL, ASTF, cap2), client emulation (EMU), per-VLAN rx stats (TPG), routing configs (BIRD), the platform ' +
        'config (trex_cfg.yaml), and launch commands. Nothing runs in the ' +
        'browser - you <strong>Copy</strong> or <strong>Download</strong> the generated files and use them on your TRex box.</p>' +
        '<h4>Two ways to run the app</h4>' +
        '<ul><li><strong>No server:</strong> open <code>index.html</code> from disk. Everything works.</li>' +
        '<li><strong>Hosted on the TRex box:</strong> <code>pip install flask</code> then ' +
        '<code>TREX_DIR=/opt/trex/v3.06 python app.py</code>. This unlocks the <em>Browse…</em> buttons on pcap ' +
        'fields (lists real pcaps on the box) and <em>Validate on server</em> (runs stl-sim/astf-sim and shows the result).</li></ul>' +
        '<h4>The output actions</h4>' +
        '<p>Every generated artifact offers <strong>Copy</strong>, <strong>Download</strong> (the .py/.yaml file itself), ' +
        '<strong>Download model</strong> - a JSON file that re-imports into the builder later, so you can keep editing ' +
        'a profile long after it was made - and <strong>Download bundle (.zip)</strong>, which packs every generated ' +
        'file plus the model JSON into one zip per test (profile + runbook + launch script from a scenario, for ' +
        'example). Profiles also <strong>Save</strong> into the browser (IndexedDB, so big pcap-heavy workspaces fit); use ' +
        '<strong>Export workspace</strong> in the header for a durable backup of everything.</p>' +
        '<h4>Re-editing a generated profile</h4>' +
        '<p>You don\'t have to keep the model JSON to edit a profile again - the profile file itself is enough. On the ' +
        '<strong>cap2</strong> tab, <strong>Import…</strong> accepts a generated <code>.yaml</code> as well as a ' +
        '<code>.json</code> model. The <em>values are read straight from the file body</em>, so any edit you made - a ' +
        'changed IP, a different rate - comes right back in (the body is the single source of truth; there is no hidden ' +
        'copy to fall out of sync). A one-line tag at the foot of the file (<code># trexb: cap2 schemaVersion=1</code>) ' +
        'just marks it as ours and names the field map to use; it holds no values. A file this tool generated maps fully; ' +
        'a hand-written or third-party <code>.yaml</code> with no tag is read best-effort - the builder maps every key it ' +
        'recognises, loads that, and tells you how much of the file was mapped, listing any lines it could not place. ' +
        'The app has no interpreter and does not try to understand arbitrary scripts, so only tool-generated files are ' +
        'guaranteed to map fully. (Re-import for the <code>.py</code> builders is on the roadmap; see <em>Future updates</em>.)</p>' +
        '<p>STL profiles also offer <strong>Publish to server</strong>: enter a running ' +
        '<a href="https://github.com/pferry11/TRex-Backend">TRex-Backend</a> host (prefilled from the active server’s ' +
        'mgmt host) and the profile is POSTed to it. It lands in that box’s vetted-profiles directory and immediately ' +
        'appears in the dashboard’s profile dropdown - allowlisted and showing this same summary - so a teammate can ' +
        'run it without ever opening the builder. The backend can refuse uploads (<code>allow_upload: false</code>) on ' +
        'boxes where an admin curates profiles by hand.</p>' +
        '<h4>Undo / redo</h4>' +
        '<p>Every profile builder\'s top bar carries <strong>↶ Undo / ↷ Redo</strong> buttons that step through ' +
        'model snapshots - one per settled edit, up to 50 deep per builder tab. Snapshots cover everything in the ' +
        'model (streams, tunables, topbar fields), and since loading a saved profile or hitting <em>New</em> is ' +
        'itself an edit, undo steps back across those too. Editing after an undo discards the redo trail, like any ' +
        'editor.</p>' +
        '<h4>What this does &amp; the file header</h4>' +
        '<p>Above every output the <em>"What this does"</em> box explains the artifact in plain English. The same ' +
        'summary is embedded as <code># Summary:</code> comments in the generated file, together with the exact ' +
        'simulator command to validate it on the box.</p>' +
        '<h4>Tooltips</h4><p>Hover any <span class="tip-icon" style="position:static">ⓘ</span> icon for a description ' +
        'of that field - the same text as the field-reference tables in this manual.</p>' +
        '<h4>Target TRex version</h4><p>Generators are registered per TRex version (v3.06 today). New versions can be ' +
        'added later without changing saved profiles - models carry their target version.</p>';
    } },

    { id: 'stl', title: 'STL Profile builder', html: function () {
      return tabIntro('stl') +
        '<h4>Layout</h4><p>Three panes: the <strong>stream list</strong> (add, duplicate, reorder, enable/disable - the ' +
        '<strong>IMIX preset</strong> button loads the classic 60/590/1514 B three-stream table in one click), ' +
        'the <strong>stream editor</strong> for the selected stream, and the <strong>live output</strong> which regenerates as you type.</p>' +
        '<h4>Building a stream</h4><ol>' +
        '<li><strong>Packet</strong> - choose headers (optional MACs, VLAN, IPv4/IPv6 with fragments and extension ' +
        'headers, UDP/TCP/ICMP) and the frame size; the payload pads to reach it. A live readout shows header and ' +
        'frame bytes. Preset buttons quick-fill ICMP echo, ARP request and DNS query packets, and a tunnel selector ' +
        'wraps the packet in VXLAN, GRE, MPLS, QinQ or NSH encapsulation.</li>' +
        '<li><strong>TX mode</strong> - continuous rate, one burst, or repeated bursts. The rate can be given in pps, ' +
        'bps L1, bps L2 or a percentage of the port line rate.</li>' +
        '<li><strong>Timing &amp; chaining</strong> - stagger starts with ISG, or chain streams (self start off + a ' +
        '"next" reference) to build sequences and loops.</li>' +
        '<li><strong>Field engine</strong> - sweep or randomise packet fields per packet (e.g. source IP over a range), ' +
        'or use the tuple generator for unique client IP/port pairs. Variables can be chained into nested loops ' +
        '(one steps when another wraps), write with a byte offset fixup, and opt out of per-core range splitting.</li>' +
        '<li><strong>Flow stats</strong> - add per-stream counters or latency measurement via pg_id.</li></ol>' +
        '<h4>Tunables</h4><p>Add a tunable (e.g. <code>size</code>) and bind a field to it with the ⚙ selector: the ' +
        'generated profile then takes <code>-t size=128</code> style arguments at load time.</p>' +
        '<h4>Pcap replay</h4><p>The <strong>Pcap replay</strong> box swaps the whole profile for ' +
        '<code>STLProfile.load_pcap</code>: TRex replays every packet of a capture, at its recorded timing or a fixed ' +
        'IPG, looped N times. The generated profile keeps <code>-t ipg_usec=...,loop_count=...</code> overrides.</p>' +
        '<p class="man-note">Latency streams ignore the -m multiplier and each needs a unique pg_id - the builder warns ' +
        'about both.</p>' + fieldTable('stl');
    } },

    { id: 'astf', title: 'ASTF Profile builder', html: function () {
      return tabIntro('astf') +
        '<h4>Two modes</h4>' +
        '<ul><li><strong>pcap list</strong> - the easy path: each row replays a captured flow at a given cps. ' +
        'TRex rewrites the IPs from the generator pools. Mix several pcaps with different cps values to build a ' +
        'traffic blend (like the classic sfr profile).</li>' +
        '<li><strong>program</strong> - script the exchange yourself: ordered client and server command lists ' +
        '(send/recv, delays, counted loops). The HTTP presets generate realistic request/response payloads, and ' +
        '"auto" recv sizes always match the peer, like the shipped http_manual_commands example.</li></ul>' +
        '<h4>L7 presets</h4><p>One-click starting points that replace the current entries: <strong>DNS</strong>, ' +
        '<strong>SIP</strong> and <strong>RTP</strong> UDP programs, <strong>HTTPS (TLS)</strong> - TLS traffic the ' +
        'v3.06 way, replaying the shipped TLS pcap like astf/http_https.py (newer TRex adds native TLS programs), ' +
        'an <strong>Enterprise mix</strong> (SFR-style multi-pcap blend with representative cps weights), and an ' +
        '<strong>Elephant flow</strong> throughput soak - one keep-alive connection whose server loops 100 x 64 KB ' +
        'sends with enlarged TCP buffers (http_eflow.py pattern). Everything stays editable after loading.</p>' +
        '<h4>GTP-U tunnel topology</h4><p>For mobile-network DUTs (UPF/SGW): the <strong>GTP-U tunnel topology</strong> ' +
        'box generates a companion <code>&lt;profile&gt;_topo.py</code> alongside the profile. Each tunnel context ' +
        'covers a slice of the client pool and assigns per-client TEIDs (initial + jump); the outer tunnel runs ' +
        'between two endpoint IPs (v4 or v6). On the box, load it before starting: ' +
        '<code>trex&gt; tunnels_topo load -f profile_topo.py</code>. The builder warns when a context falls outside ' +
        'the client pool, ranges overlap, or endpoint IPs do not match the outer IP version.</p>' +
        '<h4>IP generator</h4><p>Client and server pools; connections are sourced from the client range towards the ' +
        'server range, which the receiver (or DUT) must route/answer.</p>' +
        '<h4>Global info</h4><p>Optional per-side TCP tuning (mss, buffers, keepalives), IPv6, and ' +
        '<strong>rampup_sec</strong> - the linear connections-per-second ramp used by the ramp scenario.</p>' +
        '<p class="man-note">cps values are weights at -m 1; the console -m multiplier scales all templates ' +
        'proportionally at run time.</p>' + fieldTable('astf');
    } },

    { id: 'cap2', title: 'cap2 (STF) builder', html: function () {
      return tabIntro('cap2') +
        '<h4>When to use it</h4><p>The legacy stateful format predates ASTF and is still handy for quick pcap replay ' +
        'runs (<code>t-rex-64 -f profile.yaml -d 60</code>) and for its unique <strong>dyn_pyload</strong> feature.</p>' +
        '<h4>dyn_pyload - pcap manipulation</h4><p>Per pcap template you can rewrite payload bytes of a chosen packet ' +
        'on every replayed flow: pick the packet, byte offset, length in 32-bit words, and whether to write random ' +
        'data or the flow\'s client IP. This makes each replayed flow unique without editing the capture.</p>' +
        '<h4>Other flags</h4><p><code>cap_ipg</code> keeps the capture\'s real timing; the VLAN block alternates flows ' +
        'across two tags; <code>plugin_id</code> enables HTTP/DHCP-aware replay.</p>' +
        '<h4>Editing an existing profile</h4><p><strong>Import…</strong> opens a <code>.yaml</code> profile (or a ' +
        '<code>.json</code> model) back into the builder - so instead of editing in vi/nano on the box you can add a ' +
        'pcap template or change an IP here and regenerate. Values are read from the file body, so any change you made ' +
        'is preserved. Profiles this tool generated map fully; shipped or hand-written files import best-effort and the ' +
        'app tells you how much it could map, listing any lines it did not recognise (those become candidate roadmap ' +
        'items). See <em>Getting started &rarr; Re-editing a generated profile</em> for the full detail.</p>' +
        fieldTable('cap2');
    } },

    { id: 'emu', title: 'EMU (client emulation)', html: function () {
      return tabIntro('emu') +
        '<h4>What EMU is</h4><p>TRex-EMU is a separate Golang process (<code>./trex-emu</code>) that emulates the ' +
        '<em>control plane</em> of many hosts: ARP, ICMP, IGMP, IPv6 ND, DHCPv4/v6, DNS and mDNS. Where STL/ASTF ' +
        'push data-plane load, EMU makes the DUT believe real clients live behind the TRex ports - it answers pings, ' +
        'leases addresses, joins multicast groups and serves names. Both can run at once: EMU holds the network ' +
        'identity while a profile drives traffic.</p>' +
        '<h4>Model</h4><p>Clients live in <strong>namespaces</strong> keyed by vport (optionally one 802.1Q VLAN per ' +
        'namespace). Each client takes its MAC/IPv4/IPv6 by incrementing the base values - exactly the ' +
        '<code>mac[i].V()</code> pattern of the shipped <code>emu/simple_*.py</code> examples. The generated profile ' +
        'keeps <code>--ns</code> and <code>--clients</code> as load-time tunables, so scale changes need no ' +
        'regeneration.</p>' +
        '<h4>Plugins</h4><p>Tick only what the test needs: ARP + ICMP make clients reachable and pingable; DHCPv4 ' +
        'clients start at 0.0.0.0 and lease addresses (with optional vendor class-ids); the DNS plugin can make every ' +
        'client a resolver against a name server - or a name server itself, answering A/AAAA/TXT/PTR records you ' +
        'define. The preset buttons mirror the shipped examples one-to-one.</p>' +
        '<h4>Running it</h4><p>The generated <code>EMU_CONSOLE.txt</code> walks the three terminals: the TRex server ' +
        '(<code>t-rex-64 -i</code>), the EMU server (<code>sudo ./trex-emu</code>, logs to ' +
        '<code>/var/log/trex/emu_daemon_server.log</code>) and the console (<code>./trex-console --emu</code>) with ' +
        'the <code>load_profile</code> line, tunables included.</p>' + fieldTable('emu');
    } },

    { id: 'tpg', title: 'TPG (Tagged Packet Group)', html: function () {
      return tabIntro('tpg') +
        '<h4>What TPG gives you</h4><p>Per-VLAN receive counters. Enable TPG with a tags file and TRex counts rx ' +
        'packets, bytes and sequence errors <em>per tag</em> - one bucket per Dot1Q VLAN or QinQ inner/outer pair. ' +
        'That answers questions like "which of my 100 VLANs dropped packets through the DUT?" without one stream per ' +
        'counter on the rx side.</p>' +
        '<h4>The tags file</h4><p>This tab generates <code>&lt;name&gt;_tpg_tags.json</code>: a list whose ' +
        '<strong>index is the tag id</strong>. QinQ pairs come first, then every VLAN of each Dot1Q range in order - ' +
        'the same shapes as the shipped <code>stl/tpg_tags_conf.py</code>. The builder warns on out-of-range or ' +
        'duplicate VLANs.</p>' +
        '<h4>Using it</h4><p>The <code>TPG_CONSOLE.txt</code> runbook has the verified console sequence: ' +
        '<code>tpg_enable --ports 0 1 --num-tpgids N --tags file.json</code>, then start streams whose ' +
        '<code>flow_stats=STLTaggedPktGroup(tpgid=i)</code> (build them in the STL tab with a VLAN per stream, like ' +
        'stl/tpg_1tag_stream.py), read <code>tpg_stats</code> per port/tpgid/tag range, and <code>tpg_disable</code> ' +
        'when done.</p>' +
        '<p class="man-note">num-tpgids is an upper bound: every stream\'s tpgid must stay below it.</p>' +
        fieldTable('tpg');
    } },

    { id: 'bird', title: 'BIRD routing configs', html: function () {
      return tabIntro('bird') +
        '<h4>What the integration is</h4><p>TRex ships the BIRD routing daemon and runs it inside a Linux network ' +
        'namespace wired to the traffic ports via veth nodes. BIRD then speaks real BGP/OSPF/RIP with the DUT and can ' +
        'advertise huge route tables - so routed DUTs forward the test traffic exactly as they would production ' +
        'routes.</p>' +
        '<h4>This tab</h4><p>Builds <code>bird_&lt;name&gt;.conf</code> in the exact shipped <code>bird/cfg</code> ' +
        'shapes: BGP instances (local/neighbor IP + AS per session, IPv4 or IPv6 channel), OSPF (broadcast on all ' +
        'interfaces), RIP, and static-route tables where the builder expands <em>count</em> consecutive prefixes ' +
        'from a first prefix (stepping by the prefix size so they never overlap).</p>' +
        '<h4>Running it</h4><p><code>BIRD_RUNBOOK.txt</code> covers the prerequisites and the verified console flow: ' +
        '<code>stack: linux_based</code> in trex_cfg.yaml, <code>t-rex-64 -i --bird-server</code>, then ' +
        '<code>plugins load bird</code>, <code>plugins bird add_node</code> (the veth interface BIRD peers through) ' +
        'and <code>plugins bird set_config -f bird_&lt;name&gt;.conf</code>. For millions of routes the runbook shows ' +
        'the server-side generation flags (<code>--first-ip --total-routes --next-hop</code>) instead of writing ' +
        'every line into the file - the builder caps the emitted table at 5000 and warns.</p>' +
        fieldTable('bird');
    } },

    { id: 'scenarios', title: 'Scenarios (wizards)', html: function () {
      return tabIntro('scenarios') +
        '<h4>Connectivity check - prove routing before load</h4>' +
        '<p>Not a load test: a console-only runbook that validates the path end to end. Step 1 brings the ports up ' +
        'and resolves next hops (<code>service</code> mode + <code>arp -p 0 1</code>); step 2 pings a far-side ' +
        'address from each port (<code>ping -p 0 -d ...</code>) - replies in both directions prove ARP and IP ' +
        'routing through the DUT, and each reply prints an RTT. Optionally the wizard adds a tiny STL profile with ' +
        'one 64-byte latency stream at a near-zero rate: the tui latency window then shows average/jitter/max and ' +
        'drop counts across the data plane. The runbook ends with a failure-interpretation table (ARP vs one-way ' +
        'ping vs ICMP-only paths).</p>' +
        '<h4>Two servers - one sends, one receives</h4>' +
        '<p>Both boxes load the <strong>same ASTF profile</strong>; the flags decide the role:</p>' +
        '<ul><li>Receiver: <code>./t-rex-64 -i --astf --astf-server-only ...</code> - answers connections only.</li>' +
        '<li>Sender: <code>./t-rex-64 -i --astf --astf-client-mask 0x1 ...</code> then <code>start -f profile.py</code> ' +
        'in trex-console.</li></ul>' +
        '<p>The wizard emits the profile plus a RUNBOOK with those exact commands and a pre-flight checklist ' +
        '(the server box must own the server IP range; both ranges must route through the device under test). ' +
        'The STL alternative sends one-way packets and reads raw counters on the receiver. Ticking ' +
        '<strong>Bidirectional</strong> switches the runbook so BOTH boxes launch with ' +
        '<code>--astf-client-mask 0x1</code> and both start the profile: each box initiates from its port 0 while ' +
        'serving on the other port, giving simultaneous load in both directions (the DUT needs symmetric routing).</p>' +
        '<h4>Connection ramp - N increasing stages</h4>' +
        '<p>Enter any number of comma-separated stage rates (e.g. <code>100, 500, 1000, 2000</code>).</p>' +
        '<ul><li><strong>-m stepping</strong> (default): profile at the first rate; the runbook restarts with computed ' +
        'multipliers per stage. Exact plateaus, but flows restart between stages.</li>' +
        '<li><strong>rampup_sec</strong>: one profile at the top rate ramping linearly - smooth, no plateaus.</li>' +
        '<li><strong>STL staggered-isg</strong>: one stream per stage whose start delays add up to exact rate ' +
        'plateaus in a single profile.</li></ul>' +
        '<h4>NDR benchmark - automated no-drop-rate search</h4>' +
        '<p>Wraps the shipped <code>./ndr</code> tool: start an interactive TRex instance, then the generated command ' +
        'binary-searches for the highest rate whose drops stay within your PDR (STL: percent of line rate, needs an ' +
        'even <code>--ports</code> list; ASTF: a <code>-m</code> multiplier between explicit low/high bounds). ' +
        'Options cover iteration time/count, the q-full threshold, an optional latency gate ' +
        '(<code>--max-latency</code>/<code>--lat-tolerance</code>) and JSON result output. The wizard can generate a ' +
        'simple profile to benchmark or point at any existing profile on the box.</p>' +
        '<p><em>Open in builder</em> drops the generated model into the STL/ASTF tab for further editing.</p>' +
        fieldTable('scenarios');
    } },

    { id: 'cfg', title: 'Platform Config (trex_cfg.yaml)', html: function () {
      return tabIntro('cfg') +
        '<p>Select a server from the Settings registry and the tab renders its <code>trex_cfg.yaml</code>: the file ' +
        'that tells TRex which PCI NICs to own, how many cores to use, and each port\'s identity (IP/gateway for L3, ' +
        'or a static MAC pair for L2). Install it as <code>/etc/trex_cfg.yaml</code> on the box or pass ' +
        '<code>--cfg &lt;path&gt;</code>.</p>' +
        '<p class="man-note">The file must be a single-element YAML list - the generator always emits the mandatory ' +
        'leading dash. Warnings catch thread-pinning collisions, mixed port modes and un-cross-wired MAC pairs.</p>' +
        fieldTable('cfg');
    } },

    { id: 'cli', title: 'CLI Builder', html: function () {
      return tabIntro('cli') +
        '<p>Composes the <code>t-rex-64</code> launch line with only the flags valid for the chosen mode, and - for ' +
        'interactive modes - the matching <code>trex-console</code> session (where -m, -d and the profile actually ' +
        'live). Downloads as a ready <code>run_&lt;name&gt;.sh</code>.</p>' +
        '<p>The two-server flags mirror the Scenarios runbooks: tick <em>server-only</em> on the receiver box\'s ' +
        'command, set a <em>client mask</em> on the sender\'s.</p>' +
        '<p>The <strong>service mode &amp; capture</strong> section (interactive modes) appends a console block to ' +
        'CONSOLE.txt: put ports in service mode (they answer ARP/ping), record packets into a buffer and write them ' +
        'to a pcap (<code>capture record</code>), or watch them live (<code>capture monitor</code>), with optional ' +
        'BPF filters like <code>udp port 53</code>. The block always ends with <code>service --off</code> - service ' +
        'mode forwards rx traffic to software, so never measure performance with it on.</p>' + fieldTable('cli');
    } },

    { id: 'settings', title: 'Settings', html: function () {
      return tabIntro('settings') +
        '<p>App defaults plus the <strong>server registry</strong> - one entry per TRex box. The Platform Config tab ' +
        'turns an entry into trex_cfg.yaml; the CLI Builder prefills cores and paths from it. Everything saves as you ' +
        'type; <em>Export workspace</em> (header) backs up settings and all saved profiles as one JSON file.</p>' +
        '<p>The <strong>Text size</strong> section scales the app text on every screen: <em>All text</em> is a global ' +
        'multiplier, and the remaining sliders fine-tune element groups (field names &amp; hints, controls, generated ' +
        'output, manual/tooltips) on top of it. Changes apply live and persist with the workspace.</p>' +
        '<p>Workspaces persist in the browser\'s <strong>IndexedDB</strong> (no practical size ceiling; the bottom of ' +
        'the tab shows the active storage backend). Older localStorage workspaces migrate over automatically on first ' +
        'load, and localStorage remains the fallback where IndexedDB is unavailable.</p>' +
        fieldTable('settings');
    } },

    { id: 'onbox', title: 'Running on the TRex box', html: function () {
      return '<h4>Validate generated profiles</h4>' +
        '<p>Every generated profile header contains its validation command:</p>' +
        '<pre class="code">./stl-sim -f profile.py -o /tmp/out.pcap -l 50\n./astf-sim -f profile.py --full -o /tmp/</pre>' +
        '<p>Run them in the TRex directory - exit code 0 means TRex parses and simulates the profile.</p>' +
        '<h4>Typical interactive run</h4>' +
        '<pre class="code">sudo ./t-rex-64 -i --astf --cfg /etc/trex_cfg.yaml -c 4\n# second terminal:\n./trex-console\ntrex&gt; start -f profile.py -m 1 -d 60\ntrex&gt; tui</pre>' +
        '<h4>Hosting this app on the box</h4>' +
        '<pre class="code">pip install flask\nTREX_DIR=/opt/trex/v3.06 python app.py</pre>' +
        '<p>Then browse to port 8080: pcap Browse… and server-side Validate light up automatically.</p>';
    } },

    { id: 'tests', title: 'Self tests', html: function () {
      return '<p>The app ships its own test suite: <a href="tests.html" target="_blank" rel="noopener">open ' +
        'tests.html ↗</a> (also linked as <em>self tests</em> in the header). Every test runs automatically, in your ' +
        'browser, each time that page loads - reload to re-run. No framework, build step or external tooling is ' +
        'involved: the page loads the same generator files as this app and asserts on their output, so it works from ' +
        'disk or hosted, anywhere the app itself runs.</p>' +
        '<h4>What is covered</h4>' +
        '<p>Every generator the app has: STL, ASTF, cap2, platform config, CLI, the scenario wizards and the ' +
        'plain-English summaries, plus app plumbing (version registry, IndexedDB/localStorage persistence, the ZIP ' +
        'bundle writer, backend bridge). ' +
        'The test page groups them by area and documents what each test verifies, right under its PASS/FAIL row.</p>' +
        '<h4>Four kinds of test</h4>' +
        '<ul>' +
        '<li><strong>Goldens</strong> - build a profile model in code, generate with a pinned date, compare ' +
        'character-for-character against an expected file. Fixtures mirror profiles shipped with TRex v3.06 ' +
        '(stl/imix.py, astf/http_simple.py, cap2/dns.yaml...), and the expected outputs were validated at authoring ' +
        'time by compiling the generated Python and running it through <code>stl-sim</code>/<code>astf-sim</code>. ' +
        'A one-character change in generator output fails the golden and prints the first differing line.</li>' +
        '<li><strong>Structural checks</strong> - assert key lines appear where a full golden would be brittle.</li>' +
        '<li><strong>Warning tests</strong> - feed deliberately broken models in, expect the right human-readable ' +
        'warning out.</li>' +
        '<li><strong>Round-trips</strong> - serialise a model to JSON and back; regeneration must be byte-identical. ' +
        'This is the guarantee that saved <code>.trexb.json</code> models stay reloadable across versions.</li>' +
        '</ul>' +
        '<h4>When they run</h4>' +
        '<p>On every load of the test page - there is no scheduler or CI hook. The working practice: open the page ' +
        'after touching anything under <code>js/gen/</code> and before every commit; each feature added to the app ' +
        'lands together with its tests in the same commit. A meta-test fails the suite if any test is missing its ' +
        'write-up, so the documentation cannot drift from the test list.</p>' +
        '<p class="man-note">Goldens are meant to fail when generated output changes. If a change is intentional, ' +
        'update the golden in the same commit - never loosen a golden to "make it pass".</p>';
    } },

    { id: 'future', title: 'Future updates', html: function () {
      /* status: 'planned' | 'in-progress' | 'done' - flip this field as work happens.
       * It is the single tracker for the roadmap; nothing duplicates it elsewhere. */
      var rows = [
        /* [area, improvement, what it adds, effort, status] */
        ['STL builder', 'Rate units beyond pps', 'STLTXCont also accepts bps_L1/bps_L2 and percentage-of-line-rate; a unit selector would match how tests are usually specified.', 'Small', 'done'],
        ['STL builder', 'Pcap replay streams', 'STLProfile.load_pcap(file, ipg_usec, loop_count) - replay a capture as a stateless stream, like the shipped stl/pcap.py.', 'Medium', 'done'],
        ['STL builder', 'Tunnel encapsulations', 'VXLAN, MPLS, GRE, QinQ (stacked VLANs) and NSH header layers - TRex supports them all via scapy.', 'Medium', 'done'],
        ['STL builder', 'More packet presets', 'ICMP echo, ARP, DNS-query payloads, IPv6 extension headers and fragments (see stl/udp_1pkt_dns.py, udp_1pkt_frag.py).', 'Medium', 'done'],
        ['STL builder', 'IMIX preset button', 'One click to load the classic 60/590/1514 three-stream IMIX table.', 'Small', 'done'],
        ['STL builder', 'Richer field engine', 'Dependent variables, write offset fixups, per-core split control (stl/dependent_field_engine_vars.py, split_var_to_cores.py).', 'Medium', 'done'],
        ['ASTF builder', 'HTTPS/TLS traffic', 'In v3.06 via TLS pcaps (avl/delay_10_https_0.pcap preset); newer TRex adds native TLS program support.', 'Medium', 'done'],
        ['ASTF builder', 'L7 protocol presets', 'One-click DNS/SIP/RTP UDP programs and an EMIX/SFR-style multi-pcap enterprise mix preset.', 'Small', 'done'],
        ['ASTF builder', 'Elephant-flow preset', 'Long keep-alive template with looped large sends (astf/http_eflow.py pattern) for throughput soak tests.', 'Small', 'done'],
        ['ASTF builder', 'GTP-U tunnel topology', 'Mobile-network testing via tunnels_topo (astf/gtpu_topo.py): per-connection GTP-U encapsulation with TEID ranges.', 'Large', 'done'],
        ['Scenarios', 'Connectivity check', 'Prove L2/L3 + routing before any load test: service-mode ARP/ping runbook, optional low-rate latency probe profile.', 'Small', 'done'],
        ['Scenarios', 'NDR benchmark wizard', 'Drive the shipped ./ndr script: find the no-drop rate automatically instead of manual -m stepping.', 'Medium', 'done'],
        ['Scenarios', 'N-stage ramp', 'Generalise the low/mid/high wizard to any number of stages.', 'Small', 'done'],
        ['Scenarios', 'Bidirectional two-server', 'Both boxes run client AND server roles simultaneously (client masks on both sides).', 'Medium', 'done'],
        ['New domain', 'TRex-EMU profiles', 'Client emulation profiles: ARP, DHCPv4/v6, ICMP, IGMP, IPv6 ND, DNS/mDNS - a whole additional TRex subsystem.', 'Large', 'done'],
        ['New domain', 'TPG configuration', 'Tagged Packet Group setup (tpg_tags_conf.json) for per-tag rx stats on DOT1Q/QinQ.', 'Medium', 'done'],
        ['New domain', 'BIRD routing configs', 'TRex ships a BIRD integration (BGP/OSPF/RIP, millions of routes); a config builder would suit routed DUT tests.', 'Large', 'done'],
        ['App platform', 'Adjustable text size', 'Settings -> Text size: a global scale plus per-group sliders (field names, controls, generated output, manual) - applied live via CSS variables, saved with the workspace.', 'Small', 'done'],
        ['CLI builder', 'Service mode & capture helper', 'Console snippets for service mode, capture record/monitor and BPF filters.', 'Small', 'done'],
        ['App platform', 'Publish to server (control seam)', 'Push a generated STL profile straight to a running TRex-Backend (Publish to server, output pane); it lands allowlisted in that box’s dashboard with its summary. Live control itself lives in the separate TRex-Backend/dashboard, kept small on purpose.', 'Medium', 'done'],
        ['App platform', 'Re-import cap2 .yaml profiles', 'Load a generated (or hand-written) cap2 .yaml back into the builder (Import… button). Values are read from the file body, so hand-edits (a changed IP or rate) are honoured; a one-line tag marks builder files. Other .yaml files parse best-effort and you are told how much could be mapped.', 'Large', 'done'],
        ['App platform', 'Re-import .py profiles (STL/ASTF)', 'Extend the same body-is-truth re-edit seam to the Python builders. The tag scheme and coverage report are shared and proven (cap2); the remaining work is per-field readers ("codecs") that locate each value in the generated Python and segmentation of repeated blocks (streams / templates) - genuinely hard for arbitrary Python, realistic only for app-generated layout, with a structural fingerprint for parse-confidence as a possible aid.', 'Large', 'in-progress'],
        ['cap2 builder', 'Common global cap2 fields', 'one_app_server + server_addr (13 shipped files), track_ports (12) and the source mac array (7) - the high-frequency fields real v3.06 cap2 profiles use that the builder does not model yet. Ranked from a 67-file import-coverage run; adding them lifts most partial imports to 100% and lets the AVL/sfr benchmark profiles regenerate losslessly.', 'Small', 'planned'],
        ['cap2 builder', 'cap2 IPv6 base + timer-wheel + per-template IP ranges', 'src_ipv6/dst_ipv6 base addresses (ipv6*.yaml), the timer-wheel tw block (buckets/levels/bucket_time_usec), and per-template min/max_src/dst_ip overrides (rtsp/sfr_agg). Medium-frequency gaps from the same coverage run.', 'Medium', 'planned'],
        ['cap2 builder', 'Per-template generator pools', 'Named client/server pools (generator_clients/generator_servers, per-template client_pool/server_pool) used by per_template_gen*/many_client_example - a richer generator model than the single client/server range. The only real <60% importers in the 67-file run.', 'Large', 'planned'],
        ['App platform', 'Bundle export', 'Download profile + cfg + runbook + launch script as one zip per test.', 'Small', 'done'],
        ['App platform', 'Undo/redo in builders', 'Model snapshots per edit; cheap because models are already plain JSON.', 'Medium', 'done'],
        ['Performance', 'IndexedDB workspace store', 'localStorage caps at ~5 MB; IndexedDB removes the ceiling for pcap-heavy workspaces. App-side performance is otherwise not a bottleneck (generation is instant, debounced at 120 ms).', 'Small', 'done']
      ];
      var STATUS_LABEL = { planned: 'Planned', 'in-progress': 'In progress', done: 'Done' };
      var pending = rows.filter(function (r) { return r[4] !== 'done'; }).length;
      return '<p>Candidate improvements, mapped against the full TRex feature set ' +
        '(trex-tgn.cisco.com). None are required for day-to-day use - the current app covers STL, ASTF, cap2, ' +
        'EMU, TPG, BIRD, platform config, CLI and the scenario wizards end to end.</p>' +
        '<p class="man-purpose">' + pending + ' of ' + rows.length + ' open. Status lives only here - flip the ' +
        '5th field of a row in js/ui/manual.js when work starts or finishes.</p>' +
        '<table class="man-table"><tr><th>Area</th><th>Improvement</th><th>What it adds</th><th>Effort</th><th>Status</th></tr>' +
        rows.map(function (r) {
          var status = r[4] || 'planned';
          var rowClass = status === 'done' ? ' class="man-row-done"' : '';
          return '<tr' + rowClass + '><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td>' + esc(r[3]) + '</td>' +
            '<td><span class="man-status man-status-' + status + '">' + STATUS_LABEL[status] + '</span></td></tr>';
        }).join('') + '</table>' +

        '<h4>How to add support for a new TRex version (3.07, 3.08, …)</h4>' +
        '<p>The app was built version-aware from day one: every saved model carries its <code>trexVersion</code>, ' +
        'and all code generation goes through a per-version registry. Adding a version never requires touching the ' +
        'UI or migrating saved profiles.</p>' +
        '<ol>' +
        '<li><strong>Diff the example trees.</strong> Unpack the new TRex release and compare its <code>stl/</code>, ' +
        '<code>astf/</code> and <code>cfg/</code> examples against v3.06 to spot API changes (new kwargs, renamed ' +
        'fields, new CLI flags).</li>' +
        '<li><strong>Register a generator set</strong> in a new file (e.g. <code>js/gen/v307.js</code>), delegating ' +
        'everything unchanged to 3.06 and overriding only the deltas:</li></ol>' +
        '<pre class="code">var base = TB.gen.registry[\'3.06\'];\n' +
        'TB.gen.registry[\'3.07\'] = {\n' +
        '  stl: base.stl,                      // unchanged - reuse\n' +
        '  astf: function (model, opts) {      // changed - wrap or rewrite\n' +
        '    var r = base.astf(model, opts);\n' +
        '    /* apply 3.07-specific tweaks to r.files[0].content */\n' +
        '    return r;\n' +
        '  },\n' +
        '  cfg: base.cfg, cli: base.cli, cap2: base.cap2,\n' +
        '  summarize: base.summarize           // reuse or override phrasing\n' +
        '};</pre>' +
        '<ol start="3">' +
        '<li><strong>Load the file</strong> with a <code>&lt;script&gt;</code> tag in <code>index.html</code> and ' +
        '<code>tests.html</code> (after <code>js/gen/registry.js</code>). The version dropdowns list registry keys ' +
        'automatically - "v3.07" appears everywhere at once.</li>' +
        '<li><strong>Add per-version goldens</strong>: copy a handful of the new release\'s shipped examples as ' +
        'fixtures in <code>tests.html</code> and assert the 3.07 generators reproduce them.</li>' +
        '<li><strong>Validate on the box</strong> with the new release\'s <code>stl-sim</code>/<code>astf-sim</code>, ' +
        'and flip the default version in Settings when ready. Old profiles keep generating with their saved version ' +
        'until you switch them.</li></ol>' +
        '<p class="man-note">Rule of thumb: version-specific knowledge lives ONLY in <code>js/gen/*</code>. If adding ' +
        'a version tempts you to edit a UI file, add the capability to the model instead and let each version\'s ' +
        'generator decide what to emit.</p>';
    } },

    { id: 'glossary', title: 'Glossary', html: function () {
      var terms = [
        ['cps', 'Connections per second. In ASTF/cap2 profiles it is the rate contributed at -m 1.'],
        ['-m multiplier', 'Console/CLI factor scaling every stream or template proportionally at run time.'],
        ['pps', 'Packets per second (STL stream rate).'],
        ['isg', 'Inter-stream gap: microseconds before an STL stream starts. Staggered isg values build ramps.'],
        ['pg_id', 'Packet-group id keying per-stream flow/latency statistics. Unique per latency stream.'],
        ['Field Engine / VM', 'TRex\'s per-packet mutation engine: sweeps, randomisation, tuple pools.'],
        ['dual_if', 'trex_cfg.yaml block pinning data-plane threads to a NUMA socket per port pair.'],
        ['dual_port_mask / ip_offset', 'IP offset separating the pools of each extra port pair.'],
        ['dyn_pyload', 'cap2 feature rewriting payload bytes of replayed packets per flow.'],
        ['rampup_sec', 'ASTF scheduler option: linear CPS ramp reaching full rate after N seconds (client side).'],
        ['--astf-server-only / --astf-client-mask', 'Split ASTF roles across boxes: one only answers, the other drives connections from the masked ports.'],
        ['stl-sim / astf-sim', 'Offline simulators shipped with TRex used to validate profiles without hardware.']
      ];
      return '<table class="man-table"><tr><th>Term</th><th>Meaning</th></tr>' +
        terms.map(function (t) { return '<tr><td>' + esc(t[0]) + '</td><td>' + esc(t[1]) + '</td></tr>'; }).join('') +
        '</table>';
    } }
  ];

  TB.ui.manual = {
    mount: function (container) {
      var el = TB.ui.el;
      var toc = el('div', { class: 'man-toc' }, [el('div', { class: 'pane-title', text: 'Manual' })]);
      var content = el('div', { class: 'man-content' });

      CHAPTERS.forEach(function (ch) {
        var sec = el('div', { class: 'man-chapter', id: 'man-' + ch.id });
        sec.appendChild(el('h3', { text: ch.title }));
        var body = el('div', {});
        body.innerHTML = ch.html();
        sec.appendChild(body);
        content.appendChild(sec);

        toc.appendChild(el('a', {
          class: 'man-toc-link', text: ch.title,
          onclick: function () { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }));
      });

      container.appendChild(el('div', { class: 'man-wrap' }, [toc, content]));
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
