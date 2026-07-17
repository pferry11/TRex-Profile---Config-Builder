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
        '(STL, ASTF, cap2), the platform config (trex_cfg.yaml), and launch commands. Nothing runs in the ' +
        'browser - you <strong>Copy</strong> or <strong>Download</strong> the generated files and use them on your TRex box.</p>' +
        '<h4>Two ways to run the app</h4>' +
        '<ul><li><strong>No server:</strong> open <code>index.html</code> from disk. Everything works.</li>' +
        '<li><strong>Hosted on the TRex box:</strong> <code>pip install flask</code> then ' +
        '<code>TREX_DIR=/opt/trex/v3.06 python app.py</code>. This unlocks the <em>Browse…</em> buttons on pcap ' +
        'fields (lists real pcaps on the box) and <em>Validate on server</em> (runs stl-sim/astf-sim and shows the result).</li></ul>' +
        '<h4>The three output actions</h4>' +
        '<p>Every generated artifact offers <strong>Copy</strong>, <strong>Download</strong> (the .py/.yaml file itself) and ' +
        '<strong>Download model</strong> - a JSON file that re-imports into the builder later, so you can keep editing ' +
        'a profile long after it was made. Profiles also <strong>Save</strong> into the browser (localStorage); use ' +
        '<strong>Export workspace</strong> in the header for a durable backup of everything.</p>' +
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
        'across two tags; <code>plugin_id</code> enables HTTP/DHCP-aware replay.</p>' + fieldTable('cap2');
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
        'command, set a <em>client mask</em> on the sender\'s.</p>' + fieldTable('cli');
    } },

    { id: 'settings', title: 'Settings', html: function () {
      return tabIntro('settings') +
        '<p>App defaults plus the <strong>server registry</strong> - one entry per TRex box. The Platform Config tab ' +
        'turns an entry into trex_cfg.yaml; the CLI Builder prefills cores and paths from it. Everything saves as you ' +
        'type; <em>Export workspace</em> (header) backs up settings and all saved profiles as one JSON file.</p>' +
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
        'plain-English summaries, plus app plumbing (version registry, localStorage persistence, backend bridge). ' +
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
        ['New domain', 'TRex-EMU profiles', 'Client emulation profiles: ARP, DHCPv4/v6, ICMP, IGMP, IPv6 ND, DNS/mDNS - a whole additional TRex subsystem.', 'Large', 'planned'],
        ['New domain', 'TPG configuration', 'Tagged Packet Group setup (tpg_tags_conf.json) for per-tag rx stats on DOT1Q/QinQ.', 'Medium', 'planned'],
        ['New domain', 'BIRD routing configs', 'TRex ships a BIRD integration (BGP/OSPF/RIP, millions of routes); a config builder would suit routed DUT tests.', 'Large', 'planned'],
        ['CLI builder', 'Service mode & capture helper', 'Console snippets for service mode, capture record/monitor and BPF filters.', 'Small', 'planned'],
        ['App platform', 'Live TRex control', 'Extend the Flask backend to the TRex automation API: push a profile, start/stop, live stats - the app becomes a controller, not just a generator.', 'Large', 'planned'],
        ['App platform', 'Import existing .py profiles', 'Parse shipped/hand-written profiles back into editable models. Python parsing in JS is genuinely hard - realistic only for app-generated files.', 'Large', 'planned'],
        ['App platform', 'Bundle export', 'Download profile + cfg + runbook + launch script as one zip per test.', 'Small', 'planned'],
        ['App platform', 'Undo/redo in builders', 'Model snapshots per edit; cheap because models are already plain JSON.', 'Medium', 'planned'],
        ['Performance', 'IndexedDB workspace store', 'localStorage caps at ~5 MB; IndexedDB removes the ceiling for pcap-heavy workspaces. App-side performance is otherwise not a bottleneck (generation is instant, debounced at 120 ms).', 'Small', 'planned']
      ];
      var STATUS_LABEL = { planned: 'Planned', 'in-progress': 'In progress', done: 'Done' };
      var pending = rows.filter(function (r) { return r[4] !== 'done'; }).length;
      return '<p>Candidate improvements, mapped against the full TRex feature set ' +
        '(trex-tgn.cisco.com). None are required for day-to-day use - the current app covers STL, ASTF, cap2, ' +
        'platform config, CLI and the two key scenarios end to end.</p>' +
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
