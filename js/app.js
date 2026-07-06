/* TRex Profile & Config Builder - application boot: header, tabs, workspace actions. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  var TABS = [
    { id: 'stl', label: 'STL Profile', mount: function (c) { TB.ui.stlBuilder.mount(c); } },
    { id: 'astf', label: 'ASTF Profile', mount: function (c) { TB.ui.astfBuilder.mount(c); } },
    { id: 'scenarios', label: 'Scenarios', mount: function (c) { TB.ui.scenarios.mount(c); } },
    { id: 'settings', label: 'Settings', mount: null }
  ];

  function placeholder(container, label) {
    container.appendChild(TB.ui.el('div', { class: 'placeholder' }, [
      TB.ui.el('h2', { text: label }),
      TB.ui.el('p', { text: 'Coming in a later phase. See docs/BUILD_PROMPTS.md for the build plan.' })
    ]));
  }

  function boot() {
    var el = TB.ui.el;
    var app = document.getElementById('app');
    var uiState = TB.persist.get(TB.persist.KEYS.ui, { activeTab: 'stl' });

    /* header */
    var header = el('div', { class: 'app-header' });
    header.appendChild(el('div', { class: 'app-title' }, [
      el('span', { text: 'TRex Profile & Config Builder' }),
      el('span', { class: 'app-badge', text: 'target v' + TB.settings.get().defaults.trexVersion })
    ]));

    var wsActions = el('div', { class: 'ws-actions' });
    wsActions.appendChild(el('button', {
      class: 'btn btn-secondary', text: 'Export workspace',
      title: 'Download settings + all saved profiles as one JSON file',
      onclick: function () {
        TB.util.downloadText('trexb-workspace.json', JSON.stringify(TB.persist.exportWorkspace(), null, 2));
      }
    }));
    var importInput = el('input', { type: 'file', accept: '.json' });
    importInput.style.display = 'none';
    importInput.addEventListener('change', function () {
      var f = importInput.files[0];
      if (!f) { return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var r = TB.persist.importWorkspace(JSON.parse(reader.result));
          if (r.ok) {
            TB.ui.toast('Workspace imported - reloading', 'ok');
            setTimeout(function () { location.reload(); }, 600);
          } else {
            TB.ui.toast(r.error, 'err');
          }
        } catch (e) {
          TB.ui.toast('Not valid JSON: ' + e.message, 'err');
        }
      };
      reader.readAsText(f);
    });
    wsActions.appendChild(importInput);
    wsActions.appendChild(el('button', {
      class: 'btn btn-secondary', text: 'Import workspace',
      onclick: function () { importInput.click(); }
    }));
    header.appendChild(wsActions);
    app.appendChild(header);

    /* tabs */
    var tabBar = el('div', { class: 'tab-bar' });
    var content = el('div', { class: 'tab-content' });
    app.appendChild(tabBar);
    app.appendChild(content);

    var mounted = {};
    function activate(id) {
      uiState.activeTab = id;
      TB.persist.set(TB.persist.KEYS.ui, uiState);
      Array.prototype.forEach.call(tabBar.children, function (b) {
        b.classList.toggle('active', b.dataset.tab === id);
      });
      Array.prototype.forEach.call(content.children, function (pane) {
        pane.style.display = pane.dataset.tab === id ? '' : 'none';
      });
      var tab = null;
      for (var i = 0; i < TABS.length; i++) { if (TABS[i].id === id) { tab = TABS[i]; } }
      if (!mounted[id]) {
        var pane = content.querySelector('[data-tab="' + id + '"]');
        if (tab.mount) { tab.mount(pane); } else { placeholder(pane, tab.label); }
        mounted[id] = true;
      }
    }

    TABS.forEach(function (t) {
      var btn = el('button', { class: 'tab-btn', text: t.label, onclick: function () { activate(t.id); } });
      btn.dataset.tab = t.id;
      tabBar.appendChild(btn);
      var pane = el('div', { class: 'tab-pane' });
      pane.dataset.tab = t.id;
      pane.style.display = 'none';
      content.appendChild(pane);
    });

    // expose for scenario wizards ("Open in builder")
    TB.app = { activateTab: activate };

    var startTab = uiState.activeTab;
    var valid = TABS.some(function (t) { return t.id === startTab; });
    activate(valid ? startTab : 'stl');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
