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
        l3: { type: 'ipv4', src: '16.0.0.1', dst: '48.0.0.1', tos: null, ttl: null },
        l4: { type: 'udp', sport: 1025, dport: 12, tcpFlags: null },
        payload: { mode: 'pad', frameSize: 64, frameSizeTunable: null, fill: 'x', rawScapy: null }
      },
      mode: { type: 'cont', pps: 100, totalPkts: 1000, pktsPerBurst: 4, ibgUsec: 1000000, count: 5 },
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
      streams: [defaultStream(0)]
    };
  }

  var WRITE_TARGETS = ['IP.src', 'IP.dst', 'UDP.sport', 'UDP.dport', 'IP.tos'];

  TB.ui.stlBuilder = {
    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;

      var model = defaultModel();
      var selectedId = model.streams[0].id;
      var regenTimer = null;

      /* ---------- layout skeleton ---------- */
      var topbar = el('div', { class: 'builder-topbar' });
      var tunablesBox = el('div', { class: 'tunables-box' });
      var listPane = el('div', { class: 'pane pane-list' });
      var editorPane = el('div', { class: 'pane pane-editor' });
      var outputPane = el('div', { class: 'pane pane-output' });
      container.appendChild(topbar);
      container.appendChild(tunablesBox);
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
          var gen = TB.gen.resolve(model.trexVersion, 'stl');
          if (!gen) {
            outputPane.innerHTML = '';
            outputPane.appendChild(el('div', {
              class: 'output-empty',
              text: 'No STL generator registered for TRex v' + model.trexVersion + '.'
            }));
            return;
          }
          TB.ui.output.render(outputPane, { result: gen(model), model: model });
        }, 120);
      }

      /* ---------- top bar ---------- */
      function renderTopbar() {
        topbar.innerHTML = '';
        topbar.appendChild(field({
          label: 'Profile name', type: 'text', value: model.meta.name, width: '160px',
          onChange: function (v) { model.meta.name = v || 'stl_profile'; regen(); }
        }));
        topbar.appendChild(field({
          label: 'Description', type: 'text', value: model.meta.description, width: '220px',
          onChange: function (v) { model.meta.description = v || ''; regen(); }
        }));
        topbar.appendChild(field({
          label: 'TRex version', type: 'select', value: model.trexVersion,
          options: TB.gen.versions().map(function (v) { return { value: v, label: 'v' + v }; }),
          onChange: function (v) { model.trexVersion = v; regen(); }
        }));

        var actions = el('div', { class: 'topbar-actions' });
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
        actions.appendChild(el('button', {
          class: 'btn btn-secondary', text: 'Import model',
          onclick: function () { fileInput.click(); }
        }));
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
          row.appendChild(field({ label: 'name', type: 'text', value: t.name, width: '110px',
            onChange: function (v) { t.name = (v || '').replace(/\W+/g, '_'); regen(); } }));
          row.appendChild(field({ label: 'type', type: 'select', value: t.type,
            options: ['int', 'float', 'str', 'choice'].map(function (x) { return { value: x }; }),
            onChange: function (v) { t.type = v; renderTunables(); renderEditor(); regen(); } }));
          row.appendChild(field({ label: 'default', type: t.type === 'int' ? 'int' : (t.type === 'float' ? 'float' : 'text'),
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
          row.appendChild(field({ label: 'help', type: 'text', value: t.help, width: '180px',
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
        tunablesBox.appendChild(TB.ui.section('Tunables (' + model.tunables.length + ') — become --args of get_streams', body, model.tunables.length > 0));
      }

      /* ---------- stream list ---------- */
      function renderList() {
        listPane.innerHTML = '';
        listPane.appendChild(el('div', { class: 'pane-title', text: 'Streams' }));
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
            el('small', { text: s.mode.type + ' @ ' + s.mode.pps + ' pps' })
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
        editorPane.appendChild(field({ label: 'Stream name', type: 'text', value: s.name, width: '140px',
          onChange: function (v) { s.name = v || 'S?'; renderList(); regen(); } }));

        editorPane.appendChild(TB.ui.section('Packet', packetSection(s), true));
        editorPane.appendChild(TB.ui.section('TX mode', modeSection(s), true));
        editorPane.appendChild(TB.ui.section('Timing & chaining', chainSection(s), false));
        editorPane.appendChild(TB.ui.section('Field engine (VM)', vmSection(s), (s.vm.vars.length > 0 || !!s.vm.tuple)));
        editorPane.appendChild(TB.ui.section('Flow stats', flowStatsSection(s), s.flowStats.type !== 'none'));
      }

      function sizeReadout(s) {
        var info = TB.gen.stlPacketInfo(s);
        var txt = 'headers: ' + info.headerBytes + ' B';
        if (info.frameBytes !== null) { txt += '  ·  frame: ' + info.frameBytes + ' B'; }
        var warn = info.frameBytes !== null && info.frameBytes < 60;
        return el('div', { class: 'size-readout' + (warn ? ' warn' : ''), text: txt + (warn ? '  (below 60 B!)' : '') });
      }
      function packetSection(s) {
        var p = s.packet;
        var box = el('div', {});
        var row1 = el('div', { class: 'field-row' });
        row1.appendChild(field({ label: 'Src MAC (optional)', type: 'text', value: p.l2.srcMac, placeholder: 'aa:bb:cc:dd:ee:ff',
          validate: function (v) { return TB.util.isMac(v) ? null : 'invalid MAC'; },
          onChange: function (v) { p.l2.srcMac = v; regen(); } }));
        row1.appendChild(field({ label: 'Dst MAC (optional)', type: 'text', value: p.l2.dstMac, placeholder: 'aa:bb:cc:dd:ee:ff',
          validate: function (v) { return TB.util.isMac(v) ? null : 'invalid MAC'; },
          onChange: function (v) { p.l2.dstMac = v; regen(); } }));
        box.appendChild(row1);

        var vlanRow = el('div', { class: 'field-row' });
        vlanRow.appendChild(field({ label: 'VLAN (802.1Q)', type: 'checkbox', value: p.vlan.enabled,
          onChange: function (v) { p.vlan.enabled = v; renderEditor(); regen(); } }));
        if (p.vlan.enabled) {
          vlanRow.appendChild(field({ label: 'VLAN id', type: 'int', value: p.vlan.id, width: '70px',
            onChange: function (v) { p.vlan.id = v === null ? 100 : v; regen(); } }));
          vlanRow.appendChild(field({ label: 'Priority', type: 'int', value: p.vlan.prio, width: '60px',
            onChange: function (v) { p.vlan.prio = v === null ? 0 : v; regen(); } }));
        }
        box.appendChild(vlanRow);

        var l3Row = el('div', { class: 'field-row' });
        l3Row.appendChild(field({ label: 'L3', type: 'select', value: p.l3.type,
          options: [{ value: 'ipv4', label: 'IPv4' }, { value: 'ipv6', label: 'IPv6' }],
          onChange: function (v) { p.l3.type = v; renderEditor(); regen(); } }));
        var ipValidate = p.l3.type === 'ipv4'
          ? function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; }
          : function (v) { return TB.util.isIpv6(v) ? null : 'invalid IPv6'; };
        l3Row.appendChild(field({ label: 'Src IP', type: 'text', value: p.l3.src, validate: ipValidate,
          onChange: function (v) { p.l3.src = v || ''; regen(); } }));
        l3Row.appendChild(field({ label: 'Dst IP', type: 'text', value: p.l3.dst, validate: ipValidate,
          onChange: function (v) { p.l3.dst = v || ''; regen(); } }));
        if (p.l3.type === 'ipv4') {
          l3Row.appendChild(field({ label: 'TOS (opt.)', type: 'int', value: p.l3.tos, width: '60px',
            onChange: function (v) { p.l3.tos = v; regen(); } }));
          l3Row.appendChild(field({ label: 'TTL (opt.)', type: 'int', value: p.l3.ttl, width: '60px',
            onChange: function (v) { p.l3.ttl = v; regen(); } }));
        }
        box.appendChild(l3Row);

        var l4Row = el('div', { class: 'field-row' });
        l4Row.appendChild(field({ label: 'L4', type: 'select', value: p.l4.type,
          options: [{ value: 'udp', label: 'UDP' }, { value: 'tcp', label: 'TCP' }, { value: 'none', label: 'none' }],
          onChange: function (v) { p.l4.type = v; renderEditor(); regen(); } }));
        if (p.l4.type !== 'none') {
          l4Row.appendChild(field({ label: 'Src port', type: 'int', value: p.l4.sport, width: '80px',
            onChange: function (v) { p.l4.sport = v === null ? 0 : v; regen(); } }));
          l4Row.appendChild(field({ label: 'Dst port', type: 'int', value: p.l4.dport, width: '80px',
            onChange: function (v) { p.l4.dport = v === null ? 0 : v; regen(); } }));
        }
        if (p.l4.type === 'tcp') {
          l4Row.appendChild(field({ label: 'TCP flags (e.g. S)', type: 'text', value: p.l4.tcpFlags, width: '80px',
            onChange: function (v) { p.l4.tcpFlags = v; regen(); } }));
        }
        box.appendChild(l4Row);

        var payRow = el('div', { class: 'field-row' });
        var intTunables = model.tunables.filter(function (t) { return t.type === 'int'; });
        payRow.appendChild(field({ label: 'Frame size (bytes)', type: 'int', value: p.payload.frameSize, width: '90px',
          disabled: !!p.payload.frameSizeTunable,
          onChange: function (v) { p.payload.frameSize = v === null ? 64 : v; renderEditor(); regen(); } }));
        payRow.appendChild(field({ label: '⚙ bind to tunable', type: 'select',
          value: p.payload.frameSizeTunable || '',
          options: [{ value: '', label: '(literal)' }].concat(intTunables.map(function (t) { return { value: t.name, label: '--' + t.name }; })),
          onChange: function (v) { p.payload.frameSizeTunable = v || null; renderEditor(); regen(); } }));
        payRow.appendChild(field({ label: 'Fill char', type: 'text', value: p.payload.fill, width: '50px',
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
        row.appendChild(field({ label: 'Mode', type: 'select', value: m.type,
          options: [{ value: 'cont', label: 'continuous' }, { value: 'single_burst', label: 'single burst' }, { value: 'multi_burst', label: 'multi burst' }],
          onChange: function (v) { m.type = v; renderEditor(); renderList(); regen(); } }));
        row.appendChild(field({ label: 'PPS', type: 'float', value: m.pps, width: '90px',
          onChange: function (v) { m.pps = v === null ? 1 : v; renderList(); regen(); } }));
        if (m.type === 'single_burst') {
          row.appendChild(field({ label: 'Total packets', type: 'int', value: m.totalPkts, width: '90px',
            onChange: function (v) { m.totalPkts = v === null ? 1000 : v; regen(); } }));
        }
        if (m.type === 'multi_burst') {
          row.appendChild(field({ label: 'Pkts/burst', type: 'int', value: m.pktsPerBurst, width: '80px',
            onChange: function (v) { m.pktsPerBurst = v === null ? 1 : v; regen(); } }));
          row.appendChild(field({ label: 'IBG (µs)', type: 'float', value: m.ibgUsec, width: '100px',
            onChange: function (v) { m.ibgUsec = v === null ? 0 : v; regen(); } }));
          row.appendChild(field({ label: 'Burst count', type: 'int', value: m.count, width: '80px',
            onChange: function (v) { m.count = v === null ? 1 : v; regen(); } }));
        }
        box.appendChild(row);
        return box;
      }

      function chainSection(s) {
        var box = el('div', {});
        var row = el('div', { class: 'field-row' });
        row.appendChild(field({ label: 'ISG - start delay (µs)', type: 'float', value: s.isgUsec, width: '100px',
          onChange: function (v) { s.isgUsec = v === null ? 0 : v; regen(); } }));
        row.appendChild(field({ label: 'Self start', type: 'checkbox', value: s.chain.selfStart,
          onChange: function (v) { s.chain.selfStart = v; regen(); } }));
        var others = model.streams.filter(function (o) { return o.id !== s.id; });
        row.appendChild(field({ label: 'Next stream', type: 'select', value: s.chain.next || '',
          options: [{ value: '', label: '(none)' }].concat(others.map(function (o) { return { value: o.name, label: o.name }; })),
          onChange: function (v) { s.chain.next = v || null; regen(); } }));
        row.appendChild(field({ label: 'Action count', type: 'int', value: s.chain.actionCount, width: '80px',
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
          row.appendChild(field({ label: 'name', type: 'text', value: v.name, width: '90px',
            onChange: function (x) { v.name = (x || 'var').replace(/\W+/g, '_'); regen(); } }));
          row.appendChild(field({ label: 'size', type: 'select', value: String(v.sizeBytes),
            options: ['1', '2', '4', '8'].map(function (x) { return { value: x }; }),
            onChange: function (x) { v.sizeBytes = parseInt(x, 10); regen(); } }));
          row.appendChild(field({ label: 'op', type: 'select', value: v.op,
            options: ['inc', 'dec', 'random'].map(function (x) { return { value: x }; }),
            onChange: function (x) { v.op = x; regen(); } }));
          row.appendChild(field({ label: 'min', type: 'text', value: v.min, width: '100px',
            onChange: function (x) { v.min = x || '0'; regen(); } }));
          row.appendChild(field({ label: 'max', type: 'text', value: v.max, width: '100px',
            onChange: function (x) { v.max = x || '0'; regen(); } }));
          row.appendChild(field({ label: 'step', type: 'int', value: v.step, width: '55px',
            onChange: function (x) { v.step = x === null ? 1 : x; regen(); } }));
          row.appendChild(writeTargetField('write to', v.writeTo, function (x) { v.writeTo = x; regen(); }));
          row.appendChild(field({ label: 'fix IPv4 csum', type: 'checkbox', value: v.fixChecksum,
            onChange: function (x) { v.fixChecksum = x; regen(); } }));
          row.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
            onclick: function () { vm.vars.splice(idx, 1); renderEditor(); regen(); } }));
          box.appendChild(row);
        });
        box.appendChild(el('button', { class: 'btn btn-small', text: '+ Add variable',
          onclick: function () {
            vm.vars.push({ name: 'var' + (vm.vars.length + 1), sizeBytes: 4, op: 'inc',
              min: '16.0.0.1', max: '16.0.0.254', step: 1, writeTo: 'IP.src', fixChecksum: true });
            renderEditor(); regen();
          } }));

        var tupRow = el('div', { class: 'field-row' });
        tupRow.appendChild(field({ label: 'Tuple generator (IP + port pairs)', type: 'checkbox', value: !!vm.tuple,
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
          tr.appendChild(field({ label: 'Flow limit', type: 'int', value: t.limitFlows, width: '90px',
            onChange: function (v) { t.limitFlows = v === null ? 0 : v; regen(); } }));
          box.appendChild(tr);
          var tw = el('div', { class: 'field-row' });
          tw.appendChild(writeTargetField('write IP to', t.writeIpTo, function (v) { t.writeIpTo = v; regen(); }));
          tw.appendChild(writeTargetField('write port to', t.writePortTo, function (v) { t.writePortTo = v; regen(); }));
          box.appendChild(tw);
        }

        box.appendChild(field({ label: 'VM cache size (optional, speeds up repeated packets)', type: 'int',
          value: vm.cacheSize, width: '90px',
          onChange: function (v) { vm.cacheSize = v; regen(); } }));
        return box;
      }

      function flowStatsSection(s) {
        var fs = s.flowStats;
        var box = el('div', {});
        var row = el('div', { class: 'field-row' });
        row.appendChild(field({ label: 'Type', type: 'select', value: fs.type,
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
          row.appendChild(field({ label: 'pg_id', type: 'int', value: fs.pgId, width: '70px',
            onChange: function (v) { fs.pgId = v === null ? 1 : v; regen(); } }));
          row.appendChild(field({ label: 'add port_id to pg_id', type: 'checkbox', value: fs.addPortId,
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
        renderList();
        renderEditor();
        regen();
      }
      renderAll();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
