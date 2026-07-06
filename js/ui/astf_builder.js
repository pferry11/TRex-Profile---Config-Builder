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
      templates: [defaultTemplate(1)]
    };
  }

  TB.ui.astfBuilder = {
    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;

      var model = defaultModel();
      var selectedIdx = 0; // index into capList or templates depending on mode
      var regenTimer = null;

      TB.ui.ensurePcapDatalist();

      var topbar = el('div', { class: 'builder-topbar' });
      var listPane = el('div', { class: 'pane pane-list' });
      var editorPane = el('div', { class: 'pane pane-editor' });
      var outputPane = el('div', { class: 'pane pane-output' });
      container.appendChild(topbar);
      container.appendChild(el('div', { class: 'builder-panes' }, [listPane, editorPane, outputPane]));

      function items() { return model.mode === 'pcap' ? model.capList : model.templates; }

      function regen() {
        if (regenTimer) { clearTimeout(regenTimer); }
        regenTimer = setTimeout(function () {
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
        topbar.appendChild(field({ label: 'Profile name', type: 'text', value: model.meta.name, width: '160px',
          onChange: function (v) { model.meta.name = v || 'astf_profile'; regen(); } }));
        topbar.appendChild(field({ label: 'Description', type: 'text', value: model.meta.description, width: '180px',
          onChange: function (v) { model.meta.description = v || ''; regen(); } }));
        topbar.appendChild(field({ label: 'TRex version', type: 'select', value: model.trexVersion,
          options: TB.gen.versions().map(function (v) { return { value: v, label: 'v' + v }; }),
          onChange: function (v) { model.trexVersion = v; regen(); } }));
        topbar.appendChild(field({ label: 'Mode', type: 'select', value: model.mode,
          options: [{ value: 'pcap', label: 'pcap list (ASTFCapInfo)' }, { value: 'program', label: 'program (send/recv)' }],
          onChange: function (v) {
            model.mode = v;
            if (v === 'pcap' && !model.capList.length) { model.capList.push(defaultCap()); }
            if (v === 'program' && !model.templates.length) { model.templates.push(defaultTemplate(1)); }
            selectedIdx = 0;
            renderList(); renderEditor(); regen();
          } }));

        var actions = el('div', { class: 'topbar-actions' });
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
        var isPcap = model.mode === 'pcap';
        listPane.appendChild(el('div', { class: 'pane-title', text: isPcap ? 'Pcap entries' : 'Templates' }));
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
        box.appendChild(field({ label: 'distribution', type: 'select', value: side.distribution,
          options: [{ value: 'seq' }, { value: 'rand' }],
          onChange: function (v) { side.distribution = v; regen(); } }));
        box.appendChild(field({ label: 'per-core', type: 'select', value: side.perCore || '',
          options: [{ value: '', label: '(default)' }, { value: 'seq', label: 'seq' }],
          onChange: function (v) { side.perCore = v || null; regen(); } }));
        return box;
      }

      function ipGenSection() {
        var box = el('div', {});
        box.appendChild(rangeFields(model.ipGen.client, 'Clients'));
        box.appendChild(rangeFields(model.ipGen.server, 'Servers'));
        box.appendChild(field({ label: 'ip_offset (added per dual-port pair)', type: 'text',
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
            row.appendChild(field({ label: 'tcp.' + f, type: 'int', value: g.tcp[f], width: '80px',
              onChange: function (v) { g.tcp[f] = v; regen(); } }));
          });
        box.appendChild(row);
        var row2 = el('div', { class: 'field-row' });
        row2.appendChild(field({ label: 'rampup_sec', type: 'int', value: g.scheduler.rampupSec, width: '80px',
          hint: 'linear CPS ramp to max over N sec' + (label === 'Server side' ? ' (client side drives the ramp)' : ''),
          onChange: function (v) { g.scheduler.rampupSec = v; regen(); } }));
        row2.appendChild(field({ label: 'IPv6', type: 'checkbox', value: g.ipv6.enable,
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
        box.appendChild(field({ label: 'Override IP generator for this entry', type: 'checkbox',
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
        row.appendChild(field({ label: 'Pcap file (path on the TRex box)', type: 'text', value: c.file,
          width: '280px', datalist: 'avl-pcaps',
          hint: 'pcap dir setting: ' + TB.settings.get().defaults.pcapDir,
          onChange: function (v) { c.file = v || ''; renderList(); regen(); } }));
        var browse = TB.ui.pcapBrowseButton('avl', function (dir, file) {
          c.file = '../' + dir + '/' + file;
          renderList(); renderEditor(); regen();
        });
        if (browse) { row.appendChild(browse); }
        row.appendChild(field({ label: 'cps (at -m 1)', type: 'float', value: c.cps, width: '80px',
          onChange: function (v) { c.cps = v === null ? 1 : v; renderList(); regen(); } }));
        row.appendChild(field({ label: 'Port pin (opt.)', type: 'int', value: c.port, width: '70px',
          onChange: function (v) { c.port = v; regen(); } }));
        row.appendChild(field({ label: 's_delay µs (opt.)', type: 'int', value: c.sDelayUsec, width: '90px',
          onChange: function (v) { c.sDelayUsec = v; regen(); } }));
        box.appendChild(row);
        box.appendChild(overrideEditor(c));
        return box;
      }

      /* ---------- program template editor ---------- */
      function payloadFields(cmd) {
        var wrap = el('span', { class: 'field-row-inline' });
        var p = cmd.payload;
        wrap.appendChild(field({ label: 'payload', type: 'select', value: p.kind,
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
          wrap.appendChild(field({ label: 'body bytes', type: 'int', value: p.bodyBytes, width: '80px',
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
            row.appendChild(field({ label: 'auto (match peer send)', type: 'checkbox', value: auto,
              onChange: function (v) { cmd.bytes = v ? null : 0; renderEditor(); regen(); } }));
            if (!auto) {
              row.appendChild(field({ label: 'bytes', type: 'int', value: cmd.bytes, width: '90px',
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
        row.appendChild(field({ label: 'Template group name (opt.)', type: 'text', value: t.tgName, width: '120px',
          onChange: function (v) { t.tgName = v; renderList(); regen(); } }));
        row.appendChild(field({ label: 'cps (weight at -m 1)', type: 'float', value: t.cps, width: '90px',
          onChange: function (v) { t.cps = v === null ? 1 : v; renderList(); regen(); } }));
        row.appendChild(field({ label: 'Association port', type: 'int', value: t.assocPort, width: '80px',
          onChange: function (v) { t.assocPort = v; renderList(); regen(); } }));
        row.appendChild(field({ label: 'Transport', type: 'select', value: t.stream === false ? 'udp' : 'tcp',
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
        editorPane.appendChild(TB.ui.section('IP generator', ipGenSection(), true));
        editorPane.appendChild(TB.ui.section('Global info (TCP tuning / rampup / IPv6)', globalsSection(), false));

        var it = items()[selectedIdx];
        if (!it) {
          editorPane.appendChild(el('div', { class: 'output-empty', text: 'Nothing selected. Add an entry on the left.' }));
          return;
        }
        var title = model.mode === 'pcap'
          ? 'Pcap entry: ' + (it.file || '').split('/').pop()
          : 'Template: ' + (it.tgName || 'template ' + (selectedIdx + 1));
        editorPane.appendChild(TB.ui.section(title, model.mode === 'pcap' ? capEditor(it) : templateEditor(it), true));
      }

      function renderAll() {
        renderTopbar();
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
