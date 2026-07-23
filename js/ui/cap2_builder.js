/* TRex Profile & Config Builder - cap2 (legacy STF) profile builder tab.
 * Pcap-replay YAML profiles: generator IP ranges, global replay flags,
 * cap_info entries with optional dyn_pyload payload manipulation. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  function defaultCap() {
    return { name: 'cap2/dns.pcap', cps: 1.0, ipg: 10000, rtt: 10000, w: 1,
             limit: null, plugin_id: null, oneAppServer: null, serverAddr: null,
             clientPool: null, serverPool: null, dynPyload: null };
  }

  /* source-mac base: model stores a 6-byte array; the UI edits colon-hex. */
  function macToStr(arr) {
    if (!arr || arr.length !== 6) { return ''; }
    return arr.map(function (b) { var h = (b & 0xff).toString(16); return h.length < 2 ? '0' + h : h; }).join(':');
  }
  function strToMac(s) {
    var parts = String(s || '').trim().split(/[:\-\s]+/).filter(Boolean);
    if (parts.length !== 6) { return null; }
    var out = parts.map(function (p) { return parseInt(p, 16); });
    return out.every(function (n) { return isFinite(n) && n >= 0 && n <= 255; }) ? out : null;
  }

  /* src/dst_ipv6 base: model stores 6 hex words; the UI edits colon-hex groups. */
  function ipv6ToStr(arr) {
    if (!arr || arr.length !== 6) { return ''; }
    return arr.map(function (w) { return ('0000' + (w & 0xffff).toString(16)).slice(-4); }).join(':');
  }
  function strToIpv6(s) {
    var parts = String(s || '').trim().split(/[:\s]+/).filter(Boolean);
    if (parts.length !== 6) { return null; }
    var out = parts.map(function (p) { return parseInt(p, 16); });
    return out.every(function (n) { return isFinite(n) && n >= 0 && n <= 0xffff; }) ? out : null;
  }

  /* min/max_src/dst_ip: TRex stores these as 32-bit hex (0x10000001), but every
     value maps 1:1 to a dotted quad, so the UI shows/accepts dotted-decimal for
     readability. The model keeps the hex form so emit/import round-trip byte for
     byte. hexToIp displays canonical hex as an IPv4; anything else passes through
     (e.g. a value still being typed). ipToHex normalises IPv4 *or* hex to 0x-hex. */
  function hexToIp(hex) {
    hex = String(hex || '');
    if (!/^0x[0-9a-fA-F]+$/.test(hex)) { return hex; }
    var n = parseInt(hex, 16) >>> 0;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }
  function ipToHex(v) {
    v = String(v || '').trim();
    if (v === '') { return null; }
    if (/^0x[0-9a-fA-F]+$/.test(v)) { return '0x' + ('00000000' + (parseInt(v, 16) >>> 0).toString(16)).slice(-8); }
    if (TB.util.isIpv4(v)) {
      var p = v.split('.');
      var n = ((+p[0]) << 24 >>> 0) + ((+p[1]) << 16) + ((+p[2]) << 8) + (+p[3]);
      return '0x' + ('00000000' + (n >>> 0).toString(16)).slice(-8);
    }
    return null;
  }

  function defaultModel() {
    return {
      kind: 'cap2',
      schemaVersion: 1,
      trexVersion: TB.settings.get().defaults.trexVersion,
      meta: { name: 'my_stf_profile', description: '', modified: '' },
      duration: 10.0,
      generator: { distribution: 'seq', clientsStart: '16.0.0.1', clientsEnd: '16.0.1.255',
                   serversStart: '48.0.0.1', serversEnd: '48.0.0.255',
                   clientsPerGb: 201, minClients: 101, dualPortMask: '1.0.0.0', tcpAging: 1, udpAging: 1,
                   clientPools: null, serverPools: null },
      flags: { capIpg: null, capOverrideIpg: null, capIpgMin: null,
               vlan: { enabled: false, vlan0: 100, vlan1: 200 }, macOverrideByIp: null, mac: null,
               srcIpv6: null, dstIpv6: null, tw: null,
               minSrcIp: null, maxSrcIp: null, minDstIp: null, maxDstIp: null },
      capInfo: [defaultCap()]
    };
  }

  TB.ui.cap2Builder = {
    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;

      var model = defaultModel();
      var selectedIdx = 0;
      var history = TB.history.create();
      var histCtl = TB.ui.historyControls(history, function (m) {
        model = m;
        if (selectedIdx >= model.capInfo.length) { selectedIdx = Math.max(0, model.capInfo.length - 1); }
        renderAll();
      });
      var regenTimer = null;

      TB.ui.ensureCap2Datalist();

      var topbar = el('div', { class: 'builder-topbar' });
      var listPane = el('div', { class: 'pane pane-list' });
      var editorPane = el('div', { class: 'pane pane-editor' });
      var outputPane = el('div', { class: 'pane pane-output' });
      container.appendChild(topbar);
      container.appendChild(el('div', { class: 'builder-panes' }, [listPane, editorPane, outputPane]));

      function regen() {
        if (regenTimer) { clearTimeout(regenTimer); }
        regenTimer = setTimeout(function () {
          history.record(model);
          var gen = TB.gen.resolve(model.trexVersion, 'cap2');
          if (!gen) {
            outputPane.innerHTML = '';
            outputPane.appendChild(el('div', { class: 'output-empty',
              text: 'No cap2 generator registered for TRex v' + model.trexVersion + '.' }));
            return;
          }
          TB.ui.output.render(outputPane, { result: gen(model), model: model,
            /* two distinct open operations, matching the output-pane labels:
               a .yaml TRex profile is parsed from its body; a .json builder
               file is an exact restore. */
            profileAccept: '.yaml,.yml',
            onOpenProfile: function (text, filename) { importArtifact(text, filename); },
            onOpenBuilderFile: function (text) {
              try { loadModel(JSON.parse(text)); }
              catch (e) { TB.ui.toast('Not a valid builder file (.json): ' + e.message, 'err'); }
            } });
        }, 120);
      }

      /* ---------- top bar (same pattern as the other builders) ---------- */
      function renderTopbar() {
        topbar.innerHTML = '';
        topbar.appendChild(field({ label: 'Profile name', tip: TB.help.cap2.profileName, type: 'text', value: model.meta.name, width: '160px',
          onChange: function (v) { model.meta.name = v || 'stf_profile'; regen(); } }));
        topbar.appendChild(field({ label: 'Duration (sec)', tip: TB.help.cap2.duration, type: 'float', value: model.duration, width: '80px',
          onChange: function (v) { model.duration = v === null ? 10 : v; regen(); } }));
        topbar.appendChild(field({ label: 'TRex version', tip: TB.help.stl.trexVersion, type: 'select', value: model.trexVersion,
          options: TB.gen.versions().map(function (v) { return { value: v, label: 'v' + v }; }),
          onChange: function (v) { model.trexVersion = v; regen(); } }));

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
        TB.persist.listProfiles('cap2').forEach(function (m) {
          savedSel.appendChild(el('option', { value: m.meta.name, text: m.meta.name }));
        });
        actions.appendChild(savedSel);
        actions.appendChild(el('button', { class: 'btn', text: 'Load',
          onclick: function () {
            if (!savedSel.value) { return; }
            loadModel(TB.persist.getProfile('cap2', savedSel.value));
          } }));
        actions.appendChild(el('button', { class: 'btn btn-secondary', text: 'Delete',
          onclick: function () {
            if (!savedSel.value || !confirm('Delete saved profile "' + savedSel.value + '"?')) { return; }
            TB.persist.deleteProfile('cap2', savedSel.value);
            renderTopbar();
          } }));
        /* File open lives in the output pane now, split into two clearly-labelled
           actions (Open profile… / Open builder file…) wired in regen(). */
        topbar.appendChild(actions);
      }

      function loadModel(m) {
        if (!m) { TB.ui.toast('Profile not found', 'err'); return; }
        if (m.kind !== 'cap2') { TB.ui.toast('Not a cap2 model (kind=' + m.kind + ')', 'err'); return; }
        if (m.schemaVersion > 1) {
          TB.ui.toast('Model schemaVersion ' + m.schemaVersion + ' is newer than this app supports (1).', 'err');
          return;
        }
        model = TB.util.deepClone(m);
        selectedIdx = 0;
        renderAll();
      }

      /* Re-import a cap2 .yaml artifact. Values are read from the file body (so
         hand-edits are honoured); the profile name comes from the file name, since
         the body carries no name of its own. Coverage is reported to the user. */
      function importArtifact(text, filename) {
        var res = TB.imp.parse(text, { kind: 'cap2' });
        if (!res.ok) { TB.ui.toast(res.error, 'err'); return; }
        var base = (filename || '').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_');
        if (base) { res.model.meta.name = base; }
        loadModel(res.model);
        reportImport(res, filename);
      }

      function reportImport(res, filename) {
        var pct = Math.round(res.coverage * 100);
        if (res.coverage === 1 && !res.unmapped.length) {
          TB.ui.toast('Imported "' + filename + '"' + (res.source === 'tool'
            ? ' - builder file, all ' + res.total + ' settings mapped.'
            : ' - mapped all ' + res.total + ' recognised settings.'), 'ok');
          return;
        }
        var lead = res.source === 'tool'
          ? 'This builder file carries settings the app doesn\'t recognise (a hand-added or newer TRex knob). Everything it knows was imported; the lines below were left out:'
          : 'This file wasn\'t generated by the builder, so it was parsed best-effort. Everything recognised was imported; the lines below had no matching field:';
        var banner = el('div', { class: 'warn-banner' }, [
          el('div', {}, [el('strong', { text: 'Partial import - ' + pct + '% mapped (' + res.mapped + ' of ' + res.total + ' settings).' })]),
          el('div', { text: lead }),
          el('ul', {}, res.unmapped.slice(0, 40).map(function (l) { return el('li', { text: l }); })
            .concat(res.unmapped.length > 40 ? [el('li', { text: '…and ' + (res.unmapped.length - 40) + ' more.' })] : []))
        ]);
        var body = el('div', {}, [banner,
          el('p', { text: 'Everything that mapped has been loaded into the builder - review the fields, then regenerate.' })]);
        TB.ui.toast('Partial import: ' + pct + '% of "' + filename + '" mapped.', 'warn');
        TB.ui.modal('Imported "' + filename + '"', body);
      }

      /* ---------- left: cap_info list ---------- */
      function renderList() {
        listPane.innerHTML = '';
        listPane.appendChild(el('div', { class: 'pane-title', text: 'Pcap templates' }));
        model.capInfo.forEach(function (c, idx) {
          var row = el('div', {
            class: 'stream-item' + (idx === selectedIdx ? ' active' : ''),
            onclick: function () { selectedIdx = idx; renderList(); renderEditor(); }
          });
          /* Controls sit in a fixed header row; the pcap name wraps underneath,
             so a long space-free filename can never push them out of the card. */
          var head = el('div', { class: 'stream-head' });
          head.appendChild(el('span', { class: 'stream-index', text: '#' + (idx + 1) }));
          var btns = el('div', { class: 'stream-btns' });
          function sbtn(label, title, fn) {
            btns.appendChild(el('button', { class: 'btn btn-small', text: label, title: title,
              onclick: function (e) { e.stopPropagation(); fn(); } }));
          }
          sbtn('↑', 'move up', function () {
            if (idx > 0) {
              model.capInfo.splice(idx - 1, 0, model.capInfo.splice(idx, 1)[0]);
              if (selectedIdx === idx) { selectedIdx = idx - 1; }
              renderList(); renderEditor(); regen();
            }
          });
          sbtn('↓', 'move down', function () {
            if (idx < model.capInfo.length - 1) {
              model.capInfo.splice(idx + 1, 0, model.capInfo.splice(idx, 1)[0]);
              if (selectedIdx === idx) { selectedIdx = idx + 1; }
              renderList(); renderEditor(); regen();
            }
          });
          sbtn('⧉', 'duplicate', function () {
            model.capInfo.splice(idx + 1, 0, TB.util.deepClone(c));
            selectedIdx = idx + 1;
            renderList(); renderEditor(); regen();
          });
          sbtn('✕', 'delete', function () {
            if (!confirm('Delete this pcap template?')) { return; }
            model.capInfo.splice(idx, 1);
            if (selectedIdx >= model.capInfo.length) { selectedIdx = Math.max(0, model.capInfo.length - 1); }
            renderList(); renderEditor(); regen();
          });
          head.appendChild(btns);
          row.appendChild(head);
          row.appendChild(el('div', { class: 'stream-name' }, [
            el('div', { text: (c.name || '?').split('/').pop() }),
            el('small', { text: 'cps ' + c.cps + (c.dynPyload && c.dynPyload.length ? ' · dyn_pyload' : '') })
          ]));
          listPane.appendChild(row);
        });
        listPane.appendChild(el('button', { class: 'btn list-action', text: '+ Add pcap template',
          onclick: function () {
            model.capInfo.push(defaultCap());
            selectedIdx = model.capInfo.length - 1;
            renderList(); renderEditor(); regen();
          } }));
      }

      /* ---------- center: generator + flags + selected cap ---------- */
      function generatorSection() {
        var g = model.generator;
        var box = el('div', {});
        var r1 = el('div', { class: 'field-row' });
        r1.appendChild(field({ label: 'Distribution', tip: TB.help.astf.distribution, type: 'select', value: g.distribution,
          options: [{ value: 'seq' }, { value: 'random' }, { value: 'normal' }],
          onChange: function (v) { g.distribution = v; regen(); } }));
        [['clientsStart', 'Clients start'], ['clientsEnd', 'Clients end'],
         ['serversStart', 'Servers start'], ['serversEnd', 'Servers end']].forEach(function (p) {
          r1.appendChild(field({ label: p[1], type: 'text', value: g[p[0]], width: '105px',
            tip: p[0].indexOf('clients') === 0 ? TB.help.cap2.clientsRange : TB.help.cap2.serversRange,
            validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
            onChange: function (v) { g[p[0]] = v || ''; regen(); } }));
        });
        box.appendChild(r1);
        var r2 = el('div', { class: 'field-row' });
        r2.appendChild(field({ label: 'clients_per_gb', tip: TB.help.cap2.clientsPerGb, type: 'int', value: g.clientsPerGb, width: '80px',
          onChange: function (v) { g.clientsPerGb = v; regen(); } }));
        r2.appendChild(field({ label: 'min_clients', tip: TB.help.cap2.minClients, type: 'int', value: g.minClients, width: '80px',
          onChange: function (v) { g.minClients = v; regen(); } }));
        r2.appendChild(field({ label: 'dual_port_mask', tip: TB.help.cap2.dualPortMask, type: 'text', value: g.dualPortMask, width: '90px',
          hint: 'IP offset added on the second port pair',
          onChange: function (v) { g.dualPortMask = v; regen(); } }));
        r2.appendChild(field({ label: 'tcp_aging (s)', tip: TB.help.cap2.aging, type: 'int', value: g.tcpAging, width: '70px',
          onChange: function (v) { g.tcpAging = v; regen(); } }));
        r2.appendChild(field({ label: 'udp_aging (s)', tip: TB.help.cap2.aging, type: 'int', value: g.udpAging, width: '70px',
          onChange: function (v) { g.udpAging = v; regen(); } }));
        box.appendChild(r2);
        return box;
      }

      /* ---------- per-template generator pools ---------- */
      function newPool(side) {
        var p = { name: (side === 'client' ? 'c' : 's') +
          ((model.generator[side === 'client' ? 'clientPools' : 'serverPools'] || []).length + 1),
          distribution: model.generator.distribution || 'seq', ipStart: '', ipEnd: '' };
        if (side === 'server') { p.trackPorts = false; }
        return p;
      }

      function poolListEditor(side) {
        var isServer = side === 'server';
        var key = isServer ? 'serverPools' : 'clientPools';
        var g = model.generator;
        var box = el('div', {});
        (g[key] || []).forEach(function (p, idx) {
          var row = el('div', { class: 'vm-var-row' });
          row.appendChild(field({ label: 'name', tip: TB.help.cap2.poolName, type: 'text', value: p.name, width: '60px',
            onChange: function (v) { p.name = v || ''; renderEditor(); regen(); } }));
          row.appendChild(field({ label: 'distribution', type: 'select', value: p.distribution,
            options: [{ value: 'seq' }, { value: 'random' }, { value: 'normal' }],
            onChange: function (v) { p.distribution = v; regen(); } }));
          row.appendChild(field({ label: 'ip_start', type: 'text', value: p.ipStart, width: '105px',
            validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
            onChange: function (v) { p.ipStart = v || ''; regen(); } }));
          row.appendChild(field({ label: 'ip_end', type: 'text', value: p.ipEnd, width: '105px',
            validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
            onChange: function (v) { p.ipEnd = v || ''; regen(); } }));
          if (isServer) {
            row.appendChild(field({ label: 'track_ports', tip: TB.help.cap2.trackPorts, type: 'checkbox', value: p.trackPorts === true,
              onChange: function (v) { p.trackPorts = !!v; regen(); } }));
          }
          row.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕', title: 'delete pool',
            onclick: function () {
              g[key].splice(idx, 1);
              if (!g[key].length) { g[key] = null; }
              renderEditor(); regen();
            } }));
          box.appendChild(row);
        });
        box.appendChild(el('button', { class: 'btn btn-small', text: '+ Add ' + side + ' pool',
          onclick: function () {
            g[key] = g[key] || [];
            g[key].push(newPool(side));
            renderEditor(); regen();
          } }));
        return box;
      }

      function poolsSection() {
        var box = el('div', {});
        box.appendChild(el('div', { class: 'field-hint',
          text: 'Optional named sub-ranges. A pcap template can pin its client/server IPs to a pool via client_pool / server_pool (in the template editor below) instead of the global ranges above. Matches the shipped per_template_gen / many_client profiles.' }));
        box.appendChild(el('div', { style: 'margin:8px 0 2px; font-weight:600;' }, [el('span', { text: 'Client pools (generator_clients)' })]));
        box.appendChild(poolListEditor('client'));
        box.appendChild(el('div', { style: 'margin:10px 0 2px; font-weight:600;' }, [el('span', { text: 'Server pools (generator_servers)' })]));
        box.appendChild(poolListEditor('server'));
        return box;
      }

      function flagsSection() {
        var f = model.flags;
        var box = el('div', {});
        var r1 = el('div', { class: 'field-row' });
        r1.appendChild(field({ label: "cap_ipg (use pcap's real inter-packet gaps)", tip: TB.help.cap2.capIpg, type: 'checkbox',
          value: f.capIpg === true,
          onChange: function (v) { f.capIpg = v ? true : null; regen(); } }));
        r1.appendChild(field({ label: 'cap_override_ipg (µs)', tip: TB.help.cap2.capOverrideIpg, type: 'int', value: f.capOverrideIpg, width: '90px',
          onChange: function (v) { f.capOverrideIpg = v; regen(); } }));
        r1.appendChild(field({ label: 'cap_ipg_min (µs)', tip: TB.help.cap2.capIpgMin, type: 'int', value: f.capIpgMin, width: '90px',
          onChange: function (v) { f.capIpgMin = v; regen(); } }));
        r1.appendChild(field({ label: 'mac_override_by_ip', tip: TB.help.cap2.macOverrideByIp, type: 'int', value: f.macOverrideByIp, width: '70px',
          onChange: function (v) { f.macOverrideByIp = v; regen(); } }));
        r1.appendChild(field({ label: 'mac (source base)', tip: TB.help.cap2.mac, type: 'text', value: macToStr(f.mac), width: '150px',
          placeholder: '00:00:00:01:00:00',
          validate: function (v) { return (v === '' || strToMac(v)) ? null : 'six hex bytes, e.g. 00:00:00:01:00:00'; },
          onChange: function (v) { f.mac = v ? strToMac(v) : null; regen(); } }));
        box.appendChild(r1);
        var r2 = el('div', { class: 'field-row' });
        r2.appendChild(field({ label: 'VLAN load balance', tip: TB.help.cap2.vlanLb, type: 'checkbox', value: f.vlan.enabled,
          onChange: function (v) { f.vlan.enabled = v; renderEditor(); regen(); } }));
        if (f.vlan.enabled) {
          r2.appendChild(field({ label: 'vlan0', type: 'int', value: f.vlan.vlan0, width: '65px',
            onChange: function (v) { f.vlan.vlan0 = v === null ? 100 : v; regen(); } }));
          r2.appendChild(field({ label: 'vlan1', type: 'int', value: f.vlan.vlan1, width: '65px',
            onChange: function (v) { f.vlan.vlan1 = v === null ? 200 : v; regen(); } }));
        }
        box.appendChild(r2);

        /* IPv6 base addresses (src_ipv6 / dst_ipv6) - 6 hex words each */
        var r3 = el('div', { class: 'field-row' });
        [['srcIpv6', 'src_ipv6 (6 hex words)'], ['dstIpv6', 'dst_ipv6 (6 hex words)']].forEach(function (p) {
          r3.appendChild(field({ label: p[1], tip: TB.help.cap2.ipv6, type: 'text', value: ipv6ToStr(f[p[0]]), width: '210px',
            placeholder: '2001:0232:1002:0051:0000:0000',
            validate: function (v) { return (v === '' || strToIpv6(v)) ? null : 'six hex words, e.g. 2001:0232:1002:0051:0000:0000'; },
            onChange: function (v) { f[p[0]] = v ? strToIpv6(v) : null; regen(); } }));
        });
        box.appendChild(r3);

        /* min/max_src/dst_ip overrides - hex 32-bit values */
        var r4 = el('div', { class: 'field-row' });
        [['minSrcIp', 'min_src_ip'], ['maxSrcIp', 'max_src_ip'], ['minDstIp', 'min_dst_ip'], ['maxDstIp', 'max_dst_ip']].forEach(function (p) {
          r4.appendChild(field({ label: p[1], tip: TB.help.cap2.minMaxIp, type: 'text', value: hexToIp(f[p[0]]), width: '115px', placeholder: '16.0.0.1',
            validate: function (v) { return (v === '' || ipToHex(v)) ? null : 'IPv4 (16.0.0.1) or hex (0x10000001)'; },
            onChange: function (v) { f[p[0]] = v ? (ipToHex(v) || v) : null; regen(); } }));
        });
        box.appendChild(r4);

        /* timer wheel (tw) */
        var r5 = el('div', { class: 'field-row' });
        r5.appendChild(field({ label: 'timer wheel (tw)', tip: TB.help.cap2.tw, type: 'checkbox', value: !!f.tw,
          onChange: function (v) {
            f.tw = v ? { buckets: 32768, levels: 2, bucketTimeUsec: 20 } : null;
            renderEditor(); regen();
          } }));
        if (f.tw) {
          r5.appendChild(field({ label: 'buckets', type: 'int', value: f.tw.buckets, width: '80px',
            onChange: function (v) { f.tw.buckets = v; regen(); } }));
          r5.appendChild(field({ label: 'levels', type: 'int', value: f.tw.levels, width: '65px',
            onChange: function (v) { f.tw.levels = v; regen(); } }));
          r5.appendChild(field({ label: 'bucket_time_usec', type: 'float', value: f.tw.bucketTimeUsec, width: '95px',
            onChange: function (v) { f.tw.bucketTimeUsec = v; regen(); } }));
        }
        box.appendChild(r5);
        return box;
      }

      function capEditor(c) {
        var box = el('div', {});
        var r1 = el('div', { class: 'field-row' });
        r1.appendChild(field({ label: 'Pcap path (relative to the TRex dir)', tip: TB.help.cap2.pcapName, type: 'text', value: c.name,
          width: '230px', datalist: 'cap2-pcaps',
          onChange: function (v) {
            c.name = v || ''; renderList(); regen();
            /* live-refresh the section header without rebuilding the editor
               (a full renderEditor here would blur the field mid-typing) */
            var sec = editorPane.lastElementChild;
            var titleSpan = sec && sec.querySelector('.section-head > span:not(.caret):not(.tip-icon)');
            if (titleSpan) { titleSpan.textContent = 'Pcap template: ' + (c.name || '?').split('/').pop(); }
          } }));
        var browse = TB.ui.pcapBrowseButton('cap2', function (dir, file) {
          c.name = dir + '/' + file;
          renderList(); renderEditor(); regen();
        });
        if (browse) { r1.appendChild(browse); }
        r1.appendChild(field({ label: 'cps', tip: TB.help.cap2.cps, type: 'float', value: c.cps, width: '70px',
          onChange: function (v) { c.cps = v === null ? 1 : v; renderList(); regen(); } }));
        r1.appendChild(field({ label: 'ipg (µs)', tip: TB.help.cap2.ipg, type: 'int', value: c.ipg, width: '80px',
          onChange: function (v) { c.ipg = v === null ? 10000 : v; regen(); } }));
        r1.appendChild(field({ label: 'rtt (µs)', tip: TB.help.cap2.rtt, type: 'int', value: c.rtt, width: '80px',
          onChange: function (v) { c.rtt = v === null ? 10000 : v; regen(); } }));
        r1.appendChild(field({ label: 'w (weight)', tip: TB.help.cap2.w, type: 'int', value: c.w, width: '60px',
          onChange: function (v) { c.w = v === null ? 1 : v; regen(); } }));
        box.appendChild(r1);
        var r2 = el('div', { class: 'field-row' });
        r2.appendChild(field({ label: 'limit (max active flows, opt.)', tip: TB.help.cap2.limit, type: 'int', value: c.limit, width: '90px',
          onChange: function (v) { c.limit = v; regen(); } }));
        r2.appendChild(field({ label: 'plugin_id', tip: TB.help.cap2.pluginId, type: 'select',
          value: c.plugin_id === null || c.plugin_id === undefined ? '' : String(c.plugin_id),
          options: [{ value: '', label: '(none)' }, { value: '4', label: '4 - HTTP' }, { value: '5', label: '5 - DHCP' }],
          onChange: function (v) { c.plugin_id = v === '' ? null : parseInt(v, 10); regen(); } }));
        r2.appendChild(field({ label: 'one_app_server (all flows to one server)', tip: TB.help.cap2.oneAppServer, type: 'checkbox',
          value: c.oneAppServer === true,
          onChange: function (v) { c.oneAppServer = v ? true : null; if (!v) { c.serverAddr = null; } renderEditor(); regen(); } }));
        if (c.oneAppServer) {
          r2.appendChild(field({ label: 'server_addr', tip: TB.help.cap2.serverAddr, type: 'text', value: c.serverAddr, width: '110px',
            validate: function (v) { return (v === '' || TB.util.isIpv4(v)) ? null : 'invalid IPv4'; },
            onChange: function (v) { c.serverAddr = v || null; regen(); } }));
        }
        box.appendChild(r2);

        /* client_pool / server_pool: only meaningful when pools are defined */
        var g = model.generator;
        if ((g.clientPools && g.clientPools.length) || (g.serverPools && g.serverPools.length)) {
          var r3 = el('div', { class: 'field-row' });
          [['clientPool', 'client_pool', g.clientPools], ['serverPool', 'server_pool', g.serverPools]].forEach(function (p) {
            var names = (p[2] || []).map(function (x) { return x.name; });
            /* keep a stale reference visible so the user can see/fix it */
            if (c[p[0]] && names.indexOf(c[p[0]]) === -1) { names = names.concat(c[p[0]]); }
            var opts = [{ value: '', label: '(global range)' }].concat(names.map(function (n) { return { value: n, label: n }; }));
            r3.appendChild(field({ label: p[1], tip: TB.help.cap2.poolRef, type: 'select',
              value: c[p[0]] || '', options: opts,
              onChange: function (v) { c[p[0]] = v || null; regen(); } }));
          });
          box.appendChild(r3);
        }

        /* dyn_pyload editor */
        var dynBox = el('div', {});
        (c.dynPyload || []).forEach(function (d, i) {
          var dr = el('div', { class: 'vm-var-row' });
          dr.appendChild(field({ label: 'pkt_id', tip: TB.help.cap2.dynPktId, type: 'int', value: d.pktId, width: '55px',
            onChange: function (v) { d.pktId = v === null ? 1 : v; regen(); } }));
          dr.appendChild(field({ label: 'pyld_offset', tip: TB.help.cap2.dynOffset, type: 'int', value: d.pyldOffset, width: '75px',
            onChange: function (v) { d.pyldOffset = v === null ? 0 : v; regen(); } }));
          dr.appendChild(field({ label: 'type', tip: TB.help.cap2.dynType, type: 'select', value: String(d.type),
            options: [{ value: '0', label: '0 - random' }, { value: '1', label: '1 - client_ip' }],
            onChange: function (v) { d.type = parseInt(v, 10); regen(); } }));
          dr.appendChild(field({ label: 'len (uint32s)', tip: TB.help.cap2.dynLen, type: 'int', value: d.len, width: '70px',
            onChange: function (v) { d.len = v === null ? 1 : v; regen(); } }));
          dr.appendChild(field({ label: 'mask (hex)', tip: TB.help.cap2.dynMask, type: 'text', value: d.mask, width: '95px',
            validate: function (v) { return /^0x[0-9a-fA-F]+$/.test(v) ? null : 'expect hex like 0xffffffff'; },
            onChange: function (v) { d.mask = v || '0xffffffff'; regen(); } }));
          dr.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
            onclick: function () { c.dynPyload.splice(i, 1); renderEditor(); regen(); } }));
          dynBox.appendChild(dr);
        });
        dynBox.appendChild(el('button', { class: 'btn btn-small', text: '+ Add payload rewrite rule',
          onclick: function () {
            c.dynPyload = c.dynPyload || [];
            c.dynPyload.push({ pktId: 1, pyldOffset: 16, type: 0, len: 4, mask: '0xffffffff' });
            renderEditor(); regen();
          } }));
        box.appendChild(TB.ui.section('dyn_pyload - rewrite payload bytes per packet (pcap manipulation)',
          dynBox, !!(c.dynPyload && c.dynPyload.length)));
        return box;
      }

      function renderEditor() {
        editorPane.innerHTML = '';
        editorPane.appendChild(el('div', { class: 'pane-title', text: 'Profile' }));
        editorPane.appendChild(TB.ui.section('Generator (IP ranges & tuple pool)', generatorSection(), true, TB.help.cap2._sections.generator));
        var hasPools = (model.generator.clientPools && model.generator.clientPools.length) ||
                       (model.generator.serverPools && model.generator.serverPools.length);
        editorPane.appendChild(TB.ui.section('Per-template generator pools (named client/server sub-ranges)', poolsSection(), !!hasPools, TB.help.cap2._sections.pools));
        editorPane.appendChild(TB.ui.section('Global replay flags (cap_ipg / vlan / mac override)', flagsSection(), false, TB.help.cap2._sections.flags));
        var c = model.capInfo[selectedIdx];
        if (!c) {
          editorPane.appendChild(el('div', { class: 'output-empty', text: 'No pcap template selected. Add one on the left.' }));
          return;
        }
        editorPane.appendChild(TB.ui.section('Pcap template: ' + (c.name || '?').split('/').pop(), capEditor(c), true, TB.help.cap2._sections.cap));
      }

      function renderAll() {
        renderTopbar();
        renderList();
        renderEditor();
        regen();
      }
      renderAll();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
