/* TRex Profile & Config Builder - CLI Builder tab: composes t-rex-64 command
 * lines plus matching trex-console commands, pulling defaults from the
 * settings server registry and profile names from saved builder models. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  var state = { container: null, model: null, serverId: '' };

  function defaultModel() {
    var settings = TB.settings.get();
    return {
      kind: 'cli', schemaVersion: 1, trexVersion: settings.defaults.trexVersion,
      meta: { name: 'trex_run', description: '', modified: '' },
      mode: 'astf',
      cfgPath: '/etc/trex_cfg.yaml',
      cores: 4, mult: 1, durationSec: 60,
      latencyPps: null, flowPortAffinity: false,
      astfServerOnly: false, astfClientMask: null,
      profile: '', extraArgs: '', trexDir: '/opt/trex/v3.06'
    };
  }

  function render() {
    var el = TB.ui.el;
    var field = TB.ui.field;
    var container = state.container;
    if (!container) { return; }
    container.innerHTML = '';

    var settings = TB.settings.get();
    var m = state.model;
    var wrap = el('div', { class: 'settings-wrap' });
    container.appendChild(wrap);

    var out = el('div', {});

    function regen() {
      var gen = TB.gen.resolve(m.trexVersion, 'cli');
      if (!gen) {
        out.innerHTML = '';
        out.appendChild(el('div', { class: 'output-empty', text: 'No CLI generator registered for TRex v' + m.trexVersion + '.' }));
        return;
      }
      TB.ui.output.render(out, { result: gen(m), model: m });
    }

    /* ---- server + mode row ---- */
    var r1 = el('div', { class: 'field-row' });
    r1.appendChild(field({ label: 'Server (prefills cores / TRex dir)', type: 'select',
      value: state.serverId,
      options: [{ value: '', label: '(custom)' }].concat(settings.servers.map(function (s) {
        return { value: s.id, label: s.name };
      })),
      onChange: function (v) {
        state.serverId = v;
        var srv = null;
        settings.servers.forEach(function (s) { if (s.id === v) { srv = s; } });
        if (srv) {
          if (srv.cores) { m.cores = srv.cores; }
          if (srv.trexDir) { m.trexDir = srv.trexDir; }
          m.meta.name = 'run_' + srv.name.replace(/[^\w.-]+/g, '_');
        }
        render();
      } }));
    r1.appendChild(field({ label: 'Mode', type: 'select', value: m.mode,
      options: [
        { value: 'astf', label: 'Interactive ASTF (-i --astf)' },
        { value: 'stl', label: 'Interactive STL (-i --stl)' },
        { value: 'legacy', label: 'Legacy/batch STF (-f profile.yaml)' }
      ],
      onChange: function (v) { m.mode = v; m.profile = ''; render(); } }));
    r1.appendChild(field({ label: 'Name (for run_<name>.sh)', type: 'text', value: m.meta.name, width: '130px',
      onChange: function (v) { m.meta.name = v || 'trex_run'; regen(); } }));
    wrap.appendChild(r1);

    /* ---- profile row ---- */
    var r2 = el('div', { class: 'field-row' });
    if (m.mode !== 'legacy') {
      var saved = TB.persist.listProfiles(m.mode);
      r2.appendChild(field({ label: 'Saved profile', type: 'select',
        value: '',
        options: [{ value: '', label: '(pick or type below)' }].concat(saved.map(function (p) {
          var f = p.meta.name.replace(/[^\w.-]+/g, '_') + '.py';
          return { value: f, label: p.meta.name + ' (' + f + ')' };
        })),
        onChange: function (v) { if (v) { m.profile = v; render(); } } }));
    }
    r2.appendChild(field({ label: 'Profile path (' + (m.mode === 'legacy' ? '.yaml' : '.py') + ')',
      type: 'text', value: m.profile, width: '240px',
      placeholder: m.mode === 'legacy' ? 'cap2/dns.yaml' : 'my_profile.py',
      onChange: function (v) { m.profile = v || ''; regen(); } }));
    wrap.appendChild(r2);

    /* ---- flags row ---- */
    var r3 = el('div', { class: 'field-row' });
    r3.appendChild(field({ label: '--cfg path', type: 'text', value: m.cfgPath, width: '180px',
      onChange: function (v) { m.cfgPath = v || ''; regen(); } }));
    r3.appendChild(field({ label: 'Cores (-c)', type: 'int', value: m.cores, width: '60px',
      onChange: function (v) { m.cores = v; regen(); } }));
    r3.appendChild(field({ label: 'Multiplier (-m)', type: 'float', value: m.mult, width: '70px',
      onChange: function (v) { m.mult = v === null ? 1 : v; regen(); } }));
    r3.appendChild(field({ label: 'Duration sec (-d)', type: 'int', value: m.durationSec, width: '80px',
      onChange: function (v) { m.durationSec = v; regen(); } }));
    if (m.mode !== 'stl') {
      r3.appendChild(field({ label: 'Latency pps (-l)', type: 'int', value: m.latencyPps, width: '80px',
        onChange: function (v) { m.latencyPps = v; regen(); } }));
    }
    if (m.mode === 'legacy') {
      r3.appendChild(field({ label: '-p (flow-port affinity)', type: 'checkbox', value: m.flowPortAffinity,
        onChange: function (v) { m.flowPortAffinity = v; regen(); } }));
    }
    r3.appendChild(field({ label: 'TRex dir', type: 'text', value: m.trexDir, width: '150px',
      onChange: function (v) { m.trexDir = v || ''; regen(); } }));
    wrap.appendChild(r3);

    /* ---- ASTF extras (mutually exclusive) ---- */
    if (m.mode === 'astf') {
      var r4 = el('div', { class: 'field-row' });
      r4.appendChild(field({ label: '--astf-server-only (this box only answers)', type: 'checkbox',
        value: m.astfServerOnly,
        disabled: !!m.astfClientMask,
        onChange: function (v) { m.astfServerOnly = v; render(); } }));
      r4.appendChild(field({ label: '--astf-client-mask (hex port bitmask)', type: 'text',
        value: m.astfClientMask, width: '90px', placeholder: '0x1',
        disabled: m.astfServerOnly,
        validate: function (v) { return /^0x[0-9a-fA-F]+$/.test(v) ? null : 'expect hex like 0x1'; },
        onChange: function (v) { m.astfClientMask = v; render(); } }));
      r4.appendChild(el('span', { class: 'field-hint',
        text: 'two-server split: receiver = server-only, sender = client mask (see Scenarios tab)' }));
      wrap.appendChild(r4);
    }

    /* ---- extra args ---- */
    var r5 = el('div', { class: 'field-row' });
    r5.appendChild(field({ label: 'Extra args (appended verbatim)', type: 'text', value: m.extraArgs, width: '320px',
      onChange: function (v) { m.extraArgs = v || ''; regen(); } }));
    wrap.appendChild(r5);

    wrap.appendChild(out);
    regen();
  }

  TB.ui.cliBuilder = {
    mount: function (container) {
      state.container = container;
      state.model = defaultModel();
      render();
    },
    /* tab onShow hook: refresh server + saved-profile lists */
    refresh: function () { if (state.model) { render(); } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
