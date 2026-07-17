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

      /* plain-English summary of what the artifact does */
      var summary = (model && TB.gen.summary) ? TB.gen.summary(model) : [];
      if (summary.length) {
        var sumList = el('ul', { class: 'summary-list' }, summary.map(function (s) {
          return el('li', { text: s });
        }));
        container.appendChild(TB.ui.section('What this does', sumList, true));
      }

      var activeIdx = 0;
      var codeEl = el('pre', { class: 'code' });
      var tabsEl = el('div', { class: 'file-tabs' });
      var actionsEl = el('div', { class: 'output-actions' });
      var validateEl = el('div', { class: 'validate-area' });

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
        if (TB.zip && (result.files.length > 1 || model)) {
          var bundleBase = ((model && model.meta && model.meta.name) ? model.meta.name : 'trexb')
            .replace(/[^\w.-]+/g, '_');
          actionsEl.appendChild(el('button', {
            class: 'btn btn-secondary',
            text: 'Download bundle (.zip)',
            title: 'all generated files' + (model ? ' + the model JSON' : '') + ' in one zip',
            onclick: function () {
              var items = result.files.map(function (x) { return { name: x.name, content: x.content }; });
              if (model) { items.push({ name: modelFileName(), content: JSON.stringify(model, null, 2) }); }
              TB.util.downloadBinary(bundleBase + '_bundle.zip', TB.zip.build(items), 'application/zip');
              TB.ui.toast('Bundled ' + items.length + ' files into ' + bundleBase + '_bundle.zip', 'ok');
            }
          }));
        }

        /* server-side simulator validation (only with the Flask backend up) */
        if (opts.validateKind && TB.backend && TB.backend.available && /\.py$/.test(f.name)) {
          actionsEl.appendChild(el('button', {
            class: 'btn',
            text: 'Validate on server',
            title: 'run ' + opts.validateKind + '-sim against this profile on the server',
            onclick: function () {
              validateEl.innerHTML = '';
              validateEl.appendChild(el('div', { class: 'field-hint', text: 'running ' + opts.validateKind + '-sim…' }));
              TB.backend.validate(opts.validateKind, f.content).then(function (res) {
                validateEl.innerHTML = '';
                var ok = res.exitCode === 0;
                validateEl.appendChild(el('div', {
                  class: 'validate-result ' + (ok ? 'ok' : 'err'),
                  text: (ok ? 'PASS' : 'FAIL') + ' - exit code ' + res.exitCode + '  (' + res.command + ')'
                }));
                var out = (res.stdout || '') + (res.stderr ? '\n--- stderr ---\n' + res.stderr : '');
                if (out.trim()) {
                  validateEl.appendChild(el('pre', { class: 'code', text: out.trim() }));
                }
              }).catch(function (e) {
                validateEl.innerHTML = '';
                validateEl.appendChild(el('div', { class: 'validate-result err', text: 'Validation call failed: ' + e.message }));
              });
            }
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
      container.appendChild(validateEl);
      container.appendChild(codeEl);
      renderActive();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
