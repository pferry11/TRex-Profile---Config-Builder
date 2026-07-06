/* TRex Profile & Config Builder - output pane: warnings banner, file tabs,
 * highlighted code, and the three standard actions
 * (Copy / Download artifact / Download model). */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  TB.ui.output = {
    /* render(container, { result, model })
     * result: { files: [{name, language, content}], warnings: [] }
     * model:  the source model (for the "Download model" action). */
    render: function (container, opts) {
      var el = TB.ui.el;
      container.innerHTML = '';
      var result = opts.result;
      var model = opts.model;

      if (!result || !result.files || !result.files.length) {
        container.appendChild(el('div', { class: 'output-empty', text: 'Nothing to generate yet.' }));
        return;
      }

      if (result.warnings && result.warnings.length) {
        var list = el('ul', {}, result.warnings.map(function (w) {
          return el('li', { text: w });
        }));
        container.appendChild(el('div', { class: 'warn-banner' }, [
          el('strong', { text: 'Warnings' }), list
        ]));
      }

      var activeIdx = 0;
      var codeEl = el('pre', { class: 'code' });
      var tabsEl = el('div', { class: 'file-tabs' });
      var actionsEl = el('div', { class: 'output-actions' });

      function modelFileName() {
        var name = (model && model.meta && model.meta.name) ? model.meta.name : 'model';
        return name.replace(/[^\w.-]+/g, '_') + '.trexb.json';
      }

      function renderActive() {
        var f = result.files[activeIdx];
        codeEl.innerHTML = TB.ui.highlight(f.content, f.language);

        Array.prototype.forEach.call(tabsEl.children, function (t, i) {
          t.classList.toggle('active', i === activeIdx);
        });

        actionsEl.innerHTML = '';
        actionsEl.appendChild(el('button', {
          class: 'btn',
          text: 'Copy',
          onclick: function () {
            TB.util.copyText(f.content).then(function (ok) {
              TB.ui.toast(ok ? 'Copied ' + f.name + ' to clipboard' : 'Copy failed - select the text and copy manually', ok ? 'ok' : 'err');
            });
          }
        }));
        actionsEl.appendChild(el('button', {
          class: 'btn',
          text: 'Download ' + f.name,
          onclick: function () { TB.util.downloadText(f.name, f.content); }
        }));
        if (model) {
          actionsEl.appendChild(el('button', {
            class: 'btn btn-secondary',
            text: 'Download model',
            title: 'Save the re-editable JSON model (' + modelFileName() + ')',
            onclick: function () { TB.util.downloadText(modelFileName(), JSON.stringify(model, null, 2)); }
          }));
        }
      }

      if (result.files.length > 1) {
        result.files.forEach(function (f, i) {
          tabsEl.appendChild(el('button', {
            class: 'file-tab',
            text: f.name,
            onclick: function () { activeIdx = i; renderActive(); }
          }));
        });
        container.appendChild(tabsEl);
      }

      container.appendChild(actionsEl);
      container.appendChild(codeEl);
      renderActive();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
