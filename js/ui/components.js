/* TRex Profile & Config Builder - small DOM/form component library. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  /* ---------- tooltip popup ----------
   * One fixed-position bubble shared by every .tip-icon, driven by delegated
   * hover events so dynamically-rendered icons work with no wiring. Replaces the
   * old per-icon ::after: a pseudo-element inside a scrolling pane contributes
   * to that pane's scroll width even when hidden, which put a horizontal
   * scrollbar on every builder pane. Fixed + clamped also keeps a tip readable
   * next to the right edge instead of clipping it. */
  var tipPop = null;
  function showTip(icon) {
    var text = icon.getAttribute('data-tip');
    if (!text) { return; }
    if (!tipPop) {
      tipPop = document.createElement('div');
      tipPop.id = 'tip-pop';
      document.body.appendChild(tipPop);
    }
    tipPop.textContent = text;
    tipPop.className = 'show';
    /* measure after it is laid out, then clamp inside the viewport */
    tipPop.style.left = '0px';
    tipPop.style.top = '0px';
    var r = icon.getBoundingClientRect();
    var w = tipPop.offsetWidth;
    var h = tipPop.offsetHeight;
    var left = Math.max(6, Math.min(r.left, window.innerWidth - w - 8));
    var top = r.bottom + 6;
    if (top + h > window.innerHeight - 6) { top = Math.max(6, r.top - h - 6); }
    tipPop.style.left = left + 'px';
    tipPop.style.top = top + 'px';
  }
  function hideTip() { if (tipPop) { tipPop.className = ''; } }
  if (typeof document !== 'undefined') {
    document.addEventListener('mouseover', function (e) {
      var icon = e.target && e.target.closest ? e.target.closest('.tip-icon') : null;
      if (icon) { showTip(icon); }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target && e.target.closest && e.target.closest('.tip-icon')) { hideTip(); }
    });
    // a tip anchored to a scrolled-away icon would float; drop it instead
    document.addEventListener('scroll', hideTip, true);
  }

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
      if (opts.datalist) { input.setAttribute('list', opts.datalist); }
      input.addEventListener('input', handle);
    }
    if (opts.width) { input.style.width = opts.width; }
    if (opts.disabled) { input.disabled = true; }

    var labelEl = el('span', { class: 'field-label', text: opts.label || '' });
    if (opts.tip) {
      labelEl.appendChild(el('span', { class: 'tip-icon', text: 'ⓘ', 'data-tip': opts.tip }));
      input.title = opts.tip;
    }
    var wrap = el('label', { class: 'field' + (opts.type === 'checkbox' ? ' field-check' : '') }, [
      labelEl,
      input,
      opts.hint ? el('span', { class: 'field-hint', text: opts.hint }) : null,
      err
    ]);
    wrap.input = input;
    return wrap;
  };

  /* Undo/redo buttons bound to a TB.history instance. Create ONCE per builder
   * mount and re-append on topbar re-renders (appendChild moves the node), so
   * the single onChange subscription stays valid. restore(model) receives a
   * fresh clone to swap in and re-render. */
  TB.ui.historyControls = function (hist, restore) {
    var el = TB.ui.el;
    function apply(m) { if (m) { restore(m); } }
    var undoBtn = el('button', { class: 'btn btn-small btn-secondary', text: '↶ Undo',
      title: 'Undo the last edit', onclick: function () { apply(hist.undo()); } });
    var redoBtn = el('button', { class: 'btn btn-small btn-secondary', text: '↷ Redo',
      title: 'Redo', onclick: function () { apply(hist.redo()); } });
    function update() {
      undoBtn.disabled = !hist.canUndo();
      redoBtn.disabled = !hist.canRedo();
    }
    hist.onChange(update);
    update();
    return el('span', { class: 'history-controls' }, [undoBtn, redoBtn]);
  };

  TB.ui.section = function (title, body, open, tip) {
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
    }, [caret, el('span', { text: title }),
        tip ? el('span', { class: 'tip-icon', text: 'ⓘ', 'data-tip': tip,
          onclick: function (e) { e.stopPropagation(); } }) : null]);
    return el('div', { class: 'section' }, [head, content]);
  };

  // Shared <datalist> of well-known v3.06 avl/ pcaps for path fields.
  var AVL_PCAPS = [
    '../avl/delay_10_http_browsing_0.pcap',
    '../avl/delay_10_http_get_0.pcap',
    '../avl/delay_10_http_post_0.pcap',
    '../avl/delay_10_https_0.pcap',
    '../avl/delay_10_exchange_0.pcap',
    '../avl/delay_10_oracle_0.pcap',
    '../avl/delay_10_citrix_0.pcap',
    '../avl/delay_10_smtp_0.pcap',
    '../avl/delay_10_mail_pop_0.pcap',
    '../avl/delay_10_sip_0.pcap',
    '../avl/delay_dns_0.pcap'
  ];

  var CAP2_PCAPS = [
    'cap2/dns.pcap',
    'cap2/http_get.pcap',
    'cap2/http_post.pcap',
    'cap2/https.pcap',
    'cap2/exchange.pcap',
    'cap2/smtp.pcap',
    'cap2/mail_pop.pcap',
    'cap2/oracle.pcap',
    'cap2/citrix.pcap',
    'cap2/rtsp_short.pcap'
  ];

  TB.ui.ensureDatalist = function (id, values) {
    if (document.getElementById(id)) { return; }
    var dl = TB.ui.el('datalist', { id: id });
    values.forEach(function (p) { dl.appendChild(TB.ui.el('option', { value: p })); });
    document.body.appendChild(dl);
  };

  TB.ui.ensurePcapDatalist = function () {
    TB.ui.ensureDatalist('avl-pcaps', AVL_PCAPS);
  };

  TB.ui.ensureCap2Datalist = function () {
    TB.ui.ensureDatalist('cap2-pcaps', CAP2_PCAPS.concat(AVL_PCAPS.map(function (p) { return p.replace('../', ''); })));
  };

  /* Simple modal; returns { close } */
  TB.ui.modal = function (title, bodyEl) {
    var el = TB.ui.el;
    var overlay = el('div', { class: 'modal-overlay' });
    function close() {
      if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
    }
    var box = el('div', { class: 'modal-box' }, [
      el('div', { class: 'modal-head' }, [
        el('span', { text: title }),
        el('button', { class: 'btn btn-small', text: '✕', onclick: close })
      ]),
      el('div', { class: 'modal-body' }, [bodyEl])
    ]);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { close(); } });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return { close: close };
  };

  /* "Browse…" button for pcap path fields; only rendered when the Flask
   * backend is up. onPick receives (dir, file). */
  TB.ui.pcapBrowseButton = function (defaultDir, onPick) {
    var el = TB.ui.el;
    if (!TB.backend || !TB.backend.available) { return null; }
    return el('button', { class: 'btn btn-small', text: 'Browse…',
      title: 'list pcaps under ' + (TB.backend.trexDir || 'the TRex dir'),
      onclick: function () {
        var body = el('div', {});
        var listBox = el('div', { class: 'browse-list' });
        var dirInput = el('input', { type: 'text', value: defaultDir || 'avl' });
        var modal;

        function load() {
          listBox.innerHTML = '';
          listBox.appendChild(el('div', { class: 'field-hint', text: 'loading…' }));
          TB.backend.listPcaps(dirInput.value).then(function (data) {
            listBox.innerHTML = '';
            if (!data.files.length) {
              listBox.appendChild(el('div', { class: 'field-hint', text: 'no .pcap/.cap files in ' + data.dir }));
              return;
            }
            data.files.forEach(function (f) {
              listBox.appendChild(el('div', { class: 'browse-item', text: f,
                onclick: function () { onPick(data.dir, f); modal.close(); } }));
            });
          }).catch(function (e) {
            listBox.innerHTML = '';
            listBox.appendChild(el('div', { class: 'field-error', text: e.message }));
          });
        }

        var bar = el('div', { class: 'field-row' }, [
          el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'directory under TRex dir' }), dirInput]),
          el('button', { class: 'btn btn-small', text: 'Load', onclick: load })
        ]);
        ['avl', 'cap2'].forEach(function (d) {
          bar.appendChild(el('button', { class: 'btn btn-small btn-secondary', text: d,
            onclick: function () { dirInput.value = d; load(); } }));
        });
        body.appendChild(bar);
        body.appendChild(listBox);
        modal = TB.ui.modal('Browse pcaps on ' + (TB.backend.trexDir || 'the TRex box'), body);
        load();
      } });
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
