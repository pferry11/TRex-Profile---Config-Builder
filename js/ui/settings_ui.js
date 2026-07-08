/* TRex Profile & Config Builder - Settings tab: app defaults + the server
 * registry (PCI interfaces, cores, port MACs/IPs, NUMA platform, memory).
 * Changes save to localStorage immediately; the Platform Config tab and the
 * CLI builder read from this registry. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  var PCI_RE = /^([0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-9a-fA-F]$/;

  function defaultServer(n) {
    return {
      id: TB.util.uid('srv'),
      name: 'trex-' + n,
      mgmtHost: '',
      trexDir: '/opt/trex/v3.06',
      cores: 4,
      portLimit: 2,
      portBandwidthGb: 10,
      interfaces: ['03:00.0', '03:00.1'],
      ports: [
        { mode: 'ip', srcMac: '', destMac: '', ip: '1.1.1.1', defaultGw: '2.2.2.2' },
        { mode: 'ip', srcMac: '', destMac: '', ip: '2.2.2.2', defaultGw: '1.1.1.1' }
      ],
      platform: { enabled: false, masterThreadId: 0, latencyThreadId: 5, dualIf: [{ socket: 0, threads: [1, 2, 3, 4, 6, 7] }] },
      memory: { enabled: false, dpFlows: null },
      limitMemory: null, prefix: null, enableZmqPub: null, telnetPort: null
    };
  }

  TB.ui.settingsUi = {
    defaultServer: defaultServer,

    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;
      var settings = TB.settings.get();

      var wrap = el('div', { class: 'settings-wrap' });
      container.appendChild(wrap);

      function save() {
        var r = TB.settings.save(settings);
        if (!r.ok) { TB.ui.toast(r.error, 'err'); }
      }

      function render() {
        wrap.innerHTML = '';

        /* ---- defaults ---- */
        var defBody = el('div', { class: 'field-row' });
        defBody.appendChild(field({ label: 'Default TRex version', tip: TB.help.settings.trexVersion, type: 'select',
          value: settings.defaults.trexVersion,
          options: TB.gen.versions().map(function (v) { return { value: v, label: 'v' + v }; }),
          onChange: function (v) { settings.defaults.trexVersion = v; save(); } }));
        defBody.appendChild(field({ label: 'Pcap directory on the TRex box', tip: TB.help.settings.pcapDir, type: 'text',
          value: settings.defaults.pcapDir, width: '250px',
          onChange: function (v) { settings.defaults.pcapDir = v || ''; save(); } }));
        defBody.appendChild(field({ label: 'Active server', tip: TB.help.settings.activeServer, type: 'select',
          value: settings.defaults.activeServerId || '',
          options: [{ value: '', label: '(none)' }].concat(settings.servers.map(function (s) {
            return { value: s.id, label: s.name };
          })),
          onChange: function (v) { settings.defaults.activeServerId = v || null; save(); } }));
        wrap.appendChild(TB.ui.section('Defaults', defBody, true));

        /* ---- servers ---- */
        settings.servers.forEach(function (srv, idx) {
          wrap.appendChild(TB.ui.section('Server: ' + srv.name, serverEditor(srv, idx), false));
        });
        wrap.appendChild(el('button', { class: 'btn btn-generate', text: '+ Add server',
          onclick: function () {
            settings.servers.push(defaultServer(settings.servers.length + 1));
            save(); render();
          } }));
      }

      function serverEditor(srv, idx) {
        var box = el('div', {});

        var r1 = el('div', { class: 'field-row' });
        r1.appendChild(field({ label: 'Name', tip: TB.help.settings.name, type: 'text', value: srv.name, width: '120px',
          onChange: function (v) { srv.name = v || 'server'; save(); } }));
        r1.appendChild(field({ label: 'Mgmt host/IP', tip: TB.help.settings.mgmtHost, type: 'text', value: srv.mgmtHost, width: '130px',
          onChange: function (v) { srv.mgmtHost = v || ''; save(); } }));
        r1.appendChild(field({ label: 'TRex dir', tip: TB.help.settings.trexDir, type: 'text', value: srv.trexDir, width: '160px',
          onChange: function (v) { srv.trexDir = v || ''; save(); } }));
        r1.appendChild(field({ label: 'Cores (c)', tip: TB.help.settings.cores, type: 'int', value: srv.cores, width: '60px',
          onChange: function (v) { srv.cores = v; save(); } }));
        r1.appendChild(field({ label: 'Port limit', tip: TB.help.settings.portLimit, type: 'int', value: srv.portLimit, width: '60px',
          onChange: function (v) { srv.portLimit = v; save(); } }));
        r1.appendChild(field({ label: 'Bandwidth (Gb)', tip: TB.help.settings.bandwidth, type: 'int', value: srv.portBandwidthGb, width: '70px',
          hint: '1 for VM, 10/40 for NICs',
          onChange: function (v) { srv.portBandwidthGb = v; save(); } }));
        box.appendChild(r1);

        /* interfaces */
        var ifBox = el('div', { class: 'field-row' });
        ifBox.appendChild(el('span', { class: 'field-label range-label', text: 'PCI interfaces' }));
        srv.interfaces.forEach(function (pci, i) {
          ifBox.appendChild(field({ label: 'port ' + i, type: 'text', value: pci, width: '110px',
            placeholder: '03:00.0',
            validate: function (v) { return PCI_RE.test(v) ? null : 'expect hh:hh.h'; },
            onChange: function (v) { srv.interfaces[i] = v || ''; save(); } }));
        });
        ifBox.appendChild(el('button', { class: 'btn btn-small', text: '+',
          title: 'add interface',
          onclick: function () { srv.interfaces.push(''); save(); render(); } }));
        ifBox.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '−',
          title: 'remove last interface',
          onclick: function () { srv.interfaces.pop(); save(); render(); } }));
        ifBox.appendChild(el('span', { class: 'field-hint', text: 'find with ./dpdk_setup_ports.py -s' }));
        box.appendChild(ifBox);

        /* ports */
        srv.ports.forEach(function (port, i) {
          var pr = el('div', { class: 'field-row' });
          pr.appendChild(el('span', { class: 'field-label range-label', text: 'port ' + i }));
          pr.appendChild(field({ label: 'mode', tip: TB.help.settings.portMode, type: 'select', value: port.mode,
            options: [{ value: 'ip', label: 'IP / gateway' }, { value: 'mac', label: 'MAC pair' }],
            onChange: function (v) { port.mode = v; save(); render(); } }));
          if (port.mode === 'ip') {
            pr.appendChild(field({ label: 'ip', type: 'text', value: port.ip, width: '110px',
              validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
              onChange: function (v) { port.ip = v || ''; save(); } }));
            pr.appendChild(field({ label: 'default_gw', type: 'text', value: port.defaultGw, width: '110px',
              validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
              onChange: function (v) { port.defaultGw = v || ''; save(); } }));
          } else {
            pr.appendChild(field({ label: 'src_mac', type: 'text', value: port.srcMac, width: '140px',
              placeholder: 'aa:bb:cc:dd:ee:ff',
              validate: function (v) { return TB.util.isMac(v) ? null : 'invalid MAC'; },
              onChange: function (v) { port.srcMac = v || ''; save(); } }));
            pr.appendChild(field({ label: 'dest_mac', type: 'text', value: port.destMac, width: '140px',
              placeholder: 'aa:bb:cc:dd:ee:ff',
              validate: function (v) { return TB.util.isMac(v) ? null : 'invalid MAC'; },
              onChange: function (v) { port.destMac = v || ''; save(); } }));
          }
          box.appendChild(pr);
        });
        var pBtns = el('div', { class: 'field-row' });
        pBtns.appendChild(el('button', { class: 'btn btn-small', text: '+ Add port',
          onclick: function () {
            srv.ports.push({ mode: 'ip', srcMac: '', destMac: '', ip: '', defaultGw: '' });
            save(); render();
          } }));
        pBtns.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '− Remove last port',
          onclick: function () { srv.ports.pop(); save(); render(); } }));
        box.appendChild(pBtns);

        /* platform */
        var plat = srv.platform;
        var platRow = el('div', { class: 'field-row' });
        platRow.appendChild(field({ label: 'Platform block (NUMA thread pinning)', tip: TB.help.settings.platform, type: 'checkbox',
          value: plat.enabled,
          onChange: function (v) { plat.enabled = v; save(); render(); } }));
        if (plat.enabled) {
          platRow.appendChild(field({ label: 'master_thread_id', type: 'int', value: plat.masterThreadId, width: '60px',
            onChange: function (v) { plat.masterThreadId = v === null ? 0 : v; save(); } }));
          platRow.appendChild(field({ label: 'latency_thread_id', type: 'int', value: plat.latencyThreadId, width: '60px',
            onChange: function (v) { plat.latencyThreadId = v === null ? 0 : v; save(); } }));
        }
        box.appendChild(platRow);
        if (plat.enabled) {
          plat.dualIf.forEach(function (d, i) {
            var dr = el('div', { class: 'field-row' });
            dr.appendChild(el('span', { class: 'field-label range-label', text: 'dual_if ' + i }));
            dr.appendChild(field({ label: 'socket', type: 'int', value: d.socket, width: '55px',
              onChange: function (v) { d.socket = v === null ? 0 : v; save(); } }));
            dr.appendChild(field({ label: 'threads (comma sep)', type: 'text',
              value: (d.threads || []).join(','), width: '170px',
              onChange: function (v) {
                d.threads = (v || '').split(',').map(function (x) { return parseInt(x.trim(), 10); })
                  .filter(function (x) { return !isNaN(x); });
                save();
              } }));
            dr.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
              onclick: function () { plat.dualIf.splice(i, 1); save(); render(); } }));
            box.appendChild(dr);
          });
          box.appendChild(el('button', { class: 'btn btn-small', text: '+ Add dual_if (socket)',
            onclick: function () {
              plat.dualIf.push({ socket: plat.dualIf.length, threads: [] });
              save(); render();
            } }));
        }

        /* memory + misc */
        var mRow = el('div', { class: 'field-row' });
        mRow.appendChild(field({ label: 'Memory block', tip: TB.help.settings.memory, type: 'checkbox', value: srv.memory.enabled,
          onChange: function (v) { srv.memory.enabled = v; save(); render(); } }));
        if (srv.memory.enabled) {
          mRow.appendChild(field({ label: 'dp_flows', tip: TB.help.settings.memory, type: 'int', value: srv.memory.dpFlows, width: '100px',
            hint: 'e.g. 10048576 for many flows',
            onChange: function (v) { srv.memory.dpFlows = v; save(); } }));
        }
        mRow.appendChild(field({ label: 'limit_memory (MB)', tip: TB.help.settings.limitMemory, type: 'int', value: srv.limitMemory, width: '80px',
          onChange: function (v) { srv.limitMemory = v; save(); } }));
        mRow.appendChild(field({ label: 'prefix (multi-instance)', tip: TB.help.settings.prefix, type: 'text', value: srv.prefix, width: '90px',
          onChange: function (v) { srv.prefix = v; save(); } }));
        mRow.appendChild(field({ label: 'ZMQ pub', tip: TB.help.settings.zmqPub, type: 'checkbox', value: srv.enableZmqPub === true,
          onChange: function (v) { srv.enableZmqPub = v ? true : null; save(); } }));
        mRow.appendChild(field({ label: 'telnet_port', tip: TB.help.settings.telnetPort, type: 'int', value: srv.telnetPort, width: '70px',
          onChange: function (v) { srv.telnetPort = v; save(); } }));
        box.appendChild(mRow);

        /* server actions */
        var act = el('div', { class: 'field-row' });
        act.appendChild(el('button', { class: 'btn btn-small', text: '⧉ Duplicate server',
          onclick: function () {
            var copy = TB.util.deepClone(srv);
            copy.id = TB.util.uid('srv');
            copy.name = srv.name + '_copy';
            settings.servers.splice(idx + 1, 0, copy);
            save(); render();
          } }));
        act.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕ Delete server',
          onclick: function () {
            if (!confirm('Delete server "' + srv.name + '"?')) { return; }
            settings.servers.splice(idx, 1);
            if (settings.defaults.activeServerId === srv.id) { settings.defaults.activeServerId = null; }
            save(); render();
          } }));
        box.appendChild(act);

        return box;
      }

      render();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
