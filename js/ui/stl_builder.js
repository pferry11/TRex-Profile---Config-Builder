/* TRex Profile & Config Builder - STL profile builder tab.
 * Three panes: stream list | stream editor | live output. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  function defaultStream(n) {
    return {
      id: TB.util.uid('s'),
      name: 'S' + n,
      enabled: true,
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

  function defaultModel() {
    return {
      kind: 'stl',
      schemaVersion: 1,
      trexVersion: TB.settings.get().defaults.trexVersion,
      meta: { name: 'my_stl_profile', description: '', modified: '' },
      tunables: [],
      pcapReplay: { enabled: false, file: 'cap2/dns.pcap', ipgUsec: 10, loopCount: 5, speedup: 1 },
      streams: [defaultStream(0)]
    };
  }

  var WRITE_TARGETS = ['IP.src', 'IP.dst', 'UDP.sport', 'UDP.dport', 'IP.tos'];

  var RATE_UNITS = [
    { value: 'pps', label: 'pps', short: 'pps' },
    { value: 'bps_L1', label: 'bps L1', short: 'bps L1' },
    { value: 'bps_L2', label: 'bps L2', short: 'bps L2' },
    { value: 'percentage', label: '% line rate', short: '% line' }
  ];

  function rateUnitShort(unit) {
    for (var i = 0; i < RATE_UNITS.length; i++) {
      if (RATE_UNITS[i].value === unit) { return RATE_UNITS[i].short; }
    }
    return 'pps';
  }

  /* Classic IMIX table matching the shipped stl/imix.py: 60/590/1514 B at a
   * 28:16:4 pps ratio, staggered isg, with src/dst IP sweeps. */
  var IMIX_TABLE = [
    { size: 60, pps: 28, isg: 0 },
    { size: 590, pps: 16, isg: 0.1 },
    { size: 1514, pps: 4, isg: 0.2 }
  ];

  TB.ui.stlBuilder = {
    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;

      var model = defaultModel();
      var selectedId = model.streams[0].id;
      var regenTimer = null;
      var history = TB.history.create();
      var histCtl = TB.ui.historyControls(history, function (m) {
        model = m;
        var found = false;
        for (var i = 0; i < model.streams.length; i++) { if (model.streams[i].id === selectedId) { found = true; } }
        if (!found) { selectedId = model.streams.length ? model.streams[0].id : null; }
        renderAll();
      });

      /* ---------- layout skeleton ----------
       * Two visually distinct regions so a collapsed setting bar never reads as
       * a heading for the stream panes below:
       *   1. "Profile-wide settings" group  - tunables + optional pcap replay
       *   2. "Streams" work area            - list | editor | live output
       * (Same restructure is planned for the ASTF tab in a later batch.) */
      var topbar = el('div', { class: 'builder-topbar' });
      var tunablesBox = el('div', { class: 'tunables-box' });
      var pcapBox = el('div', { class: 'tunables-box' });
      var listPane = el('div', { class: 'pane pane-list' });
      var editorPane = el('div', { class: 'pane pane-editor' });
      var outputPane = el('div', { class: 'pane pane-output' });
      container.appendChild(topbar);
      container.appendChild(el('div', { class: 'builder-group' }, [
        el('div', { class: 'builder-group-title', text: 'Profile-wide settings' }),
        tunablesBox, pcapBox
      ]));
      container.appendChild(el('div', { class: 'workarea-head' }, [
        el('span', { class: 'workarea-title', text: 'Streams' }),
        el('span', { class: 'workarea-hint',
          text: 'the packet streams this profile sends — list, editor & live output' })
      ]));
      container.appendChild(el('div', { class: 'builder-panes' }, [listPane, editorPane, outputPane]));

      function selected() {
        for (var i = 0; i < model.streams.length; i++) {
          if (model.streams[i].id === selectedId) { return model.streams[i]; }
        }
        return model.streams[0] || null;
      }

      /* ---------- regeneration ---------- */
      function regen() {
        if (regenTimer) { clearTimeout(regenTimer); }
        regenTimer = setTimeout(function () {
          history.record(model);
          var gen = TB.gen.resolve(model.trexVersion, 'stl');
          if (!gen) {
            outputPane.innerHTML = '';
            outputPane.appendChild(el('div', {
              class: 'output-empty',
              text: 'No STL generator registered for TRex v' + model.trexVersion + '.'
            }));
            return;
          }
          TB.ui.output.render(outputPane, { result: gen(model), model: model, validateKind: 'stl',
            /* Re-open lives in the output pane (same pattern as cap2). "Open
               builder file…" restores a .json builder file exactly; the sister
               "Open profile…" (.py) action arrives with the STL .py importer in
               a later batch, at which point onOpenProfile/profileAccept get set. */
            onOpenBuilderFile: function (text) {
              try { loadModel(JSON.parse(text)); }
              catch (e) { TB.ui.toast('Not a valid builder file (.json): ' + e.message, 'err'); }
            } });
        }, 120);
      }

      /* ---------- top bar ---------- */
      function renderTopbar() {
        topbar.innerHTML = '';
        topbar.appendChild(field({
          label: 'Profile name', tip: TB.help.stl.profileName, type: 'text', value: model.meta.name, width: '160px',
          onChange: function (v) { model.meta.name = v || 'stl_profile'; regen(); }
        }));
        topbar.appendChild(field({
          label: 'Description', type: 'text', value: model.meta.description, width: '220px',
          onChange: function (v) { model.meta.description = v || ''; regen(); }
        }));
        topbar.appendChild(field({
          label: 'TRex version', tip: TB.help.stl.trexVersion, type: 'select', value: model.trexVersion,
          options: TB.gen.versions().map(function (v) { return { value: v, label: 'v' + v }; }),
          onChange: function (v) { model.trexVersion = v; regen(); }
        }));

        var actions = el('div', { class: 'topbar-actions' });
        actions.appendChild(histCtl);
        actions.appendChild(el('button', {
          class: 'btn', text: 'New',
          onclick: function () {
            if (!confirm('Start a new profile? Unsaved changes are lost.')) { return; }
            model = defaultModel();
            selectedId = model.streams[0].id;
            renderAll();
          }
        }));
        actions.appendChild(el('button', {
          class: 'btn', text: 'Save',
          onclick: function () {
            model.meta.modified = new Date().toISOString();
            var r = TB.persist.saveProfile(TB.util.deepClone(model));
            TB.ui.toast(r.ok ? 'Saved "' + model.meta.name + '"' : r.error, r.ok ? 'ok' : 'err');
            renderTopbar();
          }
        }));

        var savedSel = el('select', { class: 'saved-select' });
        savedSel.appendChild(el('option', { value: '', text: 'Saved profiles…' }));
        TB.persist.listProfiles('stl').forEach(function (m) {
          savedSel.appendChild(el('option', { value: m.meta.name, text: m.meta.name }));
        });
        actions.appendChild(savedSel);
        actions.appendChild(el('button', {
          class: 'btn', text: 'Load',
          onclick: function () {
            if (!savedSel.value) { return; }
            loadModel(TB.persist.getProfile('stl', savedSel.value));
          }
        }));
        actions.appendChild(el('button', {
          class: 'btn btn-secondary', text: 'Delete',
          onclick: function () {
            if (!savedSel.value || !confirm('Delete saved profile "' + savedSel.value + '"?')) { return; }
            TB.persist.deleteProfile('stl', savedSel.value);
            renderTopbar();
          }
        }));

        /* Re-open moved to the output pane's "Open builder file…" / "Open
           profile…" actions (same split as cap2) - no topbar Import button. */
        topbar.appendChild(actions);
      }

      function loadModel(m) {
        if (!m) { TB.ui.toast('Profile not found', 'err'); return; }
        if (m.kind !== 'stl') { TB.ui.toast('Not an STL model (kind=' + m.kind + ')', 'err'); return; }
        if (m.schemaVersion > 1) {
          TB.ui.toast('Model schemaVersion ' + m.schemaVersion + ' is newer than this app supports (1).', 'err');
          return;
        }
        model = TB.util.deepClone(m);
        selectedId = model.streams.length ? model.streams[0].id : null;
        renderAll();
      }

      /* ---------- tunables editor ---------- */
      function renderTunables() {
        tunablesBox.innerHTML = '';
        var body = el('div', {});
        model.tunables.forEach(function (t, idx) {
          var row = el('div', { class: 'tunable-row' });
          row.appendChild(field({ label: 'name', tip: TB.help.stl.tunableName, type: 'text', value: t.name, width: '110px',
            onChange: function (v) { t.name = (v || '').replace(/\W+/g, '_'); regen(); } }));
          row.appendChild(field({ label: 'type', tip: TB.help.stl.tunableType, type: 'select', value: t.type,
            options: ['int', 'float', 'str', 'choice'].map(function (x) { return { value: x }; }),
            onChange: function (v) { t.type = v; renderTunables(); renderEditor(); regen(); } }));
          row.appendChild(field({ label: 'default', tip: TB.help.stl.tunableDefault, type: t.type === 'int' ? 'int' : (t.type === 'float' ? 'float' : 'text'),
            value: t.default, width: '90px',
            onChange: function (v) { t.default = v; regen(); } }));
          if (t.type === 'choice') {
            row.appendChild(field({ label: 'choices (comma sep)', type: 'text',
              value: (t.choices || []).join(','), width: '150px',
              onChange: function (v) {
                t.choices = (v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
                regen();
              } }));
          }
          row.appendChild(field({ label: 'help', tip: TB.help.stl.tunableHelp, type: 'text', value: t.help, width: '180px',
            onChange: function (v) { t.help = v || ''; regen(); } }));
          row.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
            onclick: function () {
              model.tunables.splice(idx, 1);
              // clear any field bindings that referenced this tunable
              model.streams.forEach(function (s) {
                if (s.packet.payload.frameSizeTunable === t.name) { s.packet.payload.frameSizeTunable = null; }
              });
              renderTunables(); renderEditor(); regen();
            } }));
          body.appendChild(row);
        });
        body.appendChild(el('button', { class: 'btn btn-small', text: '+ Add tunable',
          onclick: function () {
            model.tunables.push({ name: 'param' + (model.tunables.length + 1), type: 'int', default: 0, help: '' });
            renderTunables(); renderEditor(); regen();
          } }));
        tunablesBox.appendChild(TB.ui.section('Tunables (' + model.tunables.length + ') — become --args of get_streams', body, model.tunables.length > 0, TB.help.stl._sections.tunables));
      }

      /* ---------- pcap replay (STLProfile.load_pcap) ---------- */
      function renderPcap() {
        pcapBox.innerHTML = '';
        if (!model.pcapReplay) {   /* models saved before this feature */
          model.pcapReplay = { enabled: false, file: 'cap2/dns.pcap', ipgUsec: 10, loopCount: 5, speedup: 1 };
        }
        var r = model.pcapReplay;
        TB.ui.ensureCap2Datalist();
        var body = el('div', {});
        var row = el('div', { class: 'field-row' });
        row.appendChild(field({ label: 'Replay a pcap instead of the stream list', tip: TB.help.stl.pcapReplayOn,
          type: 'checkbox', value: r.enabled,
          onChange: function (v) { r.enabled = v; renderPcap(); regen(); } }));
        if (r.enabled) {
          row.appendChild(field({ label: 'Pcap file (path on the TRex box)', tip: TB.help.stl.pcapReplayFile, type: 'text',
            value: r.file, width: '250px', datalist: 'cap2-pcaps',
            onChange: function (v) { r.file = v || ''; regen(); } }));
          var browse = TB.ui.pcapBrowseButton('cap2', function (dir, file) {
            r.file = dir + '/' + file;
            renderPcap(); regen();
          });
          if (browse) { row.appendChild(browse); }
          row.appendChild(field({ label: 'IPG µs (empty = pcap timing)', tip: TB.help.stl.pcapReplayIpg, type: 'float',
            value: r.ipgUsec, width: '90px',
            onChange: function (v) { r.ipgUsec = v; renderPcap(); regen(); } }));
          if (r.ipgUsec === null || r.ipgUsec === undefined || r.ipgUsec === '') {
            row.appendChild(field({ label: 'Speedup', tip: TB.help.stl.pcapReplaySpeedup, type: 'float',
              value: r.speedup, width: '70px',
              onChange: function (v) { r.speedup = v === null ? 1 : v; regen(); } }));
          }
          row.appendChild(field({ label: 'Loop count (0 = forever)', tip: TB.help.stl.pcapReplayLoop, type: 'int',
            value: r.loopCount, width: '80px',
            onChange: function (v) { r.loopCount = v === null ? 1 : v; regen(); } }));
        }
        body.appendChild(row);
        pcapBox.appendChild(TB.ui.section('Replay a pcap instead (advanced)' + (r.enabled ? ' — ACTIVE, stream list ignored' : ''),
          body, r.enabled, TB.help.stl._sections.pcapReplay));
      }

      /* ---------- stream list ---------- */
      function renderList() {
        listPane.innerHTML = '';
        listPane.appendChild(el('div', { class: 'pane-title', text: 'Stream list' }));
        model.streams.forEach(function (s, idx) {
          var row = el('div', {
            class: 'stream-item' + (s.id === selectedId ? ' active' : '') + (s.enabled ? '' : ' disabled'),
            onclick: function () { selectedId = s.id; renderList(); renderEditor(); }
          });
          var check = el('input', { type: 'checkbox', checked: s.enabled, title: 'enabled' });
          check.addEventListener('click', function (e) { e.stopPropagation(); });
          check.addEventListener('change', function () { s.enabled = check.checked; renderList(); regen(); });
          row.appendChild(check);
          row.appendChild(el('div', { class: 'stream-name' }, [
            el('div', { text: s.name }),
            el('small', { text: s.mode.type + ' @ ' + s.mode.pps + ' ' + rateUnitShort(s.mode.rateUnit) })
          ]));
          var btns = el('div', { class: 'stream-btns' });
          function sbtn(label, title, fn) {
            btns.appendChild(el('button', { class: 'btn btn-small', text: label, title: title,
              onclick: function (e) { e.stopPropagation(); fn(); } }));
          }
          sbtn('↑', 'move up', function () {
            if (idx > 0) {
              model.streams.splice(idx - 1, 0, model.streams.splice(idx, 1)[0]);
              renderList(); regen();
            }
          });
          sbtn('↓', 'move down', function () {
            if (idx < model.streams.length - 1) {
              model.streams.splice(idx + 1, 0, model.streams.splice(idx, 1)[0]);
              renderList(); regen();
            }
          });
          sbtn('⧉', 'duplicate', function () {
            var copy = TB.util.deepClone(s);
            copy.id = TB.util.uid('s');
            copy.name = s.name + '_copy';
            model.streams.splice(idx + 1, 0, copy);
            selectedId = copy.id;
            renderList(); renderEditor(); regen();
          });
          sbtn('✕', 'delete', function () {
            if (!confirm('Delete stream "' + s.name + '"?')) { return; }
            model.streams.splice(idx, 1);
            if (selectedId === s.id) { selectedId = model.streams.length ? model.streams[0].id : null; }
            renderList(); renderEditor(); regen();
          });
          row.appendChild(btns);
          listPane.appendChild(row);
        });
        listPane.appendChild(el('button', { class: 'btn', text: '+ Add stream',
          onclick: function () {
            var s = defaultStream(model.streams.length);
            model.streams.push(s);
            selectedId = s.id;
            renderList(); renderEditor(); regen();
          } }));
        listPane.appendChild(el('button', {
          class: 'btn btn-secondary', text: 'IMIX preset',
          title: 'Replace streams with the classic 60/590/1514 B IMIX table (28/16/4 pps, IP sweeps)',
          onclick: function () {
            if (model.streams.length &&
                !confirm('Replace the current streams with the classic 3-stream IMIX table (60/590/1514 B at 28/16/4 pps)?')) {
              return;
            }
            model.streams = IMIX_TABLE.map(function (row, i) {
              var s = defaultStream(i);
              s.name = 'imix_' + row.size;
              s.packet.payload.frameSize = row.size;
              s.mode.pps = row.pps;
              s.isgUsec = row.isg;
              s.vm.vars = [
                { name: 'ip_src', sizeBytes: 4, op: 'inc', min: '16.0.0.1', max: '16.0.0.254', step: 1, writeTo: 'IP.src', fixChecksum: true },
                { name: 'ip_dst', sizeBytes: 4, op: 'inc', min: '48.0.0.1', max: '48.0.0.254', step: 1, writeTo: 'IP.dst', fixChecksum: true }
              ];
              return s;
            });
            selectedId = model.streams[0].id;
            renderList(); renderEditor(); regen();
            TB.ui.toast('Loaded classic IMIX table (60/590/1514 B)', 'ok');
          } }));
      }

      /* ---------- stream editor ---------- */
      function renderEditor() {
        editorPane.innerHTML = '';
        var s = selected();
        if (!s) {
          editorPane.appendChild(el('div', { class: 'output-empty', text: 'No stream selected. Add one on the left.' }));
          return;
        }
        editorPane.appendChild(el('div', { class: 'pane-title', text: 'Stream editor' }));
        editorPane.appendChild(field({ label: 'Stream name', tip: TB.help.stl.streamName, type: 'text', value: s.name, width: '140px',
          onChange: function (v) { s.name = v || 'S?'; renderList(); regen(); } }));

        editorPane.appendChild(TB.ui.section('Packet', packetSection(s), true, TB.help.stl._sections.packet));
        editorPane.appendChild(TB.ui.section('TX mode', modeSection(s), true, TB.help.stl._sections.mode));
        editorPane.appendChild(TB.ui.section('Timing & chaining', chainSection(s), false, TB.help.stl._sections.chain));
        editorPane.appendChild(TB.ui.section('Field engine (VM)', vmSection(s), (s.vm.vars.length > 0 || !!s.vm.tuple), TB.help.stl._sections.vm));
        editorPane.appendChild(TB.ui.section('Flow stats', flowStatsSection(s), s.flowStats.type !== 'none', TB.help.stl._sections.flowStats));
      }

      function sizeReadout(s) {
        var info = TB.gen.stlPacketInfo(s);
        var txt = 'headers: ' + info.headerBytes + ' B';
        if (info.frameBytes !== null) { txt += '  ·  frame: ' + info.frameBytes + ' B'; }
        var warn = info.frameBytes !== null && info.frameBytes < 60;
        return el('div', { class: 'size-readout' + (warn ? ' warn' : ''), text: txt + (warn ? '  (below 60 B!)' : '') });
      }
      /* Quick-fill presets for the selected stream, modeled on shipped examples
       * (stl/udp_1pkt_dns.py, arp/icmp one-packet profiles). ARP and DNS need
       * layers the form does not model, so they fill the raw-scapy escape hatch. */
      var PACKET_PRESETS = [
        { label: 'ICMP echo', apply: function (s) {
            s.packet.l4 = { type: 'icmp', sport: 1025, dport: 12, tcpFlags: null,
              icmpKind: 'echo-request', icmpId: null, icmpSeq: null };
            s.packet.payload.rawScapy = null;
          } },
        { label: 'ARP request', apply: function (s) {
            s.packet.payload.rawScapy =
              'Ether(dst="ff:ff:ff:ff:ff:ff")/ARP(op=1,psrc="16.0.0.1",pdst="48.0.0.1")';
          } },
        { label: 'DNS query', apply: function (s) {
            s.packet.payload.rawScapy =
              'Ether()/IP(src="16.0.0.1",dst="48.0.0.1")/UDP(sport=1025,dport=53)/' +
              'DNS(rd=1,qd=DNSQR(qname="www.example.com"))';
          } }
      ];

      function packetSection(s) {
        var p = s.packet;
        var box = el('div', {});

        var presetRow = el('div', { class: 'field-row' });
        presetRow.appendChild(el('span', { class: 'field-label', text: 'Presets:' }));
        PACKET_PRESETS.forEach(function (pre) {
          presetRow.appendChild(el('button', { class: 'btn btn-small', text: pre.label,
            title: TB.help.stl.packetPresets,
            onclick: function () { pre.apply(s); renderEditor(); regen(); } }));
        });
        box.appendChild(presetRow);

        var row1 = el('div', { class: 'field-row' });
        row1.appendChild(field({ label: 'Src MAC (optional)', tip: TB.help.stl.srcMac, type: 'text', value: p.l2.srcMac, placeholder: 'aa:bb:cc:dd:ee:ff',
          validate: function (v) { return TB.util.isMac(v) ? null : 'invalid MAC'; },
          onChange: function (v) { p.l2.srcMac = v; regen(); } }));
        row1.appendChild(field({ label: 'Dst MAC (optional)', tip: TB.help.stl.dstMac, type: 'text', value: p.l2.dstMac, placeholder: 'aa:bb:cc:dd:ee:ff',
          validate: function (v) { return TB.util.isMac(v) ? null : 'invalid MAC'; },
          onChange: function (v) { p.l2.dstMac = v; regen(); } }));
        box.appendChild(row1);

        var vlanRow = el('div', { class: 'field-row' });
        vlanRow.appendChild(field({ label: 'VLAN (802.1Q)', tip: TB.help.stl.vlan, type: 'checkbox', value: p.vlan.enabled,
          onChange: function (v) { p.vlan.enabled = v; renderEditor(); regen(); } }));
        if (p.vlan.enabled) {
          vlanRow.appendChild(field({ label: 'VLAN id', tip: TB.help.stl.vlanId, type: 'int', value: p.vlan.id, width: '70px',
            onChange: function (v) { p.vlan.id = v === null ? 100 : v; regen(); } }));
          vlanRow.appendChild(field({ label: 'Priority', tip: TB.help.stl.vlanPrio, type: 'int', value: p.vlan.prio, width: '60px',
            onChange: function (v) { p.vlan.prio = v === null ? 0 : v; regen(); } }));
        }
        box.appendChild(vlanRow);

        /* models saved before tunnels existed have no p.tunnel */
        if (!p.tunnel) {
          p.tunnel = { type: 'none', outerSrc: '10.0.0.1', outerDst: '10.0.0.2', vni: 5000,
                       label: 100, mplsTtl: null, outerVlanId: 100, spi: 42, si: 1 };
        }
        var tun = p.tunnel;
        var tunRow = el('div', { class: 'field-row' });
        tunRow.appendChild(field({ label: 'Tunnel / encapsulation', tip: TB.help.stl.tunnel, type: 'select', value: tun.type,
          options: [{ value: 'none', label: '(none)' }, { value: 'vxlan', label: 'VXLAN' }, { value: 'gre', label: 'GRE' },
                    { value: 'mpls', label: 'MPLS' }, { value: 'qinq', label: 'QinQ (802.1ad)' }, { value: 'nsh', label: 'NSH' }],
          onChange: function (v) { tun.type = v; renderEditor(); regen(); } }));
        if (tun.type === 'vxlan' || tun.type === 'gre') {
          tunRow.appendChild(field({ label: 'Outer src IP', tip: TB.help.stl.tunnelOuterSrc, type: 'text', value: tun.outerSrc, width: '100px',
            validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
            onChange: function (v) { tun.outerSrc = v || ''; regen(); } }));
          tunRow.appendChild(field({ label: 'Outer dst IP', tip: TB.help.stl.tunnelOuterDst, type: 'text', value: tun.outerDst, width: '100px',
            validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
            onChange: function (v) { tun.outerDst = v || ''; regen(); } }));
        }
        if (tun.type === 'vxlan') {
          tunRow.appendChild(field({ label: 'VNI', tip: TB.help.stl.vni, type: 'int', value: tun.vni, width: '80px',
            onChange: function (v) { tun.vni = v === null ? 0 : v; regen(); } }));
        }
        if (tun.type === 'mpls') {
          tunRow.appendChild(field({ label: 'Label', tip: TB.help.stl.mplsLabel, type: 'int', value: tun.label, width: '80px',
            onChange: function (v) { tun.label = v === null ? 0 : v; regen(); } }));
          tunRow.appendChild(field({ label: 'MPLS TTL (opt.)', tip: TB.help.stl.mplsTtl, type: 'int', value: tun.mplsTtl, width: '80px',
            onChange: function (v) { tun.mplsTtl = v; regen(); } }));
        }
        if (tun.type === 'qinq') {
          tunRow.appendChild(field({ label: 'Outer VLAN id', tip: TB.help.stl.qinqOuter, type: 'int', value: tun.outerVlanId, width: '80px',
            onChange: function (v) { tun.outerVlanId = v === null ? 100 : v; regen(); } }));
        }
        if (tun.type === 'nsh') {
          tunRow.appendChild(field({ label: 'SPI', tip: TB.help.stl.nshSpi, type: 'int', value: tun.spi, width: '70px',
            onChange: function (v) { tun.spi = v === null ? 0 : v; regen(); } }));
          tunRow.appendChild(field({ label: 'SI', tip: TB.help.stl.nshSi, type: 'int', value: tun.si, width: '60px',
            onChange: function (v) { tun.si = v === null ? 1 : v; regen(); } }));
        }
        box.appendChild(tunRow);

        var l3Row = el('div', { class: 'field-row' });
        l3Row.appendChild(field({ label: 'L3', tip: TB.help.stl.l3, type: 'select', value: p.l3.type,
          options: [{ value: 'ipv4', label: 'IPv4' }, { value: 'ipv6', label: 'IPv6' }],
          onChange: function (v) { p.l3.type = v; renderEditor(); regen(); } }));
        var ipValidate = p.l3.type === 'ipv4'
          ? function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; }
          : function (v) { return TB.util.isIpv6(v) ? null : 'invalid IPv6'; };
        l3Row.appendChild(field({ label: 'Src IP', tip: TB.help.stl.srcIp, type: 'text', value: p.l3.src, validate: ipValidate,
          onChange: function (v) { p.l3.src = v || ''; regen(); } }));
        l3Row.appendChild(field({ label: 'Dst IP', tip: TB.help.stl.dstIp, type: 'text', value: p.l3.dst, validate: ipValidate,
          onChange: function (v) { p.l3.dst = v || ''; regen(); } }));
        if (p.l3.type === 'ipv4') {
          l3Row.appendChild(field({ label: 'TOS (opt.)', tip: TB.help.stl.tos, type: 'int', value: p.l3.tos, width: '60px',
            onChange: function (v) { p.l3.tos = v; regen(); } }));
          l3Row.appendChild(field({ label: 'TTL (opt.)', tip: TB.help.stl.ttl, type: 'int', value: p.l3.ttl, width: '60px',
            onChange: function (v) { p.l3.ttl = v; regen(); } }));
          l3Row.appendChild(field({ label: 'Frag offset (opt.)', tip: TB.help.stl.fragOffset, type: 'int', value: p.l3.fragOffset, width: '80px',
            onChange: function (v) { p.l3.fragOffset = v; regen(); } }));
          l3Row.appendChild(field({ label: 'MF flag', tip: TB.help.stl.moreFrags, type: 'checkbox', value: !!p.l3.moreFrags,
            onChange: function (v) { p.l3.moreFrags = v; regen(); } }));
        }
        if (p.l3.type === 'ipv6') {
          l3Row.appendChild(field({ label: 'Ext header', tip: TB.help.stl.ipv6Ext, type: 'select', value: p.l3.ext || 'none',
            options: [{ value: 'none', label: '(none)' }, { value: 'hbh', label: 'hop-by-hop' }, { value: 'frag', label: 'fragment' }],
            onChange: function (v) { p.l3.ext = v; regen(); } }));
        }
        box.appendChild(l3Row);

        var l4Row = el('div', { class: 'field-row' });
        l4Row.appendChild(field({ label: 'L4', tip: TB.help.stl.l4, type: 'select', value: p.l4.type,
          options: [{ value: 'udp', label: 'UDP' }, { value: 'tcp', label: 'TCP' }, { value: 'icmp', label: 'ICMP' }, { value: 'none', label: 'none' }],
          onChange: function (v) { p.l4.type = v; renderEditor(); regen(); } }));
        if (p.l4.type === 'udp' || p.l4.type === 'tcp') {
          l4Row.appendChild(field({ label: 'Src port', tip: TB.help.stl.sport, type: 'int', value: p.l4.sport, width: '80px',
            onChange: function (v) { p.l4.sport = v === null ? 0 : v; regen(); } }));
          l4Row.appendChild(field({ label: 'Dst port', tip: TB.help.stl.dport, type: 'int', value: p.l4.dport, width: '80px',
            onChange: function (v) { p.l4.dport = v === null ? 0 : v; regen(); } }));
        }
        if (p.l4.type === 'tcp') {
          l4Row.appendChild(field({ label: 'TCP flags (e.g. S)', tip: TB.help.stl.tcpFlags, type: 'text', value: p.l4.tcpFlags, width: '80px',
            onChange: function (v) { p.l4.tcpFlags = v; regen(); } }));
        }
        if (p.l4.type === 'icmp') {
          l4Row.appendChild(field({ label: 'Kind', tip: TB.help.stl.icmpKind, type: 'select', value: p.l4.icmpKind || 'echo-request',
            options: [{ value: 'echo-request', label: 'echo request' }, { value: 'echo-reply', label: 'echo reply' }],
            onChange: function (v) { p.l4.icmpKind = v; regen(); } }));
          l4Row.appendChild(field({ label: 'Id (opt.)', tip: TB.help.stl.icmpId, type: 'int', value: p.l4.icmpId, width: '70px',
            onChange: function (v) { p.l4.icmpId = v; regen(); } }));
          l4Row.appendChild(field({ label: 'Seq (opt.)', tip: TB.help.stl.icmpSeq, type: 'int', value: p.l4.icmpSeq, width: '70px',
            onChange: function (v) { p.l4.icmpSeq = v; regen(); } }));
        }
        box.appendChild(l4Row);

        var payRow = el('div', { class: 'field-row' });
        var intTunables = model.tunables.filter(function (t) { return t.type === 'int'; });
        payRow.appendChild(field({ label: 'Frame size (bytes)', tip: TB.help.stl.frameSize, type: 'int', value: p.payload.frameSize, width: '90px',
          disabled: !!p.payload.frameSizeTunable,
          onChange: function (v) { p.payload.frameSize = v === null ? 64 : v; renderEditor(); regen(); } }));
        payRow.appendChild(field({ label: '⚙ bind to tunable', tip: TB.help.stl.bindTunable, type: 'select',
          value: p.payload.frameSizeTunable || '',
          options: [{ value: '', label: '(literal)' }].concat(intTunables.map(function (t) { return { value: t.name, label: '--' + t.name }; })),
          onChange: function (v) { p.payload.frameSizeTunable = v || null; renderEditor(); regen(); } }));
        payRow.appendChild(field({ label: 'Fill char', tip: TB.help.stl.fill, type: 'text', value: p.payload.fill, width: '50px',
          onChange: function (v) { p.payload.fill = (v || 'x')[0]; regen(); } }));
        box.appendChild(payRow);
        box.appendChild(sizeReadout(s));

        box.appendChild(field({ label: 'Advanced: raw scapy expression (replaces all of the above, emitted unvalidated)',
          type: 'textarea', value: p.payload.rawScapy, rows: 2,
          placeholder: 'Ether()/IP()/UDP()/(10*\'x\')',
          onChange: function (v) { p.payload.rawScapy = v; regen(); } }));
        return box;
      }

      function modeSection(s) {
        var m = s.mode;
        var box = el('div', {});
        var row = el('div', { class: 'field-row' });
        row.appendChild(field({ label: 'Mode', tip: TB.help.stl.mode, type: 'select', value: m.type,
          options: [{ value: 'cont', label: 'continuous' }, { value: 'single_burst', label: 'single burst' }, { value: 'multi_burst', label: 'multi burst' }],
          onChange: function (v) { m.type = v; renderEditor(); renderList(); regen(); } }));
        row.appendChild(field({ label: 'Rate', tip: TB.help.stl.pps, type: 'float', value: m.pps, width: '90px',
          onChange: function (v) { m.pps = v === null ? 1 : v; renderList(); regen(); } }));
        row.appendChild(field({ label: 'Unit', tip: TB.help.stl.rateUnit, type: 'select', value: m.rateUnit || 'pps',
          options: RATE_UNITS.map(function (u) { return { value: u.value, label: u.label }; }),
          onChange: function (v) { m.rateUnit = v; renderList(); regen(); } }));
        if (m.type === 'single_burst') {
          row.appendChild(field({ label: 'Total packets', tip: TB.help.stl.totalPkts, type: 'int', value: m.totalPkts, width: '90px',
            onChange: function (v) { m.totalPkts = v === null ? 1000 : v; regen(); } }));
        }
        if (m.type === 'multi_burst') {
          row.appendChild(field({ label: 'Pkts/burst', tip: TB.help.stl.pktsPerBurst, type: 'int', value: m.pktsPerBurst, width: '80px',
            onChange: function (v) { m.pktsPerBurst = v === null ? 1 : v; regen(); } }));
          row.appendChild(field({ label: 'IBG (µs)', tip: TB.help.stl.ibg, type: 'float', value: m.ibgUsec, width: '100px',
            onChange: function (v) { m.ibgUsec = v === null ? 0 : v; regen(); } }));
          row.appendChild(field({ label: 'Burst count', tip: TB.help.stl.count, type: 'int', value: m.count, width: '80px',
            onChange: function (v) { m.count = v === null ? 1 : v; regen(); } }));
        }
        box.appendChild(row);
        return box;
      }

      function chainSection(s) {
        var box = el('div', {});
        var row = el('div', { class: 'field-row' });
        row.appendChild(field({ label: 'ISG - start delay (µs)', tip: TB.help.stl.isg, type: 'float', value: s.isgUsec, width: '100px',
          onChange: function (v) { s.isgUsec = v === null ? 0 : v; regen(); } }));
        row.appendChild(field({ label: 'Self start', tip: TB.help.stl.selfStart, type: 'checkbox', value: s.chain.selfStart,
          onChange: function (v) { s.chain.selfStart = v; regen(); } }));
        var others = model.streams.filter(function (o) { return o.id !== s.id; });
        row.appendChild(field({ label: 'Next stream', tip: TB.help.stl.next, type: 'select', value: s.chain.next || '',
          options: [{ value: '', label: '(none)' }].concat(others.map(function (o) { return { value: o.name, label: o.name }; })),
          onChange: function (v) { s.chain.next = v || null; regen(); } }));
        row.appendChild(field({ label: 'Action count', tip: TB.help.stl.actionCount, type: 'int', value: s.chain.actionCount, width: '80px',
          hint: 'loops with next; 0 = infinite',
          onChange: function (v) { s.chain.actionCount = v; regen(); } }));
        box.appendChild(row);
        return box;
      }

      function writeTargetField(label, value, onChange) {
        var isCustom = value !== null && value !== undefined && WRITE_TARGETS.indexOf(value) === -1;
        var wrap = el('div', { class: 'field-row field-row-inline' });
        var custom;
        var sel = field({ label: label, type: 'select', value: isCustom ? '__custom__' : value,
          options: WRITE_TARGETS.map(function (t) { return { value: t }; }).concat([{ value: '__custom__', label: 'custom offset…' }]),
          onChange: function (v) {
            if (v === '__custom__') { custom.style.display = ''; onChange(custom.input.value || '0'); }
            else { custom.style.display = 'none'; onChange(v); }
          } });
        custom = field({ label: 'offset', type: 'text', value: isCustom ? value : '', width: '70px',
          onChange: function (v) { onChange(v || '0'); } });
        if (!isCustom) { custom.style.display = 'none'; }
        wrap.appendChild(sel);
        wrap.appendChild(custom);
        return wrap;
      }

      function vmSection(s) {
        var vm = s.vm;
        var box = el('div', {});
        vm.vars.forEach(function (v, idx) {
          var row = el('div', { class: 'vm-var-row' });
          row.appendChild(field({ label: 'name', tip: TB.help.stl.vmVarName, type: 'text', value: v.name, width: '90px',
            onChange: function (x) { v.name = (x || 'var').replace(/\W+/g, '_'); regen(); } }));
          row.appendChild(field({ label: 'size', tip: TB.help.stl.vmSize, type: 'select', value: String(v.sizeBytes),
            options: ['1', '2', '4', '8'].map(function (x) { return { value: x }; }),
            onChange: function (x) { v.sizeBytes = parseInt(x, 10); regen(); } }));
          row.appendChild(field({ label: 'op', tip: TB.help.stl.vmOp, type: 'select', value: v.op,
            options: ['inc', 'dec', 'random'].map(function (x) { return { value: x }; }),
            onChange: function (x) { v.op = x; regen(); } }));
          row.appendChild(field({ label: 'min', tip: TB.help.stl.vmMin, type: 'text', value: v.min, width: '100px',
            onChange: function (x) { v.min = x || '0'; regen(); } }));
          row.appendChild(field({ label: 'max', tip: TB.help.stl.vmMax, type: 'text', value: v.max, width: '100px',
            onChange: function (x) { v.max = x || '0'; regen(); } }));
          row.appendChild(field({ label: 'step', tip: TB.help.stl.vmStep, type: 'int', value: v.step, width: '55px',
            onChange: function (x) { v.step = x === null ? 1 : x; regen(); } }));
          var otherVars = vm.vars.filter(function (o) { return o !== v; }).map(function (o) { return o.name; });
          row.appendChild(field({ label: 'on wrap, step', tip: TB.help.stl.vmNextVar, type: 'select', value: v.nextVar || '',
            options: [{ value: '', label: '(nothing)' }].concat(otherVars.map(function (nm) { return { value: nm, label: nm }; })),
            onChange: function (x) { v.nextVar = x || null; regen(); } }));
          row.appendChild(writeTargetField('write to', v.writeTo, function (x) { v.writeTo = x; regen(); }));
          row.appendChild(field({ label: 'offset fixup', tip: TB.help.stl.vmOffsetFixup, type: 'int', value: v.offsetFixup, width: '55px',
            onChange: function (x) { v.offsetFixup = x; regen(); } }));
          row.appendChild(field({ label: 'split cores', tip: TB.help.stl.vmSplitCores, type: 'checkbox',
            value: v.splitToCores !== false,
            onChange: function (x) { v.splitToCores = x ? true : false; regen(); } }));
          row.appendChild(field({ label: 'fix IPv4 csum', tip: TB.help.stl.vmFixCsum, type: 'checkbox', value: v.fixChecksum,
            onChange: function (x) { v.fixChecksum = x; regen(); } }));
          row.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
            onclick: function () { vm.vars.splice(idx, 1); renderEditor(); regen(); } }));
          box.appendChild(row);
        });
        box.appendChild(el('button', { class: 'btn btn-small', text: '+ Add variable',
          onclick: function () {
            vm.vars.push({ name: 'var' + (vm.vars.length + 1), sizeBytes: 4, op: 'inc',
              min: '16.0.0.1', max: '16.0.0.254', step: 1, nextVar: null, splitToCores: true,
              writeTo: 'IP.src', offsetFixup: null, fixChecksum: true });
            renderEditor(); regen();
          } }));

        var tupRow = el('div', { class: 'field-row' });
        tupRow.appendChild(field({ label: 'Tuple generator (IP + port pairs)', tip: TB.help.stl.tuple, type: 'checkbox', value: !!vm.tuple,
          onChange: function (v) {
            vm.tuple = v ? { name: 'tuple', ipMin: '16.0.0.1', ipMax: '16.0.0.254',
              portMin: 1025, portMax: 65535, limitFlows: 10000, writeIpTo: 'IP.src', writePortTo: 'UDP.sport' } : null;
            renderEditor(); regen();
          } }));
        box.appendChild(tupRow);
        if (vm.tuple) {
          var t = vm.tuple;
          var tr = el('div', { class: 'field-row' });
          tr.appendChild(field({ label: 'IP min', type: 'text', value: t.ipMin, width: '100px',
            onChange: function (v) { t.ipMin = v || ''; regen(); } }));
          tr.appendChild(field({ label: 'IP max', type: 'text', value: t.ipMax, width: '100px',
            onChange: function (v) { t.ipMax = v || ''; regen(); } }));
          tr.appendChild(field({ label: 'Port min', type: 'int', value: t.portMin, width: '70px',
            onChange: function (v) { t.portMin = v === null ? 1025 : v; regen(); } }));
          tr.appendChild(field({ label: 'Port max', type: 'int', value: t.portMax, width: '70px',
            onChange: function (v) { t.portMax = v === null ? 65535 : v; regen(); } }));
          tr.appendChild(field({ label: 'Flow limit', tip: TB.help.stl.tupleLimit, type: 'int', value: t.limitFlows, width: '90px',
            onChange: function (v) { t.limitFlows = v === null ? 0 : v; regen(); } }));
          box.appendChild(tr);
          var tw = el('div', { class: 'field-row' });
          tw.appendChild(writeTargetField('write IP to', t.writeIpTo, function (v) { t.writeIpTo = v; regen(); }));
          tw.appendChild(writeTargetField('write port to', t.writePortTo, function (v) { t.writePortTo = v; regen(); }));
          box.appendChild(tw);
        }

        box.appendChild(field({ label: 'VM cache size (optional, speeds up repeated packets)', tip: TB.help.stl.cacheSize, type: 'int',
          value: vm.cacheSize, width: '90px',
          onChange: function (v) { vm.cacheSize = v; regen(); } }));
        return box;
      }

      function flowStatsSection(s) {
        var fs = s.flowStats;
        var box = el('div', {});
        var row = el('div', { class: 'field-row' });
        row.appendChild(field({ label: 'Type', tip: TB.help.stl.fsType, type: 'select', value: fs.type,
          options: [{ value: 'none', label: 'none' }, { value: 'stats', label: 'flow stats (counters)' }, { value: 'latency', label: 'latency stats' }],
          onChange: function (v) {
            fs.type = v;
            if (v !== 'none' && (fs.pgId === null || fs.pgId === undefined)) {
              var used = model.streams
                .filter(function (o) { return o.flowStats && o.flowStats.pgId !== null; })
                .map(function (o) { return o.flowStats.pgId; });
              var pg = 1;
              while (used.indexOf(pg) !== -1) { pg++; }
              fs.pgId = pg;
            }
            renderEditor(); regen();
          } }));
        if (fs.type !== 'none') {
          row.appendChild(field({ label: 'pg_id', tip: TB.help.stl.pgId, type: 'int', value: fs.pgId, width: '70px',
            onChange: function (v) { fs.pgId = v === null ? 1 : v; regen(); } }));
          row.appendChild(field({ label: 'add port_id to pg_id', tip: TB.help.stl.addPortId, type: 'checkbox', value: fs.addPortId,
            hint: 'keeps pg_id unique per port',
            onChange: function (v) { fs.addPortId = v; regen(); } }));
        }
        box.appendChild(row);
        if (fs.type === 'latency') {
          box.appendChild(el('div', { class: 'info-note',
            text: 'Note: latency streams ignore the -m multiplier (pps is fixed in the profile), and each latency stream needs a unique pg_id.' }));
        }
        return box;
      }

      /* ---------- boot ---------- */
      function renderAll() {
        renderTopbar();
        renderTunables();
        renderPcap();
        renderList();
        renderEditor();
        regen();
      }
      renderAll();

      // hook for scenario wizards ("Open in builder")
      TB.ui.stlBuilder._loadExternal = loadModel;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
