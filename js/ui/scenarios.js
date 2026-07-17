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
        if (res.model) {
          var bar = el('div', { class: 'output-actions' });
          bar.appendChild(el('button', {
            class: 'btn', text: 'Open in ' + (res.model.kind === 'stl' ? 'STL' : 'ASTF') + ' builder',
            onclick: function () { openInBuilder(res.model); }
          }));
          box.appendChild(bar);
        }
        var out = el('div', {});
        box.appendChild(out);
        TB.ui.output.render(out, { result: { files: res.files, warnings: res.warnings },
          model: res.model, validateKind: res.model ? res.model.kind : null });
      }

      /* ================= Wizard C: connectivity check ================= */
      (function () {
        var o = {
          name: 'conn_check', ping0Dst: '48.0.0.1', ping1Dst: '16.0.0.1', pingCount: 5,
          withLatency: true, latPps: 100, srcIp: '16.0.0.1', dstIp: '48.0.0.1',
          durationSec: 30, cores: 2
        };
        var body = el('div', {});
        var resBox = resultBox();

        function render() {
          body.innerHTML = '';
          body.appendChild(el('div', { class: 'info-note',
            text: 'Not a load test: proves ARP resolution, ICMP routing in both directions and (optionally) ' +
                  'data-plane forwarding with latency numbers - run this before any traffic scenario.' }));

          var r1 = el('div', { class: 'field-row' });
          r1.appendChild(field({ label: 'Name', type: 'text', value: o.name, width: '120px',
            onChange: function (v) { o.name = v || 'conn_check'; } }));
          r1.appendChild(field({ label: 'Port 0 pings', tip: TB.help.scenarios.pingDst, type: 'text', value: o.ping0Dst, width: '110px',
            validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
            onChange: function (v) { o.ping0Dst = v || ''; } }));
          r1.appendChild(field({ label: 'Port 1 pings', tip: TB.help.scenarios.pingDst, type: 'text', value: o.ping1Dst, width: '110px',
            validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
            onChange: function (v) { o.ping1Dst = v || ''; } }));
          r1.appendChild(field({ label: 'Pings (-n)', type: 'int', value: o.pingCount, width: '60px',
            onChange: function (v) { o.pingCount = v === null ? 5 : v; } }));
          r1.appendChild(field({ label: 'Cores (-c)', type: 'int', value: o.cores, width: '60px',
            onChange: function (v) { o.cores = v === null ? 2 : v; } }));
          body.appendChild(r1);

          var r2 = el('div', { class: 'field-row' });
          r2.appendChild(field({ label: 'Add latency probe profile', tip: TB.help.scenarios.latencyProbe,
            type: 'checkbox', value: o.withLatency,
            onChange: function (v) { o.withLatency = v; render(); } }));
          if (o.withLatency) {
            r2.appendChild(field({ label: 'Probe src IP', type: 'text', value: o.srcIp, width: '110px',
              validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
              onChange: function (v) { o.srcIp = v || ''; } }));
            r2.appendChild(field({ label: 'Probe dst IP', type: 'text', value: o.dstIp, width: '110px',
              validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
              onChange: function (v) { o.dstIp = v || ''; } }));
            r2.appendChild(field({ label: 'Probe pps', tip: TB.help.scenarios.probePps, type: 'float', value: o.latPps, width: '80px',
              onChange: function (v) { o.latPps = v === null ? 100 : v; } }));
            r2.appendChild(field({ label: 'Duration (-d, sec)', type: 'int', value: o.durationSec, width: '80px',
              onChange: function (v) { o.durationSec = v === null ? 30 : v; } }));
          }
          body.appendChild(r2);

          body.appendChild(el('button', { class: 'btn btn-generate', text: 'Generate bundle',
            onclick: function () {
              o.trexVersion = TB.settings.get().defaults.trexVersion;
              showResult(resBox, TB.scenarios.buildConnCheck(TB.util.deepClone(o)));
            } }));
          body.appendChild(resBox);
        }
        render();
        wrap.appendChild(TB.ui.section('Scenario: connectivity check — prove routing before load', body, true, TB.help.scenarios._sections.connCheck));
      })();

      /* ================= Wizard A: two-server send/receive ================= */
      (function () {
        var o = {
          mode: 'astf', name: 'two_server', senderHost: 'trex-a', receiverHost: 'trex-b',
          clientStart: '16.0.0.1', clientEnd: '16.0.0.255',
          serverStart: '48.0.0.1', serverEnd: '48.0.255.255',
          traffic: 'http', pcapFile: '../avl/delay_10_http_browsing_0.pcap',
          rate: 100, cores: 4, mult: 1, durationSec: 60, rampupSec: null, addLatency: false,
          bidirectional: false
        };
        var body = el('div', {});
        var resBox = resultBox();

        function render() {
          body.innerHTML = '';
          var r1 = el('div', { class: 'field-row' });
          r1.appendChild(field({ label: 'Mechanism', tip: TB.help.scenarios.mechanismTwoServer, type: 'select', value: o.mode,
            options: [
              { value: 'astf', label: 'ASTF client/server split (recommended)' },
              { value: 'stl', label: 'STL unidirectional (TX + raw RX counters)' }
            ],
            onChange: function (v) { o.mode = v; render(); } }));
          r1.appendChild(field({ label: 'Profile name', type: 'text', value: o.name, width: '130px',
            onChange: function (v) { o.name = v || 'two_server'; } }));
          body.appendChild(r1);

          var r2 = el('div', { class: 'field-row' });
          r2.appendChild(field({ label: 'Sender box (client side)', tip: TB.help.scenarios.senderHost, type: 'text', value: o.senderHost, width: '130px',
            onChange: function (v) { o.senderHost = v || ''; } }));
          r2.appendChild(field({ label: 'Receiver box (server side)', tip: TB.help.scenarios.receiverHost, type: 'text', value: o.receiverHost, width: '130px',
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
            r4.appendChild(field({ label: 'cps (at -m 1)', tip: TB.help.astf.cps, type: 'float', value: o.rate, width: '80px',
              onChange: function (v) { o.rate = v === null ? 1 : v; } }));
            r4.appendChild(field({ label: 'rampup_sec (opt.)', tip: TB.help.astf.rampupSec, type: 'int', value: o.rampupSec, width: '90px',
              onChange: function (v) { o.rampupSec = v; } }));
            r4.appendChild(field({ label: 'Bidirectional (both boxes client + server)', tip: TB.help.scenarios.bidirectional,
              type: 'checkbox', value: o.bidirectional,
              onChange: function (v) { o.bidirectional = v; } }));
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
        wrap.appendChild(TB.ui.section('Scenario: two servers — one sends, one receives', body, true, TB.help.scenarios._sections.twoServer));
      })();

      /* ================= Wizard B: connection ramp ================= */
      (function () {
        var o = {
          engine: 'astf', name: 'ramp', stagesText: '100, 500, 1000', stageSec: 30,
          mechanism: 'm_step', traffic: 'http', pcapFile: '../avl/delay_10_http_browsing_0.pcap'
        };
        var body = el('div', {});
        var resBox = resultBox();

        function parseStages() {
          return o.stagesText.split(',')
            .map(function (s) { return parseFloat(s.trim()); })
            .filter(function (x) { return !isNaN(x); });
        }

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
          r2.appendChild(field({ label: 'Stage rates (' + unit + ', comma-separated, increasing)',
            tip: TB.help.scenarios.rampStages, type: 'text', value: o.stagesText, width: '240px',
            validate: function (v) {
              var st = String(v || '').split(',').map(function (s) { return parseFloat(s.trim()); });
              if (st.length < 2 || st.some(isNaN)) { return 'need 2+ numbers'; }
              for (var i = 1; i < st.length; i++) { if (!(st[i] > st[i - 1])) { return 'must increase'; } }
              return null;
            },
            onChange: function (v) { o.stagesText = v || ''; } }));
          r2.appendChild(field({ label: 'Stage duration (sec)', tip: TB.help.scenarios.stageSec, type: 'int', value: o.stageSec, width: '80px',
            onChange: function (v) { o.stageSec = v === null ? 0 : v; } }));
          body.appendChild(r2);

          var r3 = el('div', { class: 'field-row' });
          if (o.engine === 'astf') {
            r3.appendChild(field({ label: 'Mechanism', tip: TB.help.scenarios.rampMechanism, type: 'select', value: o.mechanism,
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
              var args = TB.util.deepClone(o);
              args.stages = parseStages();
              showResult(resBox, TB.scenarios.buildRamp(args));
            } }));
          body.appendChild(resBox);
        }
        render();
        wrap.appendChild(TB.ui.section('Scenario: connection ramp — N increasing stages', body, true, TB.help.scenarios._sections.ramp));
      })();

      /* ================= Wizard D: NDR benchmark ================= */
      (function () {
        var o = {
          engine: 'stl', name: 'ndr_bench', profileMode: 'generate', profilePath: 'stl/imix.py',
          rate: 1000, frameSize: 64, ports: '0 1', pdr: 0.1, pdrError: 1,
          allowedError: 1, lowMult: 1, highMult: 100, latencyPps: null,
          iterTime: 20, maxIterations: 10, qFull: 2, biDir: false,
          maxLatency: null, latTolerance: null, outputJson: true, cores: 4
        };
        var body = el('div', {});
        var resBox = resultBox();

        function render() {
          body.innerHTML = '';
          var r1 = el('div', { class: 'field-row' });
          r1.appendChild(field({ label: 'Engine', tip: TB.help.scenarios.ndrEngine, type: 'select', value: o.engine,
            options: [
              { value: 'stl', label: 'STL - NDR in % of line rate' },
              { value: 'astf', label: 'ASTF - NDR as a -m multiplier' }
            ],
            onChange: function (v) { o.engine = v; render(); } }));
          r1.appendChild(field({ label: 'Name', type: 'text', value: o.name, width: '110px',
            onChange: function (v) { o.name = v || 'ndr_bench'; } }));
          r1.appendChild(field({ label: 'Profile', type: 'select', value: o.profileMode,
            options: [
              { value: 'generate', label: 'generate a simple profile' },
              { value: 'path', label: 'use an existing profile on the box' }
            ],
            onChange: function (v) { o.profileMode = v; render(); } }));
          if (o.profileMode === 'path') {
            r1.appendChild(field({ label: 'Profile path', type: 'text', value: o.profilePath, width: '180px',
              onChange: function (v) { o.profilePath = v || ''; } }));
          } else {
            r1.appendChild(field({ label: o.engine === 'stl' ? 'pps (shape only)' : 'cps at -m 1',
              tip: TB.help.scenarios.ndrRate, type: 'float', value: o.rate, width: '90px',
              onChange: function (v) { o.rate = v === null ? 1000 : v; } }));
            if (o.engine === 'stl') {
              r1.appendChild(field({ label: 'Frame size', type: 'int', value: o.frameSize, width: '70px',
                onChange: function (v) { o.frameSize = v === null ? 64 : v; } }));
            }
          }
          r1.appendChild(field({ label: 'Cores (-c)', type: 'int', value: o.cores, width: '60px',
            onChange: function (v) { o.cores = v === null ? 4 : v; } }));
          body.appendChild(r1);

          var r2 = el('div', { class: 'field-row' });
          if (o.engine === 'stl') {
            r2.appendChild(field({ label: 'Ports (even list)', tip: TB.help.scenarios.ndrPorts, type: 'text', value: o.ports, width: '80px',
              onChange: function (v) { o.ports = v || '0 1'; } }));
            r2.appendChild(field({ label: 'PDR % drops (0 = NDR)', tip: TB.help.scenarios.ndrPdr, type: 'float', value: o.pdr, width: '80px',
              onChange: function (v) { o.pdr = v === null ? 0.1 : v; } }));
            r2.appendChild(field({ label: 'Error % (-e)', type: 'float', value: o.pdrError, width: '70px',
              onChange: function (v) { o.pdrError = v === null ? 1 : v; } }));
            r2.appendChild(field({ label: 'Bi-directional', type: 'checkbox', value: o.biDir,
              onChange: function (v) { o.biDir = v; } }));
          } else {
            r2.appendChild(field({ label: 'Low mult', tip: TB.help.scenarios.ndrMults, type: 'int', value: o.lowMult, width: '70px',
              onChange: function (v) { o.lowMult = v === null ? 1 : v; } }));
            r2.appendChild(field({ label: 'High mult', tip: TB.help.scenarios.ndrMults, type: 'int', value: o.highMult, width: '70px',
              onChange: function (v) { o.highMult = v === null ? 100 : v; } }));
            r2.appendChild(field({ label: 'Allowed error % (-e)', type: 'float', value: o.allowedError, width: '80px',
              onChange: function (v) { o.allowedError = v === null ? 1 : v; } }));
            r2.appendChild(field({ label: 'Latency pps (opt.)', type: 'int', value: o.latencyPps, width: '90px',
              onChange: function (v) { o.latencyPps = v; } }));
          }
          r2.appendChild(field({ label: 'Iter time (-t)', type: 'float', value: o.iterTime, width: '70px',
            onChange: function (v) { o.iterTime = v === null ? 20 : v; } }));
          r2.appendChild(field({ label: 'Max iters (-x)', type: 'int', value: o.maxIterations, width: '70px',
            onChange: function (v) { o.maxIterations = v === null ? 10 : v; } }));
          r2.appendChild(field({ label: 'q-full % (-q)', tip: TB.help.scenarios.ndrQfull, type: 'float', value: o.qFull, width: '70px',
            onChange: function (v) { o.qFull = v === null ? 2 : v; } }));
          body.appendChild(r2);

          var r3 = el('div', { class: 'field-row' });
          r3.appendChild(field({ label: 'Max latency µs (opt. gate)', tip: TB.help.scenarios.ndrLatGate, type: 'int', value: o.maxLatency, width: '90px',
            onChange: function (v) { o.maxLatency = v; render(); } }));
          if (o.maxLatency) {
            r3.appendChild(field({ label: 'Lat tolerance %', tip: TB.help.scenarios.ndrLatGate, type: 'float', value: o.latTolerance, width: '80px',
              onChange: function (v) { o.latTolerance = v; } }));
          }
          r3.appendChild(field({ label: 'Write JSON results (-o)', type: 'checkbox', value: o.outputJson,
            onChange: function (v) { o.outputJson = v; } }));
          body.appendChild(r3);

          body.appendChild(el('button', { class: 'btn btn-generate', text: 'Generate bundle',
            onclick: function () {
              o.trexVersion = TB.settings.get().defaults.trexVersion;
              showResult(resBox, TB.scenarios.buildNdr(TB.util.deepClone(o)));
            } }));
          body.appendChild(resBox);
        }
        render();
        wrap.appendChild(TB.ui.section('Scenario: NDR benchmark — find the no-drop rate (./ndr)', body, true, TB.help.scenarios._sections.ndr));
      })();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
