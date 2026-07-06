/* TRex Profile & Config Builder - small DOM/form component library. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  // el('div', {class:'x', text:'hi', onclick:fn, title:'...'}, [children])
  TB.ui.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) { continue; }
      var v = attrs[k];
      if (k === 'class') { node.className = v; }
      else if (k === 'text') { node.textContent = v; }
      else if (k === 'html') { node.innerHTML = v; }
      else if (k === 'value') { node.value = v; }
      else if (k === 'checked') { node.checked = !!v; }
      else if (k === 'disabled') { node.disabled = !!v; }
      else if (k.indexOf('on') === 0) { node.addEventListener(k.slice(2), v); }
      else { node.setAttribute(k, v); }
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) { return; }
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };

  /* field({label, type, value, onChange, options, hint, validate, placeholder, width})
   * type: text | int | float | select | checkbox | textarea
   * onChange receives the parsed value ('' -> null for text/int/float). */
  TB.ui.field = function (opts) {
    var el = TB.ui.el;
    var input;
    var err = el('div', { class: 'field-error' });

    function parse(raw) {
      if (opts.type === 'int') { return raw === '' ? null : parseInt(raw, 10); }
      if (opts.type === 'float') { return raw === '' ? null : parseFloat(raw); }
      if (opts.type === 'text' || opts.type === 'textarea') { return raw === '' ? null : raw; }
      return raw;
    }

    function handle() {
      var val = opts.type === 'checkbox' ? input.checked : parse(input.value);
      if (opts.validate && val !== null && val !== '' && opts.type !== 'checkbox') {
        var msg = opts.validate(val);
        err.textContent = msg || '';
        input.classList.toggle('invalid', !!msg);
        if (msg) { return; }
      } else {
        err.textContent = '';
        input.classList.remove('invalid');
      }
      if ((opts.type === 'int' || opts.type === 'float') && val !== null && isNaN(val)) { return; }
      opts.onChange(val);
    }

    if (opts.type === 'select') {
      input = el('select', {});
      (opts.options || []).forEach(function (o) {
        var opt = el('option', { value: o.value, text: o.label !== undefined ? o.label : o.value });
        input.appendChild(opt);
      });
      input.value = opts.value === null || opts.value === undefined ? '' : opts.value;
      input.addEventListener('change', handle);
    } else if (opts.type === 'checkbox') {
      input = el('input', { type: 'checkbox', checked: !!opts.value });
      input.addEventListener('change', handle);
    } else if (opts.type === 'textarea') {
      input = el('textarea', { value: opts.value === null || opts.value === undefined ? '' : opts.value, rows: opts.rows || 3 });
      input.addEventListener('input', handle);
    } else {
      input = el('input', {
        type: 'text',
        value: opts.value === null || opts.value === undefined ? '' : opts.value,
        placeholder: opts.placeholder || ''
      });
      input.addEventListener('input', handle);
    }
    if (opts.width) { input.style.width = opts.width; }
    if (opts.disabled) { input.disabled = true; }

    var wrap = el('label', { class: 'field' + (opts.type === 'checkbox' ? ' field-check' : '') }, [
      el('span', { class: 'field-label', text: opts.label || '' }),
      input,
      opts.hint ? el('span', { class: 'field-hint', text: opts.hint }) : null,
      err
    ]);
    wrap.input = input;
    return wrap;
  };

  TB.ui.section = function (title, body, open) {
    var el = TB.ui.el;
    var caret = el('span', { class: 'caret', text: open === false ? '▸' : '▾' });
    var content = el('div', { class: 'section-body' }, [body]);
    if (open === false) { content.style.display = 'none'; }
    var head = el('div', {
      class: 'section-head',
      onclick: function () {
        var vis = content.style.display !== 'none';
        content.style.display = vis ? 'none' : '';
        caret.textContent = vis ? '▸' : '▾';
      }
    }, [caret, el('span', { text: title })]);
    return el('div', { class: 'section' }, [head, content]);
  };

  var toastTimer = null;
  TB.ui.toast = function (msg, kind) {
    var node = document.getElementById('toast');
    if (!node) {
      node = TB.ui.el('div', { id: 'toast' });
      document.body.appendChild(node);
    }
    node.textContent = msg;
    node.className = 'show ' + (kind || 'info');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { node.className = ''; }, 3000);
  };
})(typeof window !== 'undefined' ? window : globalThis);
