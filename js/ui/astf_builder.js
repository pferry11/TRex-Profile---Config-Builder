/* TRex Profile & Config Builder - ASTF profile builder tab.
 * Modes: pcap-list (ASTFCapInfo rows) and program (client/server command editors). */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  var OPS = [
    { op: 'send', label: 'send (TCP)' },
    { op: 'recv', label: 'recv (TCP)' },
    { op: 'send_msg', label: 'send_msg (UDP)' },
    { op: 'recv_msg', label: 'recv_msg (UDP)' },
    { op: 'delay', label: 'delay' },
    { op: 'delay_rand', label: 'delay random' },
    { op: 'set_var', label: 'set_var (loop counter)' },
    { op: 'set_label', label: 'set_label' },
    { op: 'jmp_nz', label: 'jmp_nz (loop jump)' },
    { op: 'wait_for_peer_close', label: 'wait_for_peer_close' }
  ];

  function defaultCommand(op, isUdp) {
    switch (op) {
      case 'send': case 'send_msg':
        return { op: op, payload: { kind: 'text', text: 'hello' } };
      case 'recv': return { op: 'recv', bytes: null };
      case 'recv_msg': return { op: 'recv_msg', count: 1 };
      case 'delay': return { op: 'delay', usec: 1000 };
      case 'delay_rand': return { op: 'delay_rand', minUsec: 100000, maxUsec: 500000 };
      case 'set_var': return { op: 'set_var', id: 'var1', value: 10 };
      case 'set_label': return { op: 'set_label', name: 'a:' };
      case 'jmp_nz': return { op: 'jmp_nz', id: 'var1', label: 'a:' };
      default: return { op: 'wait_for_peer_close' };
    }
  }

  function defaultTemplate(n) {
    return {
      id: TB.util.uid('t'),
      tgName: null,
      cps: 1,
      assocPort: 80,
      stream: true,
      client: { commands: [
        { op: 'send', payload: { kind: 'httpRequest' } },
        { op: 'recv', bytes: null }
      ] },
      server: { commands: [
        { op: 'recv', bytes: null },
        { op: 'send', payload: { kind: 'httpResponse', bodyBytes: 32768 } }
      ] },
      ipGenOverride: null
    };
  }

  function defaultCap() {
    return { file: '../avl/delay_10_http_browsing_0.pcap', cps: 2.776, port: null, sDelayUsec: null, ipGenOverride: null };
  }

  /* ---------- one-click presets ---------- */

  function repeat(ch, n) { return new Array(n + 1).join(ch); }

  var SIP_INVITE = 'INVITE sip:bob@example.com SIP/2.0\r\nVia: SIP/2.0/UDP 16.0.0.1:5060\r\n' +
    'From: <sip:alice@example.com>\r\nTo: <sip:bob@example.com>\r\nCall-ID: 1@16.0.0.1\r\n' +
    'CSeq: 1 INVITE\r\nContent-Length: 0\r\n\r\n';
  var SIP_OK = 'SIP/2.0 200 OK\r\nVia: SIP/2.0/UDP 16.0.0.1:5060\r\n' +
    'From: <sip:alice@example.com>\r\nTo: <sip:bob@example.com>\r\nCall-ID: 1@16.0.0.1\r\n' +
    'CSeq: 1 INVITE\r\nContent-Length: 0\r\n\r\n';
  var SIP_ACK = 'ACK sip:bob@example.com SIP/2.0\r\nVia: SIP/2.0/UDP 16.0.0.1:5060\r\n' +
    'From: <sip:alice@example.com>\r\nTo: <sip:bob@example.com>\r\nCall-ID: 1@16.0.0.1\r\n' +
    'CSeq: 1 ACK\r\nContent-Length: 0\r\n\r\n';

  function presetTemplate(over) {
    var t = defaultTemplate(1);
    for (var k in over) { t[k] = over[k]; }
    return t;
  }

  /* Each preset mutates the model in place; the caller re-renders. */
  var PRESETS = [
    { label: 'DNS', title: 'One UDP template: 33-byte query, server answers - the classic high-cps small-flow test.',
      apply: function (model) {
        model.mode = 'program';
        model.templates = [presetTemplate({ tgName: 'dns', cps: 30, assocPort: 53, stream: false,
          client: { commands: [
            { op: 'send_msg', payload: { kind: 'text', text: 'dns-query: www.example.com type A' } },
            { op: 'recv_msg', count: 1 }
          ] },
          server: { commands: [
            { op: 'recv_msg', count: 1 },
            { op: 'send_msg', payload: { kind: 'text', text: 'dns-response: www.example.com A 48.0.0.1 ttl 300' } }
          ] } })];
      } },
    { label: 'SIP', title: 'UDP INVITE / 200 OK / ACK handshake on port 5060.',
      apply: function (model) {
        model.mode = 'program';
        model.templates = [presetTemplate({ tgName: 'sip', cps: 5, assocPort: 5060, stream: false,
          client: { commands: [
            { op: 'send_msg', payload: { kind: 'text', text: SIP_INVITE } },
            { op: 'recv_msg', count: 1 },
            { op: 'send_msg', payload: { kind: 'text', text: SIP_ACK } }
          ] },
          server: { commands: [
            { op: 'recv_msg', count: 1 },
            { op: 'send_msg', payload: { kind: 'text', text: SIP_OK } },
            { op: 'recv_msg', count: 1 }
          ] } })];
      } },
    { label: 'RTP', title: 'UDP media stream: 50 x 160-byte packets at 20 ms spacing (one talkspurt).',
      apply: function (model) {
        model.mode = 'program';
        model.templates = [presetTemplate({ tgName: 'rtp', cps: 2, assocPort: 5004, stream: false,
          client: { commands: [
            { op: 'set_var', id: 'var1', value: 50 },
            { op: 'set_label', name: 'a:' },
            { op: 'send_msg', payload: { kind: 'text', text: repeat('x', 160) } },
            { op: 'delay', usec: 20000 },
            { op: 'jmp_nz', id: 'var1', label: 'a:' }
          ] },
          server: { commands: [
            { op: 'recv_msg', count: 50 }
          ] } })];
      } },
    { label: 'HTTPS (TLS)', title: 'TLS traffic the v3.06 way (astf/http_https.py): replays the shipped TLS pcap alongside plain HTTP browsing. Newer TRex releases add native TLS programs.',
      apply: function (model) {
        model.mode = 'pcap';
        model.capList = [
          { file: '../avl/delay_10_http_browsing_0.pcap', cps: 1, port: null, sDelayUsec: null, ipGenOverride: null },
          { file: '../avl/delay_10_https_0.pcap', cps: 1, port: null, sDelayUsec: null, ipGenOverride: null }
        ];
      } },
    { label: 'Enterprise mix (SFR)', title: 'SFR-style multi-pcap enterprise mix: browsing, mail, oracle, citrix, DNS... Rates are representative - tune per test.',
      apply: function (model) {
        model.mode = 'pcap';
        model.capList = [
          ['../avl/delay_10_http_browsing_0.pcap', 8.98],
          ['../avl/delay_10_http_get_0.pcap', 2.77],
          ['../avl/delay_10_http_post_0.pcap', 1.05],
          ['../avl/delay_10_https_0.pcap', 1.36],
          ['../avl/delay_10_exchange_0.pcap', 3.99],
          ['../avl/delay_10_mail_pop_0.pcap', 1.2],
          ['../avl/delay_10_smtp_0.pcap', 0.57],
          ['../avl/delay_10_oracle_0.pcap', 6.66],
          ['../avl/delay_10_citrix_0.pcap', 1.68],
          ['../avl/delay_dns_0.pcap', 33.2]
        ].map(function (row) {
          return { file: row[0], cps: row[1], port: null, sDelayUsec: null, ipGenOverride: null };
        });
      } },
    { label: 'Elephant flow', title: 'Throughput soak (http_eflow.py pattern): one keep-alive connection, server loops 100 x 64 KB sends; big TCP buffers.',
      apply: function (model) {
        var body = 65536;
        var loop = 100;
        var chunkLen = TB.gen.astfHttpResponseHeader(body).length + body;
        model.mode = 'program';
        model.templates = [presetTemplate({ tgName: 'eflow', cps: 1, assocPort: 80, stream: true,
          client: { commands: [
            { op: 'send', payload: { kind: 'httpRequest' } },
            { op: 'recv', bytes: chunkLen * loop }
          ] },
          server: { commands: [
            { op: 'recv', bytes: null },
            { op: 'set_var', id: 'var1', value: loop },
            { op: 'set_label', name: 'a:' },
            { op: 'send', payload: { kind: 'httpResponse', bodyBytes: body } },
            { op: 'jmp_nz', id: 'var1', label: 'a:' }
          ] } })];
        model.globals.client.tcp.rxbufsize = 262144;
        model.globals.client.tcp.txbufsize = 262144;
        model.globals.server.tcp.rxbufsize = 262144;
        model.globals.server.tcp.txbufsize = 262144;
      } }
  ];

  function sideGlobals() {
    return {
      tcp: { mss: null, rxbufsize: null, txbufsize: null, initwnd: null, no_delay: null,
             do_rfc1323: null, keepinit: null, keepidle: null, keepintvl: null },
      scheduler: { rampupSec: null },
      ipv6: { enable: false, srcMsb: '', dstMsb: '' }
    };
  }

  function defaultModel() {
    return {
      kind: 'astf',
      schemaVersion: 1,
      trexVersion: TB.settings.get().defaults.trexVersion,
      meta: { name: 'my_astf_profile', description: '', modified: '' },
      ipGen: {
        client: { start: '16.0.0.1', end: '16.0.0.255', distribution: 'seq', perCore: null },
        server: { start: '48.0.0.1', end: '48.0.255.255', distribution: 'seq', perCore: null },
        ipOffset: '1.0.0.0'
      },
      globals: { client: sideGlobals(), server: sideGlobals() },
      mode: 'pcap',
      capList: [defaultCap()],
      templates: [defaultTemplate(1)],
      tunnelsTopo: { enabled: false,
        ctxs: [{ srcStart: '16.0.0.1', srcEnd: '16.0.0.255', initialTeid: 0, teidJump: 1,
                 sport: 5000, version: 4, srcIp: '1.1.1.11', dstIp: '12.2.2.2', activate: true }] }
    };
  }

  TB.ui.astfBuilder = {
    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;

      var model = defaultModel();
      var selectedIdx = 0; // index into capList or templates depending on mode
      var regenTimer = null;
      var history = TB.history.create();
      var histCtl = TB.ui.historyControls(history, function (m) {
        model = m;
        var n = model.mode === 'pcap' ? model.capList.length : model.templates.length;
        if (selectedIdx >= n) { selectedIdx = Math.max(0, n - 1); }
        renderAll();
      });

      TB.ui.ensurePcapDatalist();

      /* Two visually distinct regions (same restructure as the STL tab) so a
       * collapsed setting bar never reads as a heading for the panes below:
       *   1. "Profile-wide settings" group - L7 presets + GTP-U topology
       *   2. the traffic work area          - list | profile editor | output  */
      var topbar = el('div', { class: 'builder-topbar' });
      var presetBox = el('div', { class: 'tunables-box' });
      var topoBox = el('div', { class: 'tunables-box' });
      var listPane = el('div', { class: 'pane pane-list' });
      var editorPane = el('div', { class: 'pane pane-editor' });
      var outputPane = el('div', { class: 'pane pane-output' });
      var workHead = el('div', { class: 'workarea-head' }, [
        el('span', { class: 'workarea-title', text: 'Templates' }),
        el('span', { class: 'workarea-hint', text: '' })
      ]);
      container.appendChild(topbar);
      container.appendChild(el('div', { class: 'builder-group' }, [
        el('div', { class: 'builder-group-title', text: 'Profile-wide settings' }),
        presetBox, topoBox
      ]));
      container.appendChild(workHead);
      container.appendChild(el('div', { class: 'builder-panes' }, [listPane, editorPane, outputPane]));

      /* keep the work-area banner in step with the pcap/program mode */
      function updateWorkHead() {
        var isPcap = model.mode === 'pcap';
        workHead.firstChild.textContent = isPcap ? 'Pcap entries' : 'Templates';
        workHead.lastChild.textContent = isPcap
          ? 'the pcap-replay entries this profile runs — list, editor & live output'
          : 'the send/recv templates this profile runs — list, editor & live output';
      }

      function renderPresets() {
        presetBox.innerHTML = '';
        var body = el('div', { class: 'field-row' });
        body.appendChild(el('span', { class: 'field-label', text: 'One click loads a ready-to-run profile (replaces the current entries):' }));
        PRESETS.forEach(function (pre) {
          body.appendChild(el('button', { class: 'btn btn-small', text: pre.label, title: pre.title,
            onclick: function () {
              if (!confirm('Load the ' + pre.label + ' preset? It replaces the current ' +
                           (model.mode === 'pcap' ? 'pcap entries' : 'templates') + '.')) { return; }
              pre.apply(model);
              selectedIdx = 0;
              renderAll();
              TB.ui.toast('Loaded ' + pre.label + ' preset', 'ok');
            } }));
        });
        presetBox.appendChild(TB.ui.section('L7 presets', body, false, TB.help.astf._sections.presets));
      }

      /* ---------- GTP-U tunnels topology ---------- */
      function defaultTopoCtx() {
        return { srcStart: '16.0.0.1', srcEnd: '16.0.0.255', initialTeid: 0, teidJump: 1,
                 sport: 5000, version: 4, srcIp: '1.1.1.11', dstIp: '12.2.2.2', activate: true };
      }

      function renderTopo() {
        topoBox.innerHTML = '';
        if (!model.tunnelsTopo) {   /* models saved before this feature */
          model.tunnelsTopo = { enabled: false, ctxs: [defaultTopoCtx()] };
        }
        var topo = model.tunnelsTopo;
        var body = el('div', {});
        body.appendChild(field({ label: 'Generate a GTP-U tunnels topology file alongside the profile',
          tip: TB.help.astf.topoOn, type: 'checkbox', value: topo.enabled,
          onChange: function (v) { topo.enabled = v; renderTopo(); regen(); } }));
        if (topo.enabled) {
          topo.ctxs.forEach(function (c, idx) {
            var row = el('div', { class: 'field-row' });
            row.appendChild(field({ label: 'Clients from', tip: TB.help.astf.topoSrcRange, type: 'text', value: c.srcStart, width: '100px',
              validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
              onChange: function (v) { c.srcStart = v || ''; regen(); } }));
            row.appendChild(field({ label: 'to', type: 'text', value: c.srcEnd, width: '100px',
              validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
              onChange: function (v) { c.srcEnd = v || ''; regen(); } }));
            row.appendChild(field({ label: 'Initial TEID', tip: TB.help.astf.topoTeid, type: 'int', value: c.initialTeid, width: '80px',
              onChange: function (v) { c.initialTeid = v === null ? 0 : v; regen(); } }));
            row.appendChild(field({ label: 'TEID jump', tip: TB.help.astf.topoTeidJump, type: 'int', value: c.teidJump, width: '70px',
              onChange: function (v) { c.teidJump = v === null ? 1 : v; regen(); } }));
            row.appendChild(field({ label: 'Src port', tip: TB.help.astf.topoSport, type: 'int', value: c.sport, width: '70px',
              onChange: function (v) { c.sport = v === null ? 5000 : v; regen(); } }));
            row.appendChild(field({ label: 'Outer IP ver', tip: TB.help.astf.topoVersion, type: 'select', value: String(c.version || 4),
              options: [{ value: '4', label: 'IPv4' }, { value: '6', label: 'IPv6' }],
              onChange: function (v) { c.version = parseInt(v, 10); regen(); } }));
            row.appendChild(field({ label: 'Outer src IP', tip: TB.help.astf.topoSrcIp, type: 'text', value: c.srcIp, width: '110px',
              onChange: function (v) { c.srcIp = v || ''; regen(); } }));
            row.appendChild(field({ label: 'Outer dst IP', tip: TB.help.astf.topoDstIp, type: 'text', value: c.dstIp, width: '110px',
              onChange: function (v) { c.dstIp = v || ''; regen(); } }));
            row.appendChild(field({ label: 'Active', tip: TB.help.astf.topoActivate, type: 'checkbox', value: c.activate !== false,
              onChange: function (v) { c.activate = v; regen(); } }));
            row.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
              onclick: function () { topo.ctxs.splice(idx, 1); renderTopo(); regen(); } }));
            body.appendChild(row);
          });
          body.appendChild(el('button', { class: 'btn btn-small', text: '+ Add tunnel context',
            onclick: function () {
              topo.ctxs.push(defaultTopoCtx());
              renderTopo(); regen();
            } }));
          body.appendChild(el('div', { class: 'info-note',
            text: 'The topology downloads as <profile>_topo.py. On the box, load it BEFORE starting: trex> tunnels_topo load -f <profile>_topo.py' }));
        }
        topoBox.appendChild(TB.ui.section('GTP-U tunnel topology (tunnels_topo)' + (topo.enabled ? ' — ACTIVE' : ''),
          body, topo.enabled, TB.help.astf._sections.tunnelsTopo));
      }

      function items() { return model.mode === 'pcap' ? model.capList : model.templates; }

      function regen() {
        if (regenTimer) { clearTimeout(regenTimer); }
        regenTimer = setTimeout(function () {
          history.record(model);
          var gen = TB.gen.resolve(model.trexVersion, 'astf');
          if (!gen) {
            outputPane.innerHTML = '';
            outputPane.appendChild(el('div', {
              class: 'output-empty',
              text: 'No ASTF generator registered for TRex v' + model.trexVersion + '.'
            }));
            return;
          }
          TB.ui.output.render(outputPane, { result: gen(model), model: model, validateKind: 'astf' });
        }, 120);
      }

      /* ---------- top bar ---------- */
      function renderTopbar() {
        topbar.innerHTML = '';
        topbar.appendChild(field({ label: 'Profile name', tip: TB.help.astf.profileName, type: 'text', value: model.meta.name, width: '160px',
          onChange: function (v) { model.meta.name = v || 'astf_profile'; regen(); } }));
        topbar.appendChild(field({ label: 'Description', type: 'text', value: model.meta.description, width: '180px',
          onChange: function (v) { model.meta.description = v || ''; regen(); } }));
        topbar.appendChild(field({ label: 'TRex version', tip: TB.help.astf.trexVersion, type: 'select', value: model.trexVersion,
          options: TB.gen.versions().map(function (v) { return { value: v, label: 'v' + v }; }),
          onChange: function (v) { model.trexVersion = v; regen(); } }));
        topbar.appendChild(field({ label: 'Mode', tip: TB.help.astf.mode, type: 'select', value: model.mode,
          options: [{ value: 'pcap', label: 'pcap list (ASTFCapInfo)' }, { value: 'program', label: 'program (send/recv)' }],
          onChange: function (v) {
            model.mode = v;
            if (v === 'pcap' && !model.capList.length) { model.capList.push(defaultCap()); }
            if (v === 'program' && !model.templates.length) { model.templates.push(defaultTemplate(1)); }
            selectedIdx = 0;
            renderList(); renderEditor(); regen();
          } }));

        var actions = el('div', { class: 'topbar-actions' });
        actions.appendChild(histCtl);
        actions.appendChild(el('button', { class: 'btn', text: 'New',
          onclick: function () {
            if (!confirm('Start a new profile? Unsaved changes are lost.')) { return; }
            model = defaultModel(); selectedIdx = 0; renderAll();
          } }));
        actions.appendChild(el('button', { class: 'btn', text: 'Save',
          onclick: function () {
            model.meta.modified = new Date().toISOString();
            var r = TB.persist.saveProfile(TB.util.deepClone(model));
            TB.ui.toast(r.ok ? 'Saved "' + model.meta.name + '"' : r.error, r.ok ? 'ok' : 'err');
            renderTopbar();
          } }));
        var savedSel = el('select', { class: 'saved-select' });
        savedSel.appendChild(el('option', { value: '', text: 'Saved profiles…' }));
        TB.persist.listProfiles('astf').forEach(function (m) {
          savedSel.appendChild(el('option', { value: m.meta.name, text: m.meta.name }));
        });
        actions.appendChild(savedSel);
        actions.appendChild(el('button', { class: 'btn', text: 'Load',
          onclick: function () {
            if (!savedSel.value) { return; }
            loadModel(TB.persist.getProfile('astf', savedSel.value));
          } }));
        actions.appendChild(el('button', { class: 'btn btn-secondary', text: 'Delete',
          onclick: function () {
            if (!savedSel.value || !confirm('Delete saved profile "' + savedSel.value + '"?')) { return; }
            TB.persist.deleteProfile('astf', savedSel.value);
            renderTopbar();
          } }));
        var fileInput = el('input', { type: 'file', accept: '.json' });
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', function () {
          var f = fileInput.files[0];
          if (!f) { return; }
          var reader = new FileReader();
          reader.onload = function () {
            try { loadModel(JSON.parse(reader.result)); }
            catch (e) { TB.ui.toast('Not valid JSON: ' + e.message, 'err'); }
          };
          reader.readAsText(f);
        });
        actions.appendChild(fileInput);
        actions.appendChild(el('button', { class: 'btn btn-secondary', text: 'Import model',
          onclick: function () { fileInput.click(); } }));
        topbar.appendChild(actions);
      }

      function loadModel(m) {
        if (!m) { TB.ui.toast('Profile not found', 'err'); return; }
        if (m.kind !== 'astf') { TB.ui.toast('Not an ASTF model (kind=' + m.kind + ')', 'err'); return; }
        if (m.schemaVersion > 1) {
          TB.ui.toast('Model schemaVersion ' + m.schemaVersion + ' is newer than this app supports (1).', 'err');
          return;
        }
        model = TB.util.deepClone(m);
        selectedIdx = 0;
        renderAll();
      }

      /* ---------- left pane: cap entries or templates ---------- */
      function renderList() {
        listPane.innerHTML = '';
        updateWorkHead();
        var isPcap = model.mode === 'pcap';
        listPane.appendChild(el('div', { class: 'pane-title', text: isPcap ? 'Pcap list' : 'Template list' }));
        items().forEach(function (it, idx) {
          var title = isPcap
            ? (it.file || '').split('/').pop()
            : (it.tgName || 'template ' + (idx + 1));
          var sub = isPcap
            ? 'cps ' + it.cps
            : (it.stream === false ? 'UDP' : 'TCP') + ' port ' + it.assocPort + ' · cps ' + it.cps;
          var row = el('div', {
            class: 'stream-item' + (idx === selectedIdx ? ' active' : ''),
            onclick: function () { selectedIdx = idx; renderList(); renderEditor(); }
          });
          row.appendChild(el('div', { class: 'stream-name' }, [
            el('div', { text: title }),
            el('small', { text: sub })
          ]));
          var btns = el('div', { class: 'stream-btns' });
          function sbtn(label, title2, fn) {
            btns.appendChild(el('button', { class: 'btn btn-small', text: label, title: title2,
              onclick: function (e) { e.stopPropagation(); fn(); } }));
          }
          sbtn('⧉', 'duplicate', function () {
            var copy = TB.util.deepClone(it);
            if (!isPcap) { copy.id = TB.util.uid('t'); }
            items().splice(idx + 1, 0, copy);
            selectedIdx = idx + 1;
            renderList(); renderEditor(); regen();
          });
          sbtn('✕', 'delete', function () {
            if (!confirm('Delete this entry?')) { return; }
            items().splice(idx, 1);
            if (selectedIdx >= items().length) { selectedIdx = Math.max(0, items().length - 1); }
            renderList(); renderEditor(); regen();
          });
          row.appendChild(btns);
          listPane.appendChild(row);
        });
        listPane.appendChild(el('button', { class: 'btn', text: isPcap ? '+ Add pcap entry' : '+ Add template',
          onclick: function () {
            items().push(isPcap ? defaultCap() : defaultTemplate(items().length + 1));
            selectedIdx = items().length - 1;
            renderList(); renderEditor(); regen();
          } }));
      }

      /* ---------- ip gen editors ---------- */
      function rangeFields(side, label) {
        var box = el('div', { class: 'field-row' });
        box.appendChild(el('span', { class: 'field-label range-label', text: label }));
        box.appendChild(field({ label: 'start', type: 'text', value: side.start, width: '110px',
          validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
          onChange: function (v) { side.start = v || ''; regen(); } }));
        box.appendChild(field({ label: 'end', type: 'text', value: side.end, width: '110px',
          validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
          onChange: function (v) { side.end = v || ''; regen(); } }));
        box.appendChild(field({ label: 'distribution', tip: TB.help.astf.distribution, type: 'select', value: side.distribution,
          options: [{ value: 'seq' }, { value: 'random' }],
          onChange: function (v) { side.distribution = v; regen(); } }));
        box.appendChild(field({ label: 'per-core', tip: TB.help.astf.perCore, type: 'select', value: side.perCore || '',
          options: [{ value: '', label: '(default)' }, { value: 'seq', label: 'seq' }],
          onChange: function (v) { side.perCore = v || null; regen(); } }));
        return box;
      }

      function ipGenSection() {
        var box = el('div', {});
        box.appendChild(rangeFields(model.ipGen.client, 'Clients'));
        box.appendChild(rangeFields(model.ipGen.server, 'Servers'));
        box.appendChild(field({ label: 'ip_offset (added per dual-port pair)', tip: TB.help.astf.ipOffset, type: 'text',
          value: model.ipGen.ipOffset, width: '100px',
          onChange: function (v) { model.ipGen.ipOffset = v || '1.0.0.0'; regen(); } }));
        return box;
      }

      function globSide(g, label) {
        var box = el('div', { class: 'glob-col' });
        box.appendChild(el('div', { class: 'pane-title', text: label }));
        var row = el('div', { class: 'field-row' });
        ['mss', 'rxbufsize', 'txbufsize', 'initwnd', 'no_delay', 'do_rfc1323', 'keepinit', 'keepidle', 'keepintvl']
          .forEach(function (f) {
            row.appendChild(field({ label: 'tcp.' + f, tip: TB.help.astf.tcpTuning, type: 'int', value: g.tcp[f], width: '80px',
              onChange: function (v) { g.tcp[f] = v; regen(); } }));
          });
        box.appendChild(row);
        var row2 = el('div', { class: 'field-row' });
        row2.appendChild(field({ label: 'rampup_sec', tip: TB.help.astf.rampupSec, type: 'int', value: g.scheduler.rampupSec, width: '80px',
          hint: 'linear CPS ramp to max over N sec' + (label === 'Server side' ? ' (client side drives the ramp)' : ''),
          onChange: function (v) { g.scheduler.rampupSec = v; regen(); } }));
        row2.appendChild(field({ label: 'IPv6', tip: TB.help.astf.ipv6, type: 'checkbox', value: g.ipv6.enable,
          onChange: function (v) { g.ipv6.enable = v; renderEditor(); regen(); } }));
        if (g.ipv6.enable) {
          row2.appendChild(field({ label: 'src MSB', type: 'text', value: g.ipv6.srcMsb, width: '90px',
            placeholder: 'ff02::',
            onChange: function (v) { g.ipv6.srcMsb = v || ''; regen(); } }));
          row2.appendChild(field({ label: 'dst MSB', type: 'text', value: g.ipv6.dstMsb, width: '90px',
            placeholder: 'ff03::',
            onChange: function (v) { g.ipv6.dstMsb = v || ''; regen(); } }));
        }
        box.appendChild(row2);
        return box;
      }

      function globalsSection() {
        return el('div', {}, [
          globSide(model.globals.client, 'Client side'),
          globSide(model.globals.server, 'Server side')
        ]);
      }

      function overrideEditor(holder) {
        var box = el('div', {});
        box.appendChild(field({ label: 'Override IP generator for this entry', tip: TB.help.astf.ipGenOverride, type: 'checkbox',
          value: !!holder.ipGenOverride,
          onChange: function (v) {
            holder.ipGenOverride = v ? {
              client: { start: '10.0.0.1', end: '10.0.0.255', distribution: 'seq', perCore: null },
              server: { start: '20.0.0.1', end: '20.0.0.255', distribution: 'seq', perCore: null },
              ipOffset: '1.0.0.0'
            } : null;
            renderEditor(); regen();
          } }));
        if (holder.ipGenOverride) {
          box.appendChild(rangeFields(holder.ipGenOverride.client, 'Clients'));
          box.appendChild(rangeFields(holder.ipGenOverride.server, 'Servers'));
        }
        return box;
      }

      /* ---------- cap entry editor ---------- */
      function capEditor(c) {
        var box = el('div', {});
        var row = el('div', { class: 'field-row' });
        row.appendChild(field({ label: 'Pcap file (path on the TRex box)', tip: TB.help.astf.pcapFile, type: 'text', value: c.file,
          width: '280px', datalist: 'avl-pcaps',
          hint: 'pcap dir setting: ' + TB.settings.get().defaults.pcapDir,
          onChange: function (v) { c.file = v || ''; renderList(); regen(); } }));
        var browse = TB.ui.pcapBrowseButton('avl', function (dir, file) {
          c.file = '../' + dir + '/' + file;
          renderList(); renderEditor(); regen();
        });
        if (browse) { row.appendChild(browse); }
        row.appendChild(field({ label: 'cps (at -m 1)', tip: TB.help.astf.cps, type: 'float', value: c.cps, width: '80px',
          onChange: function (v) { c.cps = v === null ? 1 : v; renderList(); regen(); } }));
        row.appendChild(field({ label: 'Port pin (opt.)', tip: TB.help.astf.portPin, type: 'int', value: c.port, width: '70px',
          onChange: function (v) { c.port = v; regen(); } }));
        row.appendChild(field({ label: 's_delay µs (opt.)', tip: TB.help.astf.sDelay, type: 'int', value: c.sDelayUsec, width: '90px',
          onChange: function (v) { c.sDelayUsec = v; regen(); } }));
        box.appendChild(row);
        box.appendChild(overrideEditor(c));
        return box;
      }

      /* ---------- program template editor ---------- */
      function payloadFields(cmd) {
        var wrap = el('span', { class: 'field-row-inline' });
        var p = cmd.payload;
        wrap.appendChild(field({ label: 'payload', tip: TB.help.astf.cmdSend, type: 'select', value: p.kind,
          options: [{ value: 'text', label: 'text' }, { value: 'httpRequest', label: 'HTTP request preset' },
                    { value: 'httpResponse', label: 'HTTP response preset' }],
          onChange: function (v) {
            p.kind = v;
            if (v === 'httpResponse' && !p.bodyBytes) { p.bodyBytes = 32768; }
            if (v === 'text' && p.text === undefined) { p.text = 'hello'; }
            renderEditor(); regen();
          } }));
        if (p.kind === 'text') {
          wrap.appendChild(field({ label: 'text (\\r\\n allowed)', type: 'text', value: p.text, width: '220px',
            onChange: function (v) { p.text = v || ''; regen(); } }));
        } else if (p.kind === 'httpResponse') {
          wrap.appendChild(field({ label: 'body bytes', tip: TB.help.astf.httpBodyBytes, type: 'int', value: p.bodyBytes, width: '80px',
            onChange: function (v) { p.bodyBytes = v === null ? 0 : v; regen(); } }));
        }
        return wrap;
      }

      function commandRow(prog, cmd, idx, isUdp) {
        var row = el('div', { class: 'vm-var-row' });
        row.appendChild(el('span', { class: 'cmd-op', text: cmd.op }));
        switch (cmd.op) {
          case 'send': case 'send_msg':
            row.appendChild(payloadFields(cmd));
            break;
          case 'recv': {
            var auto = cmd.bytes === null || cmd.bytes === undefined;
            row.appendChild(field({ label: 'auto (match peer send)', tip: TB.help.astf.cmdRecv, type: 'checkbox', value: auto,
              onChange: function (v) { cmd.bytes = v ? null : 0; renderEditor(); regen(); } }));
            if (!auto) {
              row.appendChild(field({ label: 'bytes', tip: TB.help.astf.cmdRecv, type: 'int', value: cmd.bytes, width: '90px',
                onChange: function (v) { cmd.bytes = v === null ? 0 : v; regen(); } }));
            }
            break;
          }
          case 'recv_msg':
            row.appendChild(field({ label: 'messages', type: 'int', value: cmd.count, width: '70px',
              onChange: function (v) { cmd.count = v === null ? 1 : v; regen(); } }));
            break;
          case 'delay':
            row.appendChild(field({ label: 'µs', type: 'int', value: cmd.usec, width: '90px',
              onChange: function (v) { cmd.usec = v === null ? 0 : v; regen(); } }));
            break;
          case 'delay_rand':
            row.appendChild(field({ label: 'min µs', type: 'int', value: cmd.minUsec, width: '90px',
              onChange: function (v) { cmd.minUsec = v === null ? 0 : v; regen(); } }));
            row.appendChild(field({ label: 'max µs', type: 'int', value: cmd.maxUsec, width: '90px',
              onChange: function (v) { cmd.maxUsec = v === null ? 0 : v; regen(); } }));
            break;
          case 'set_var':
            row.appendChild(field({ label: 'var id', type: 'text', value: cmd.id, width: '70px',
              onChange: function (v) { cmd.id = v || 'var1'; regen(); } }));
            row.appendChild(field({ label: 'value', type: 'int', value: cmd.value, width: '60px',
              onChange: function (v) { cmd.value = v === null ? 0 : v; regen(); } }));
            break;
          case 'set_label':
            row.appendChild(field({ label: 'label', type: 'text', value: cmd.name, width: '70px',
              onChange: function (v) { cmd.name = v || 'a:'; regen(); } }));
            break;
          case 'jmp_nz':
            row.appendChild(field({ label: 'var id', type: 'text', value: cmd.id, width: '70px',
              onChange: function (v) { cmd.id = v || 'var1'; regen(); } }));
            row.appendChild(field({ label: 'to label', type: 'text', value: cmd.label, width: '70px',
              onChange: function (v) { cmd.label = v || 'a:'; regen(); } }));
            break;
        }
        var btns = el('div', { class: 'stream-btns', style: 'visibility: visible; margin-left: auto;' });
        function cbtn(label, fn) {
          btns.appendChild(el('button', { class: 'btn btn-small', text: label,
            onclick: function () { fn(); } }));
        }
        cbtn('↑', function () {
          if (idx > 0) { prog.commands.splice(idx - 1, 0, prog.commands.splice(idx, 1)[0]); renderEditor(); regen(); }
        });
        cbtn('↓', function () {
          if (idx < prog.commands.length - 1) { prog.commands.splice(idx + 1, 0, prog.commands.splice(idx, 1)[0]); renderEditor(); regen(); }
        });
        cbtn('✕', function () { prog.commands.splice(idx, 1); renderEditor(); regen(); });
        row.appendChild(btns);
        return row;
      }

      function programEditor(t, side, label) {
        var prog = t[side];
        var isUdp = t.stream === false;
        var box = el('div', {});
        prog.commands.forEach(function (cmd, idx) {
          box.appendChild(commandRow(prog, cmd, idx, isUdp));
        });
        var addRow = el('div', { class: 'field-row' });
        var opSel = el('select', {});
        OPS.forEach(function (o) {
          if (isUdp && (o.op === 'send' || o.op === 'recv')) { return; }
          if (!isUdp && (o.op === 'send_msg' || o.op === 'recv_msg')) { return; }
          opSel.appendChild(el('option', { value: o.op, text: o.label }));
        });
        addRow.appendChild(opSel);
        addRow.appendChild(el('button', { class: 'btn btn-small', text: '+ Add command',
          onclick: function () {
            prog.commands.push(defaultCommand(opSel.value, isUdp));
            renderEditor(); regen();
          } }));
        box.appendChild(addRow);
        return TB.ui.section(label + ' program (' + prog.commands.length + ' commands)', box, true);
      }

      function templateEditor(t) {
        var box = el('div', {});
        var row = el('div', { class: 'field-row' });
        row.appendChild(field({ label: 'Template group name (opt.)', tip: TB.help.astf.tgName, type: 'text', value: t.tgName, width: '120px',
          onChange: function (v) { t.tgName = v; renderList(); regen(); } }));
        row.appendChild(field({ label: 'cps (weight at -m 1)', tip: TB.help.astf.cps, type: 'float', value: t.cps, width: '90px',
          onChange: function (v) { t.cps = v === null ? 1 : v; renderList(); regen(); } }));
        row.appendChild(field({ label: 'Association port', tip: TB.help.astf.assocPort, type: 'int', value: t.assocPort, width: '80px',
          onChange: function (v) { t.assocPort = v; renderList(); regen(); } }));
        row.appendChild(field({ label: 'Transport', tip: TB.help.astf.transport, type: 'select', value: t.stream === false ? 'udp' : 'tcp',
          options: [{ value: 'tcp', label: 'TCP (stream)' }, { value: 'udp', label: 'UDP (messages)' }],
          onChange: function (v) { t.stream = v !== 'udp'; renderList(); renderEditor(); regen(); } }));
        box.appendChild(row);
        box.appendChild(programEditor(t, 'client', 'Client'));
        box.appendChild(programEditor(t, 'server', 'Server'));
        box.appendChild(overrideEditor(t));
        return box;
      }

      /* ---------- center pane ---------- */
      function renderEditor() {
        editorPane.innerHTML = '';
        editorPane.appendChild(el('div', { class: 'pane-title', text: 'Profile' }));
        editorPane.appendChild(TB.ui.section('IP generator', ipGenSection(), true, TB.help.astf._sections.ipGen));
        editorPane.appendChild(TB.ui.section('Global info (TCP tuning / rampup / IPv6)', globalsSection(), false, TB.help.astf._sections.globals));

        var it = items()[selectedIdx];
        if (!it) {
          editorPane.appendChild(el('div', { class: 'output-empty', text: 'Nothing selected. Add an entry on the left.' }));
          return;
        }
        var title = model.mode === 'pcap'
          ? 'Pcap entry: ' + (it.file || '').split('/').pop()
          : 'Template: ' + (it.tgName || 'template ' + (selectedIdx + 1));
        editorPane.appendChild(TB.ui.section(title, model.mode === 'pcap' ? capEditor(it) : templateEditor(it), true,
          model.mode === 'pcap' ? TB.help.astf._sections.cap : TB.help.astf._sections.template));
      }

      function renderAll() {
        renderTopbar();
        renderPresets();
        renderTopo();
        renderList();
        renderEditor();
        regen();
      }
      renderAll();

      // hook for scenario wizards ("Open in builder")
      TB.ui.astfBuilder._loadExternal = loadModel;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
