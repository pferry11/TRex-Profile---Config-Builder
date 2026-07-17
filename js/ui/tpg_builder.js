/* TRex Profile & Config Builder - Tagged Packet Group (TPG) config tab.
 * Builds the tags JSON for tpg_enable (per-tag rx stats on Dot1Q/QinQ) plus
 * the console runbook. Tag id = entry index: QinQ pairs first, then the
 * Dot1Q ranges in order. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  function defaultModel() {
    return {
      kind: 'tpg',
      schemaVersion: 1,
      trexVersion: TB.settings.get().defaults.trexVersion,
      meta: { name: 'my_tpg', description: '', modified: '' },
      qinq: [],
      dot1q: [{ minVlan: 1, maxVlan: 10 }],
      numTpgids: 10,
      ports: '0 1'
    };
  }

  TB.ui.tpgBuilder = {
    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;
      var model = defaultModel();
      var history = TB.history.create();
      var histCtl = TB.ui.historyControls(history, function (m) { model = m; renderAll(); });
      var regenTimer = null;

      var topbar = el('div', { class: 'builder-topbar' });
      var wrap = el('div', { class: 'settings-wrap' });
      var body = el('div', {});
      var out = el('div', {});
      container.appendChild(topbar);
      container.appendChild(wrap);
      wrap.appendChild(body);
      wrap.appendChild(out);

      function tagCount() {
        var n = (model.qinq || []).length;
        (model.dot1q || []).forEach(function (d) {
          if (d.minVlan !== null && d.maxVlan !== null && d.minVlan <= d.maxVlan) {
            n += d.maxVlan - d.minVlan + 1;
          }
        });
        return n;
      }

      function regen() {
        if (regenTimer) { clearTimeout(regenTimer); }
        regenTimer = setTimeout(function () {
          history.record(model);
          var gen = TB.gen.resolve(model.trexVersion, 'tpg');
          if (!gen) {
            out.innerHTML = '';
            out.appendChild(el('div', { class: 'output-empty',
              text: 'No TPG generator registered for TRex v' + model.trexVersion + '.' }));
            return;
          }
          TB.ui.output.render(out, { result: gen(model), model: model });
        }, 120);
      }

      function renderTopbar() {
        topbar.innerHTML = '';
        topbar.appendChild(field({ label: 'Config name', tip: TB.help.tpg.name, type: 'text',
          value: model.meta.name, width: '160px',
          onChange: function (v) { model.meta.name = v || 'tpg'; regen(); } }));
        topbar.appendChild(field({ label: 'TRex version', tip: TB.help.stl.trexVersion, type: 'select', value: model.trexVersion,
          options: TB.gen.versions().map(function (v) { return { value: v, label: 'v' + v }; }),
          onChange: function (v) { model.trexVersion = v; regen(); } }));

        var actions = el('div', { class: 'topbar-actions' });
        actions.appendChild(histCtl);
        actions.appendChild(el('button', { class: 'btn', text: 'New',
          onclick: function () {
            if (!confirm('Start a new TPG config? Unsaved changes are lost.')) { return; }
            model = defaultModel(); renderAll();
          } }));
        actions.appendChild(el('button', { class: 'btn', text: 'Save',
          onclick: function () {
            model.meta.modified = new Date().toISOString();
            var r = TB.persist.saveProfile(TB.util.deepClone(model));
            TB.ui.toast(r.ok ? 'Saved "' + model.meta.name + '"' : r.error, r.ok ? 'ok' : 'err');
            renderTopbar();
          } }));
        var savedSel = el('select', { class: 'saved-select' });
        savedSel.appendChild(el('option', { value: '', text: 'Saved configs…' }));
        TB.persist.listProfiles('tpg').forEach(function (m) {
          savedSel.appendChild(el('option', { value: m.meta.name, text: m.meta.name }));
        });
        actions.appendChild(savedSel);
        actions.appendChild(el('button', { class: 'btn', text: 'Load',
          onclick: function () {
            if (!savedSel.value) { return; }
            var m = TB.persist.getProfile('tpg', savedSel.value);
            if (!m) { TB.ui.toast('Config not found', 'err'); return; }
            if (m.kind !== 'tpg') { TB.ui.toast('Not a TPG model (kind=' + m.kind + ')', 'err'); return; }
            model = TB.util.deepClone(m);
            renderAll();
          } }));
        actions.appendChild(el('button', { class: 'btn btn-secondary', text: 'Delete',
          onclick: function () {
            if (!savedSel.value || !confirm('Delete saved config "' + savedSel.value + '"?')) { return; }
            TB.persist.deleteProfile('tpg', savedSel.value);
            renderTopbar();
          } }));
        topbar.appendChild(actions);
      }

      function dot1qSection() {
        var box = el('div', {});
        (model.dot1q || []).forEach(function (d, i) {
          var r = el('div', { class: 'vm-var-row' });
          r.appendChild(field({ label: 'Min VLAN', tip: TB.help.tpg.minVlan, type: 'int', value: d.minVlan, width: '75px',
            onChange: function (v) { d.minVlan = v; renderBody(); regen(); } }));
          r.appendChild(field({ label: 'Max VLAN', tip: TB.help.tpg.maxVlan, type: 'int', value: d.maxVlan, width: '75px',
            onChange: function (v) { d.maxVlan = v; renderBody(); regen(); } }));
          var n = (d.minVlan !== null && d.maxVlan !== null && d.minVlan <= d.maxVlan)
            ? (d.maxVlan - d.minVlan + 1) : 0;
          r.appendChild(el('span', { class: 'field-hint', text: n + ' tag' + (n === 1 ? '' : 's') }));
          r.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
            onclick: function () { model.dot1q.splice(i, 1); renderBody(); regen(); } }));
          box.appendChild(r);
        });
        box.appendChild(el('button', { class: 'btn btn-small', text: '+ Add Dot1Q VLAN range',
          onclick: function () {
            model.dot1q.push({ minVlan: 1, maxVlan: 10 });
            renderBody(); regen();
          } }));
        return box;
      }

      function qinqSection() {
        var box = el('div', {});
        (model.qinq || []).forEach(function (q, i) {
          var r = el('div', { class: 'vm-var-row' });
          r.appendChild(field({ label: 'Inner VLAN', tip: TB.help.tpg.qinqInner, type: 'int', value: q.inner, width: '75px',
            onChange: function (v) { q.inner = v; regen(); } }));
          r.appendChild(field({ label: 'Outer VLAN', tip: TB.help.tpg.qinqOuter, type: 'int', value: q.outer, width: '75px',
            onChange: function (v) { q.outer = v; regen(); } }));
          r.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
            onclick: function () { model.qinq.splice(i, 1); renderBody(); regen(); } }));
          box.appendChild(r);
        });
        box.appendChild(el('button', { class: 'btn btn-small', text: '+ Add QinQ pair',
          onclick: function () {
            model.qinq.push({ inner: 1, outer: 100 });
            renderBody(); regen();
          } }));
        return box;
      }

      function enableSection() {
        var box = el('div', {});
        var r = el('div', { class: 'field-row' });
        r.appendChild(field({ label: 'num-tpgids (max tpgid + 1)', tip: TB.help.tpg.numTpgids, type: 'int',
          value: model.numTpgids, width: '90px',
          onChange: function (v) { model.numTpgids = v; regen(); } }));
        r.appendChild(field({ label: 'Ports (space separated)', tip: TB.help.tpg.ports, type: 'text',
          value: model.ports, width: '110px',
          validate: function (v) { return /^\d+(\s+\d+)*$/.test(v.trim()) ? null : 'expect e.g. "0 1"'; },
          onChange: function (v) { model.ports = v; regen(); } }));
        r.appendChild(el('span', { class: 'field-hint',
          text: tagCount() + ' tags total - tag id = index in the JSON (QinQ first, then Dot1Q in range order)' }));
        box.appendChild(r);
        return box;
      }

      function renderBody() {
        body.innerHTML = '';
        body.appendChild(TB.ui.section('Dot1Q VLAN ranges (one tag id per VLAN)', dot1qSection(), true, TB.help.tpg._sections.dot1q));
        body.appendChild(TB.ui.section('QinQ pairs (one tag id per inner/outer pair)', qinqSection(),
          !!(model.qinq && model.qinq.length), TB.help.tpg._sections.qinq));
        body.appendChild(TB.ui.section('tpg_enable parameters', enableSection(), true, TB.help.tpg._sections.enable));
      }

      function renderAll() {
        renderTopbar();
        renderBody();
        regen();
      }
      renderAll();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
