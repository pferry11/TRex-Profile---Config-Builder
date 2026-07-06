/* TRex Profile & Config Builder - Scenarios tab: two guided wizards over
 * TB.scenarios (js/gen/scenarios.js). Each wizard emits profile + RUNBOOK.txt
 * and can hand its model to the STL/ASTF builder for further editing. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  TB.ui.scenarios = {
    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;

      TB.ui.ensurePcapDatalist();
      var wrap = el('div', { class: 'scenarios-wrap' });
      container.appendChild(wrap);

      function openInBuilder(model) {
        var tab = model.kind === 'stl' ? 'stl' : 'astf';
        var builder = model.kind === 'stl' ? TB.ui.stlBuilder : TB.ui.astfBuilder;
        TB.app.activateTab(tab);
        if (builder._loadExternal) {
          builder._loadExternal(TB.util.deepClone(model));
          TB.ui.toast('Scenario model opened in the ' + tab.toUpperCase() + ' builder', 'ok');
        }
      }

      function resultBox() {
        return el('div', { class: 'scenario-result' });
      }

      function showResult(box, res) {
        box.innerHTML = '';
        if (!res.ok) {
          box.appendChild(el('div', { class: 'warn-banner' }, [
            el('strong', { text: 'Fix these first' }),
            el('ul', {}, res.errors.map(function (e) { return el('li', { text: e }); }))
          ]));
          return;
        }
        var bar = el('div', { class: 'output-actions' });
        bar.appendChild(el('button', {
          class: 'btn', text: 'Open in ' + (res.model.kind === 'stl' ? 'STL' : 'ASTF') + ' builder',
          onclick: function () { openInBuilder(res.model); }
        }));
        box.appendChild(bar);
        var out = el('div', {});
        box.appendChild(out);
        TB.ui.output.render(out, { result: { files: res.files, warnings: res.warnings },
          model: res.model, validateKind: res.model.kind });
      }

      /* ================= Wizard A: two-server send/receive ================= */
      (function () {
        var o = {
          mode: 'astf', name: 'two_server', senderHost: 'trex-a', receiverHost: 'trex-b',
          clientStart: '16.0.0.1', clientEnd: '16.0.0.255',
          serverStart: '48.0.0.1', serverEnd: '48.0.255.255',
          traffic: 'http', pcapFile: '../avl/delay_10_http_browsing_0.pcap',
          rate: 100, cores: 4, mult: 1, durationSec: 60, rampupSec: null, addLatency: false
        };
        var body = el('div', {});
        var resBox = resultBox();

        function render() {
          body.innerHTML = '';
          var r1 = el('div', { class: 'field-row' });
          r1.appendChild(field({ label: 'Mechanism', type: 'select', value: o.mode,
            options: [
              { value: 'astf', label: 'ASTF client/server split (recommended)' },
              { value: 'stl', label: 'STL unidirectional (TX + raw RX counters)' }
            ],
            onChange: function (v) { o.mode = v; render(); } }));
          r1.appendChild(field({ label: 'Profile name', type: 'text', value: o.name, width: '130px',
            onChange: function (v) { o.name = v || 'two_server'; } }));
          body.appendChild(r1);

          var r2 = el('div', { class: 'field-row' });
          r2.appendChild(field({ label: 'Sender box (client side)', type: 'text', value: o.senderHost, width: '130px',
            onChange: function (v) { o.senderHost = v || ''; } }));
          r2.appendChild(field({ label: 'Receiver box (server side)', type: 'text', value: o.receiverHost, width: '130px',
            onChange: function (v) { o.receiverHost = v || ''; } }));
          r2.appendChild(field({ label: 'Cores (-c)', type: 'int', value: o.cores, width: '60px',
            onChange: function (v) { o.cores = v === null ? 4 : v; } }));
          body.appendChild(r2);

          var r3 = el('div', { class: 'field-row' });
          [['clientStart', 'Client range start'], ['clientEnd', 'Client range end'],
           ['serverStart', 'Server range start'], ['serverEnd', 'Server range end']].forEach(function (p) {
            r3.appendChild(field({ label: p[1], type: 'text', value: o[p[0]], width: '110px',
              validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
              onChange: function (v) { o[p[0]] = v || ''; } }));
          });
          body.appendChild(r3);

          var r4 = el('div', { class: 'field-row' });
          if (o.mode === 'astf') {
            r4.appendChild(field({ label: 'Traffic', type: 'select', value: o.traffic,
              options: [{ value: 'http', label: 'HTTP-like program preset' }, { value: 'pcap', label: 'pcap replay' }],
              onChange: function (v) { o.traffic = v; render(); } }));
            if (o.traffic === 'pcap') {
              r4.appendChild(field({ label: 'Pcap file', type: 'text', value: o.pcapFile, width: '250px',
                datalist: 'avl-pcaps',
                onChange: function (v) { o.pcapFile = v || ''; } }));
            }
            r4.appendChild(field({ label: 'cps (at -m 1)', type: 'float', value: o.rate, width: '80px',
              onChange: function (v) { o.rate = v === null ? 1 : v; } }));
            r4.appendChild(field({ label: 'rampup_sec (opt.)', type: 'int', value: o.rampupSec, width: '90px',
              onChange: function (v) { o.rampupSec = v; } }));
          } else {
            r4.appendChild(field({ label: 'pps', type: 'float', value: o.rate, width: '90px',
              onChange: function (v) { o.rate = v === null ? 1 : v; } }));
            r4.appendChild(field({ label: 'Add latency stream', type: 'checkbox', value: o.addLatency,
              onChange: function (v) { o.addLatency = v; } }));
          }
          r4.appendChild(field({ label: 'Multiplier (-m)', type: 'float', value: o.mult, width: '70px',
            onChange: function (v) { o.mult = v === null ? 1 : v; } }));
          r4.appendChild(field({ label: 'Duration (-d, sec)', type: 'int', value: o.durationSec, width: '80px',
            onChange: function (v) { o.durationSec = v === null ? 60 : v; } }));
          body.appendChild(r4);

          body.appendChild(el('button', { class: 'btn btn-generate', text: 'Generate bundle',
            onclick: function () {
              o.trexVersion = TB.settings.get().defaults.trexVersion;
              showResult(resBox, TB.scenarios.buildTwoServer(TB.util.deepClone(o)));
            } }));
          body.appendChild(resBox);
        }
        render();
        wrap.appendChild(TB.ui.section('Scenario: two servers — one sends, one receives', body, true));
      })();

      /* ================= Wizard B: connection ramp ================= */
      (function () {
        var o = {
          engine: 'astf', name: 'ramp', low: 100, mid: 500, high: 1000, stageSec: 30,
          mechanism: 'm_step', traffic: 'http', pcapFile: '../avl/delay_10_http_browsing_0.pcap'
        };
        var body = el('div', {});
        var resBox = resultBox();

        function render() {
          body.innerHTML = '';
          var r1 = el('div', { class: 'field-row' });
          r1.appendChild(field({ label: 'Engine', type: 'select', value: o.engine,
            options: [
              { value: 'astf', label: 'ASTF - connections per second (recommended)' },
              { value: 'stl', label: 'STL - packets per second' }
            ],
            onChange: function (v) { o.engine = v; render(); } }));
          r1.appendChild(field({ label: 'Profile name', type: 'text', value: o.name, width: '110px',
            onChange: function (v) { o.name = v || 'ramp'; } }));
          body.appendChild(r1);

          var unit = o.engine === 'astf' ? 'cps' : 'pps';
          var r2 = el('div', { class: 'field-row' });
          r2.appendChild(field({ label: 'Low (' + unit + ')', type: 'float', value: o.low, width: '80px',
            onChange: function (v) { o.low = v === null ? 0 : v; } }));
          r2.appendChild(field({ label: 'Mid (' + unit + ')', type: 'float', value: o.mid, width: '80px',
            onChange: function (v) { o.mid = v === null ? 0 : v; } }));
          r2.appendChild(field({ label: 'High (' + unit + ')', type: 'float', value: o.high, width: '80px',
            onChange: function (v) { o.high = v === null ? 0 : v; } }));
          r2.appendChild(field({ label: 'Stage duration (sec)', type: 'int', value: o.stageSec, width: '80px',
            onChange: function (v) { o.stageSec = v === null ? 0 : v; } }));
          body.appendChild(r2);

          var r3 = el('div', { class: 'field-row' });
          if (o.engine === 'astf') {
            r3.appendChild(field({ label: 'Mechanism', type: 'select', value: o.mechanism,
              options: [
                { value: 'm_step', label: '-m stepping runbook - discrete plateaus (default)' },
                { value: 'rampup', label: 'scheduler.rampup_sec - smooth linear ramp' },
                { value: 'weighted', label: 'weighted multi-template mix (approximation)' }
              ],
              onChange: function (v) { o.mechanism = v; render(); } }));
            r3.appendChild(field({ label: 'Traffic', type: 'select', value: o.traffic,
              options: [{ value: 'http', label: 'HTTP-like program preset' }, { value: 'pcap', label: 'pcap replay' }],
              onChange: function (v) { o.traffic = v; render(); } }));
            if (o.traffic === 'pcap') {
              r3.appendChild(field({ label: 'Pcap file', type: 'text', value: o.pcapFile, width: '250px',
                datalist: 'avl-pcaps',
                onChange: function (v) { o.pcapFile = v || ''; } }));
            }
          } else {
            r3.appendChild(el('div', { class: 'info-note',
              text: 'STL uses three continuous streams with staggered start delays (isg): exact low/mid/high plateaus in one profile.' }));
          }
          body.appendChild(r3);

          body.appendChild(el('button', { class: 'btn btn-generate', text: 'Generate bundle',
            onclick: function () {
              o.trexVersion = TB.settings.get().defaults.trexVersion;
              showResult(resBox, TB.scenarios.buildRamp(TB.util.deepClone(o)));
            } }));
          body.appendChild(resBox);
        }
        render();
        wrap.appendChild(TB.ui.section('Scenario: connection ramp — low → mid → high', body, true));
      })();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
