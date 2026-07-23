/* TRex Profile & Config Builder - TRex-EMU profile builder tab.
 * Client emulation: namespaces (vport/VLAN), a client block (MAC/IP bases that
 * increment per client) and the EMU plugins (ARP, ICMP, IGMP, IPv6 ND,
 * DHCPv4/v6, DNS, mDNS). Output: the EMU Python profile + launch runbook. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  function defaultModel() {
    return {
      kind: 'emu',
      schemaVersion: 1,
      trexVersion: TB.settings.get().defaults.trexVersion,
      meta: { name: 'my_emu_profile', description: '', modified: '' },
      nsCount: 1,
      vlan: { enabled: false, tci: 1 },
      trexDir: '/opt/trex/v3.06',
      clients: { count: 15, mac: '00:00:00:70:00:01',
                 ipv4Enabled: true, ipv4: '1.1.2.3', dg: '1.1.2.1',
                 ipv6Enabled: false, ipv6: '2001:DB8:1::2' },
      plugins: {
        arp: { enabled: true, timer: null },
        icmp: { enabled: true },
        igmp: { enabled: false, dmac: null },
        ipv6nd: { enabled: false, dmac: null },
        dhcpv4: { enabled: false, discoverClassId: null, requestClassId: null },
        dhcpv6: { enabled: false },
        dns: { enabled: false, mode: 'client', serverIp: '1.1.2.1', records: [] },
        mdns: { enabled: false, hostPattern: 'client-{}.emu', ttl: 240, domainName: null }
      }
    };
  }

  /* One-click plugin combos mirroring the shipped emu/simple_*.py examples. */
  var PRESETS = [
    { label: 'ARP + ICMP', title: 'simple_emu.py / simple_icmp.py: pingable clients',
      apply: function (m) {
        m.plugins.arp.enabled = true; m.plugins.icmp.enabled = true;
        m.clients.ipv4Enabled = true;
      } },
    { label: 'DHCPv4 clients', title: 'simple_dhcp.py: clients start at 0.0.0.0 and lease addresses',
      apply: function (m) {
        m.plugins.arp.enabled = true; m.plugins.icmp.enabled = true;
        m.plugins.dhcpv4.enabled = true; m.clients.ipv4Enabled = false;
      } },
    { label: 'IPv6 ND + DHCPv6', title: 'simple_dhcpv6.py: IPv6 neighbour discovery + DHCPv6 lease',
      apply: function (m) {
        m.plugins.ipv6nd.enabled = true; m.plugins.dhcpv6.enabled = true;
        m.clients.ipv6Enabled = true;
      } },
    { label: 'IGMP', title: 'simple_igmp.py: multicast group membership',
      apply: function (m) {
        m.plugins.arp.enabled = true; m.plugins.icmp.enabled = true;
        m.plugins.igmp.enabled = true; m.clients.ipv4Enabled = true;
      } },
    { label: 'DNS resolver', title: 'simple_dns.py client side: clients query a name server',
      apply: function (m) {
        m.plugins.arp.enabled = true; m.plugins.icmp.enabled = true;
        m.plugins.dns.enabled = true; m.plugins.dns.mode = 'client';
        m.clients.ipv4Enabled = true;
      } },
    { label: 'DNS name server', title: 'simple_dns.py server side: serve A/AAAA/TXT/PTR records',
      apply: function (m) {
        m.plugins.arp.enabled = true; m.plugins.icmp.enabled = true;
        m.plugins.dns.enabled = true; m.plugins.dns.mode = 'server';
        if (!m.plugins.dns.records.length) {
          m.plugins.dns.records = [
            { domain: 'trex-tgn.cisco.com', type: 'A', answer: '173.36.109.208' },
            { domain: 'cisco.com', type: 'A', answer: '72.163.4.185' },
            { domain: 'cisco.com', type: 'AAAA', answer: '2001:420:1101:1::185' }
          ];
        }
        m.clients.ipv4Enabled = true;
      } },
    { label: 'mDNS', title: 'simple_mdns.py: multicast DNS host announcements',
      apply: function (m) {
        m.plugins.arp.enabled = true; m.plugins.icmp.enabled = true;
        m.plugins.mdns.enabled = true; m.plugins.ipv6nd.enabled = true;
        m.clients.ipv4Enabled = true; m.clients.ipv6Enabled = true;
      } }
  ];

  TB.ui.emuBuilder = {
    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;
      var model = defaultModel();
      var history = TB.history.create();
      var histCtl = TB.ui.historyControls(history, function (m) { model = m; renderAll(); });
      var regenTimer = null;

      var topbar = el('div', { class: 'builder-topbar' });
      var wrap = el('div', { class: 'settings-wrap' });
      var out = el('div', {});
      container.appendChild(topbar);
      container.appendChild(wrap);

      function regen() {
        if (regenTimer) { clearTimeout(regenTimer); }
        regenTimer = setTimeout(function () {
          history.record(model);
          var gen = TB.gen.resolve(model.trexVersion, 'emu');
          if (!gen) {
            out.innerHTML = '';
            out.appendChild(el('div', { class: 'output-empty',
              text: 'No EMU generator registered for TRex v' + model.trexVersion + '.' }));
            return;
          }
          TB.ui.output.render(out, { result: gen(model), model: model });
        }, 120);
      }

      function renderTopbar() {
        topbar.innerHTML = '';
        topbar.appendChild(field({ label: 'Profile name', tip: TB.help.emu.profileName, type: 'text',
          value: model.meta.name, width: '160px',
          onChange: function (v) { model.meta.name = v || 'emu_profile'; regen(); } }));
        topbar.appendChild(field({ label: 'TRex version', tip: TB.help.stl.trexVersion, type: 'select', value: model.trexVersion,
          options: TB.gen.versions().map(function (v) { return { value: v, label: 'v' + v }; }),
          onChange: function (v) { model.trexVersion = v; regen(); } }));

        var actions = el('div', { class: 'topbar-actions' });
        actions.appendChild(histCtl);
        actions.appendChild(el('button', { class: 'btn', text: 'New',
          onclick: function () {
            if (!confirm('Start a new profile? Unsaved changes are lost.')) { return; }
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
        savedSel.appendChild(el('option', { value: '', text: 'Saved profiles…' }));
        TB.persist.listProfiles('emu').forEach(function (m) {
          savedSel.appendChild(el('option', { value: m.meta.name, text: m.meta.name }));
        });
        actions.appendChild(savedSel);
        actions.appendChild(el('button', { class: 'btn', text: 'Load',
          onclick: function () {
            if (!savedSel.value) { return; }
            loadModel(TB.persist.getProfile('emu', savedSel.value));
          } }));
        actions.appendChild(el('button', { class: 'btn btn-secondary', text: 'Delete',
          onclick: function () {
            if (!savedSel.value || !confirm('Delete saved profile "' + savedSel.value + '"?')) { return; }
            TB.persist.deleteProfile('emu', savedSel.value);
            renderTopbar();
          } }));
        var fileInput = el('input', { type: 'file', accept: '.json' });
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', function () {
          var f = fileInput.files[0];
          if (!f) { return; }
          var reader = new FileReader();
          reader.onload = function () {
            try { loadModel(JSON.parse(reader.result)); }
            catch (e) { TB.ui.toast('Not valid JSON: ' + e.message, 'err'); }
          };
          reader.readAsText(f);
        });
        actions.appendChild(fileInput);
        actions.appendChild(el('button', { class: 'btn btn-secondary', text: 'Import model',
          onclick: function () { fileInput.click(); } }));
        topbar.appendChild(actions);
      }

      function loadModel(m) {
        if (!m) { TB.ui.toast('Profile not found', 'err'); return; }
        if (m.kind !== 'emu') { TB.ui.toast('Not an EMU model (kind=' + m.kind + ')', 'err'); return; }
        if (m.schemaVersion > 1) {
          TB.ui.toast('Model schemaVersion ' + m.schemaVersion + ' is newer than this app supports (1).', 'err');
          return;
        }
        model = TB.util.deepClone(m);
        renderAll();
      }

      function presetRow() {
        var row = el('div', { class: 'preset-row' });
        row.appendChild(el('span', { class: 'field-label', text: 'Presets:' }));
        PRESETS.forEach(function (pr) {
          row.appendChild(el('button', { class: 'btn btn-preset', text: pr.label, title: pr.title,
            onclick: function () { pr.apply(model); renderBody(); regen(); } }));
        });
        return row;
      }

      function nsSection() {
        var box = el('div', {});
        var r = el('div', { class: 'field-row' });
        r.appendChild(field({ label: 'Namespaces (--ns)', tip: TB.help.emu.nsCount, type: 'int',
          value: model.nsCount, width: '70px',
          onChange: function (v) { model.nsCount = v === null ? 1 : v; regen(); } }));
        r.appendChild(field({ label: '802.1Q VLAN per namespace', tip: TB.help.emu.vlan, type: 'checkbox',
          value: model.vlan.enabled,
          onChange: function (v) { model.vlan.enabled = v; renderBody(); regen(); } }));
        if (model.vlan.enabled) {
          r.appendChild(field({ label: 'First VLAN tag (tci)', tip: TB.help.emu.vlanTci, type: 'int',
            value: model.vlan.tci, width: '70px',
            onChange: function (v) { model.vlan.tci = v === null ? 1 : v; regen(); } }));
        }
        r.appendChild(field({ label: 'TRex dir (for the runbook)', tip: TB.help.settings.trexDir, type: 'text',
          value: model.trexDir, width: '150px',
          onChange: function (v) { model.trexDir = v || '/opt/trex/v3.06'; regen(); } }));
        box.appendChild(r);
        return box;
      }

      function clientsSection() {
        var c = model.clients;
        var box = el('div', {});
        var r1 = el('div', { class: 'field-row' });
        r1.appendChild(field({ label: 'Clients per namespace (--clients)', tip: TB.help.emu.clientCount, type: 'int',
          value: c.count, width: '80px',
          onChange: function (v) { c.count = v === null ? 15 : v; regen(); } }));
        r1.appendChild(field({ label: 'First client MAC', tip: TB.help.emu.clientMac, type: 'text',
          value: c.mac, width: '150px',
          validate: function (v) { return TB.util.isMac(v) ? null : 'invalid MAC'; },
          onChange: function (v) { c.mac = v || ''; regen(); } }));
        box.appendChild(r1);
        var r2 = el('div', { class: 'field-row' });
        r2.appendChild(field({ label: 'IPv4', tip: TB.help.emu.ipv4Enabled, type: 'checkbox', value: c.ipv4Enabled,
          onChange: function (v) { c.ipv4Enabled = v; renderBody(); regen(); } }));
        if (c.ipv4Enabled) {
          r2.appendChild(field({ label: 'First client IPv4', tip: TB.help.emu.ipv4, type: 'text', value: c.ipv4, width: '110px',
            validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
            onChange: function (v) { c.ipv4 = v || ''; regen(); } }));
          r2.appendChild(field({ label: 'Default gateway', tip: TB.help.emu.dg, type: 'text', value: c.dg, width: '110px',
            validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
            onChange: function (v) { c.dg = v || ''; regen(); } }));
        }
        r2.appendChild(field({ label: 'IPv6', tip: TB.help.emu.ipv6Enabled, type: 'checkbox', value: c.ipv6Enabled,
          onChange: function (v) { c.ipv6Enabled = v; renderBody(); regen(); } }));
        if (c.ipv6Enabled) {
          r2.appendChild(field({ label: 'First client IPv6', tip: TB.help.emu.ipv6, type: 'text', value: c.ipv6, width: '160px',
            validate: function (v) { return TB.util.isIpv6(v) ? null : 'invalid IPv6'; },
            onChange: function (v) { c.ipv6 = v || ''; regen(); } }));
        }
        box.appendChild(r2);
        return box;
      }

      function dnsRecordsEditor(dns) {
        var box = el('div', {});
        (dns.records || []).forEach(function (rec, i) {
          var r = el('div', { class: 'vm-var-row' });
          r.appendChild(field({ label: 'Domain', tip: TB.help.emu.dnsDomain, type: 'text', value: rec.domain, width: '160px',
            onChange: function (v) { rec.domain = v || ''; regen(); } }));
          r.appendChild(field({ label: 'Type', tip: TB.help.emu.dnsType, type: 'select', value: rec.type,
            options: [{ value: 'A' }, { value: 'AAAA' }, { value: 'TXT' }, { value: 'PTR' }],
            onChange: function (v) { rec.type = v; regen(); } }));
          r.appendChild(field({ label: 'Answer', tip: TB.help.emu.dnsAnswer, type: 'text', value: rec.answer, width: '190px',
            onChange: function (v) { rec.answer = v || ''; regen(); } }));
          r.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
            onclick: function () { dns.records.splice(i, 1); renderBody(); regen(); } }));
          box.appendChild(r);
        });
        box.appendChild(el('button', { class: 'btn btn-small', text: '+ Add record',
          onclick: function () {
            dns.records = dns.records || [];
            dns.records.push({ domain: 'example.com', type: 'A', answer: '1.2.3.4' });
            renderBody(); regen();
          } }));
        return box;
      }

      function pluginsSection() {
        var p = model.plugins;
        var box = el('div', {});

        var r1 = el('div', { class: 'field-row' });
        r1.appendChild(field({ label: 'ARP', tip: TB.help.emu.arp, type: 'checkbox', value: p.arp.enabled,
          onChange: function (v) { p.arp.enabled = v; renderBody(); regen(); } }));
        if (p.arp.enabled) {
          r1.appendChild(field({ label: 'ARP timer (s, optional)', tip: TB.help.emu.arpTimer, type: 'int',
            value: p.arp.timer, width: '80px',
            onChange: function (v) { p.arp.timer = v; regen(); } }));
        }
        r1.appendChild(field({ label: 'ICMP (answer pings)', tip: TB.help.emu.icmp, type: 'checkbox', value: p.icmp.enabled,
          onChange: function (v) { p.icmp.enabled = v; regen(); } }));
        r1.appendChild(field({ label: 'IGMP', tip: TB.help.emu.igmp, type: 'checkbox', value: p.igmp.enabled,
          onChange: function (v) { p.igmp.enabled = v; renderBody(); regen(); } }));
        if (p.igmp.enabled) {
          r1.appendChild(field({ label: 'IGMP dmac (router)', tip: TB.help.emu.igmpDmac, type: 'text',
            value: p.igmp.dmac, width: '150px', placeholder: model.clients.mac,
            onChange: function (v) { p.igmp.dmac = v; regen(); } }));
        }
        box.appendChild(r1);

        var r2 = el('div', { class: 'field-row' });
        r2.appendChild(field({ label: 'IPv6 ND', tip: TB.help.emu.ipv6nd, type: 'checkbox', value: p.ipv6nd.enabled,
          onChange: function (v) { p.ipv6nd.enabled = v; renderBody(); regen(); } }));
        if (p.ipv6nd.enabled) {
          r2.appendChild(field({ label: 'ND dmac (router)', tip: TB.help.emu.ipv6ndDmac, type: 'text',
            value: p.ipv6nd.dmac, width: '150px', placeholder: model.clients.mac,
            onChange: function (v) { p.ipv6nd.dmac = v; regen(); } }));
        }
        r2.appendChild(field({ label: 'DHCPv4', tip: TB.help.emu.dhcpv4, type: 'checkbox', value: p.dhcpv4.enabled,
          onChange: function (v) { p.dhcpv4.enabled = v; renderBody(); regen(); } }));
        if (p.dhcpv4.enabled) {
          r2.appendChild(field({ label: 'Discover class-id (opt.)', tip: TB.help.emu.dhcpClassId, type: 'text',
            value: p.dhcpv4.discoverClassId, width: '140px',
            onChange: function (v) { p.dhcpv4.discoverClassId = v; regen(); } }));
          r2.appendChild(field({ label: 'Request class-id (opt.)', tip: TB.help.emu.dhcpClassId, type: 'text',
            value: p.dhcpv4.requestClassId, width: '140px',
            onChange: function (v) { p.dhcpv4.requestClassId = v; regen(); } }));
        }
        r2.appendChild(field({ label: 'DHCPv6', tip: TB.help.emu.dhcpv6, type: 'checkbox', value: p.dhcpv6.enabled,
          onChange: function (v) { p.dhcpv6.enabled = v; regen(); } }));
        box.appendChild(r2);

        var r3 = el('div', { class: 'field-row' });
        r3.appendChild(field({ label: 'DNS', tip: TB.help.emu.dns, type: 'checkbox', value: p.dns.enabled,
          onChange: function (v) { p.dns.enabled = v; renderBody(); regen(); } }));
        if (p.dns.enabled) {
          r3.appendChild(field({ label: 'Role', tip: TB.help.emu.dnsMode, type: 'select', value: p.dns.mode,
            options: [{ value: 'client', label: 'resolver client' }, { value: 'server', label: 'name server' }],
            onChange: function (v) { p.dns.mode = v; renderBody(); regen(); } }));
          if (p.dns.mode === 'client') {
            r3.appendChild(field({ label: 'Name server IP', tip: TB.help.emu.dnsServerIp, type: 'text',
              value: p.dns.serverIp, width: '150px',
              onChange: function (v) { p.dns.serverIp = v || ''; regen(); } }));
          }
        }
        box.appendChild(r3);
        if (p.dns.enabled && p.dns.mode === 'server') {
          box.appendChild(TB.ui.section('DNS records (the database this name server answers from)',
            dnsRecordsEditor(p.dns), true, TB.help.emu._sections.dnsRecords));
        }

        var r4 = el('div', { class: 'field-row' });
        r4.appendChild(field({ label: 'mDNS', tip: TB.help.emu.mdns, type: 'checkbox', value: p.mdns.enabled,
          onChange: function (v) { p.mdns.enabled = v; renderBody(); regen(); } }));
        if (p.mdns.enabled) {
          r4.appendChild(field({ label: 'Host pattern ({} = client no.)', tip: TB.help.emu.mdnsHosts, type: 'text',
            value: p.mdns.hostPattern, width: '150px',
            onChange: function (v) { p.mdns.hostPattern = v || 'client-{}.emu'; regen(); } }));
          r4.appendChild(field({ label: 'TTL (s)', tip: TB.help.emu.mdnsTtl, type: 'int', value: p.mdns.ttl, width: '70px',
            onChange: function (v) { p.mdns.ttl = v; regen(); } }));
          r4.appendChild(field({ label: 'Domain name (opt.)', tip: TB.help.emu.mdnsDomain, type: 'text',
            value: p.mdns.domainName, width: '130px',
            onChange: function (v) { p.mdns.domainName = v; regen(); } }));
        }
        box.appendChild(r4);
        return box;
      }

      var body = el('div', {});
      function renderBody() {
        body.innerHTML = '';
        body.appendChild(presetRow());
        body.appendChild(TB.ui.section('Namespaces (one per vport)', nsSection(), true, TB.help.emu._sections.ns));
        body.appendChild(TB.ui.section('Clients (base values increment per client)', clientsSection(), true, TB.help.emu._sections.clients));
        body.appendChild(TB.ui.section('Plugins (per-protocol client behaviour)', pluginsSection(), true, TB.help.emu._sections.plugins));
      }

      function renderAll() {
        renderTopbar();
        renderBody();
        regen();
      }

      wrap.appendChild(body);
      wrap.appendChild(out);
      renderAll();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
