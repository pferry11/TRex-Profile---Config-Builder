/* TRex Profile & Config Builder - Platform Config tab: pick a server from the
 * settings registry, preview/download the generated trex_cfg.yaml. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  var state = { container: null, serverId: null };

  function render() {
    var el = TB.ui.el;
    var container = state.container;
    if (!container) { return; }
    container.innerHTML = '';

    var settings = TB.settings.get();
    var wrap = el('div', { class: 'settings-wrap' });
    container.appendChild(wrap);

    if (!settings.servers.length) {
      wrap.appendChild(el('div', { class: 'placeholder' }, [
        el('h2', { text: 'Platform Config (trex_cfg.yaml)' }),
        el('p', { text: 'No servers defined yet. Add one in the Settings tab first - PCI interfaces, cores, port MACs/IPs.' }),
        el('button', { class: 'btn btn-generate', text: 'Open Settings',
          onclick: function () { TB.app.activateTab('settings'); } })
      ]));
      return;
    }

    if (!state.serverId || !settings.servers.some(function (s) { return s.id === state.serverId; })) {
      state.serverId = settings.defaults.activeServerId || settings.servers[0].id;
      if (!settings.servers.some(function (s) { return s.id === state.serverId; })) {
        state.serverId = settings.servers[0].id;
      }
    }

    var bar = el('div', { class: 'field-row' });
    bar.appendChild(TB.ui.field({ label: 'Server', type: 'select', value: state.serverId,
      options: settings.servers.map(function (s) { return { value: s.id, label: s.name }; }),
      onChange: function (v) { state.serverId = v; render(); } }));
    bar.appendChild(el('button', { class: 'btn btn-secondary', text: 'Refresh from Settings',
      onclick: render }));
    bar.appendChild(el('button', { class: 'btn btn-secondary', text: 'Edit in Settings',
      onclick: function () { TB.app.activateTab('settings'); } }));
    wrap.appendChild(bar);

    var server = null;
    for (var i = 0; i < settings.servers.length; i++) {
      if (settings.servers[i].id === state.serverId) { server = settings.servers[i]; }
    }

    var version = settings.defaults.trexVersion;
    var gen = TB.gen.resolve(version, 'cfg');
    var out = el('div', {});
    wrap.appendChild(out);
    if (!gen) {
      out.appendChild(el('div', { class: 'output-empty', text: 'No cfg generator registered for TRex v' + version + '.' }));
      return;
    }
    var result = gen(server, { trexVersion: version });
    // "Download model" for a cfg is the server definition itself
    var pseudoModel = TB.util.deepClone(server);
    pseudoModel.kind = 'server';
    pseudoModel.meta = { name: 'server_' + server.name };
    TB.ui.output.render(out, { result: result, model: pseudoModel });
    out.appendChild(el('div', { class: 'info-note',
      text: 'Install as /etc/trex_cfg.yaml on the TRex box, or start with: ./t-rex-64 ... --cfg <path>' }));
  }

  TB.ui.cfgBuilder = {
    mount: function (container) {
      state.container = container;
      render();
    },
    /* called via the tab onShow hook so edits made in Settings are picked up */
    refresh: render
  };
})(typeof window !== 'undefined' ? window : globalThis);
