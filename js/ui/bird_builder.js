/* TRex Profile & Config Builder - BIRD routing config tab.
 * BGP/OSPF/RIP protocol blocks and generated static-route tables for routed
 * DUT tests, plus the veth-node + set_config console runbook. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  function defaultModel() {
    return {
      kind: 'bird',
      schemaVersion: 1,
      trexVersion: TB.settings.get().defaults.trexVersion,
      meta: { name: 'my_bird', description: '', modified: '' },
      routerId: '100.100.100.100',
      bgp: [{ name: 'my_bgp1', localIp: '1.1.1.3', localAs: 65000, neighborIp: '1.1.1.1', neighborAs: 65000, ipv6: false }],
      ospf: { enabled: false, area: 0 },
      rip: { enabled: false },
      staticRoutes: [],
      node: { port: 0, mac: '00:00:00:01:00:07', ipv4: '1.1.1.3', ipv4Subnet: 24,
              ipv6Enabled: false, ipv6: null, ipv6Subnet: 124 },
      trexDir: '/opt/trex/v3.06'
    };
  }

  TB.ui.birdBuilder = {
    mount: function (container) {
      var el = TB.ui.el;
      var field = TB.ui.field;
      var model = defaultModel();
      var regenTimer = null;

      var topbar = el('div', { class: 'builder-topbar' });
      var wrap = el('div', { class: 'settings-wrap' });
      var body = el('div', {});
      var out = el('div', {});
      container.appendChild(topbar);
      container.appendChild(wrap);
      wrap.appendChild(body);
      wrap.appendChild(out);

      function regen() {
        if (regenTimer) { clearTimeout(regenTimer); }
        regenTimer = setTimeout(function () {
          var gen = TB.gen.resolve(model.trexVersion, 'bird');
          if (!gen) {
            out.innerHTML = '';
            out.appendChild(el('div', { class: 'output-empty',
              text: 'No BIRD generator registered for TRex v' + model.trexVersion + '.' }));
            return;
          }
          TB.ui.output.render(out, { result: gen(model), model: model });
        }, 120);
      }

      function renderTopbar() {
        topbar.innerHTML = '';
        topbar.appendChild(field({ label: 'Config name', tip: TB.help.bird.name, type: 'text',
          value: model.meta.name, width: '160px',
          onChange: function (v) { model.meta.name = v || 'bird'; regen(); } }));
        topbar.appendChild(field({ label: 'TRex version', tip: TB.help.stl.trexVersion, type: 'select', value: model.trexVersion,
          options: TB.gen.versions().map(function (v) { return { value: v, label: 'v' + v }; }),
          onChange: function (v) { model.trexVersion = v; regen(); } }));

        var actions = el('div', { class: 'topbar-actions' });
        actions.appendChild(el('button', { class: 'btn', text: 'New',
          onclick: function () {
            if (!confirm('Start a new BIRD config? Unsaved changes are lost.')) { return; }
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
        TB.persist.listProfiles('bird').forEach(function (m) {
          savedSel.appendChild(el('option', { value: m.meta.name, text: m.meta.name }));
        });
        actions.appendChild(savedSel);
        actions.appendChild(el('button', { class: 'btn', text: 'Load',
          onclick: function () {
            if (!savedSel.value) { return; }
            var m = TB.persist.getProfile('bird', savedSel.value);
            if (!m) { TB.ui.toast('Config not found', 'err'); return; }
            if (m.kind !== 'bird') { TB.ui.toast('Not a BIRD model (kind=' + m.kind + ')', 'err'); return; }
            model = TB.util.deepClone(m);
            renderAll();
          } }));
        actions.appendChild(el('button', { class: 'btn btn-secondary', text: 'Delete',
          onclick: function () {
            if (!savedSel.value || !confirm('Delete saved config "' + savedSel.value + '"?')) { return; }
            TB.persist.deleteProfile('bird', savedSel.value);
            renderTopbar();
          } }));
        topbar.appendChild(actions);
      }

      function generalSection() {
        var box = el('div', {});
        var n = model.node;
        var r1 = el('div', { class: 'field-row' });
        r1.appendChild(field({ label: 'Router id', tip: TB.help.bird.routerId, type: 'text',
          value: model.routerId, width: '130px',
          validate: function (v) { return TB.util.isIpv4(v) ? null : 'dotted-quad form required'; },
          onChange: function (v) { model.routerId = v || ''; regen(); } }));
        r1.appendChild(field({ label: 'TRex dir (for the runbook)', tip: TB.help.settings.trexDir, type: 'text',
          value: model.trexDir, width: '150px',
          onChange: function (v) { model.trexDir = v || '/opt/trex/v3.06'; regen(); } }));
        box.appendChild(r1);
        var r2 = el('div', { class: 'field-row' });
        r2.appendChild(field({ label: 'Node port', tip: TB.help.bird.nodePort, type: 'int', value: n.port, width: '60px',
          onChange: function (v) { n.port = v === null ? 0 : v; regen(); } }));
        r2.appendChild(field({ label: 'Node MAC', tip: TB.help.bird.nodeMac, type: 'text', value: n.mac, width: '150px',
          validate: function (v) { return TB.util.isMac(v) ? null : 'invalid MAC'; },
          onChange: function (v) { n.mac = v || ''; regen(); } }));
        r2.appendChild(field({ label: 'Node IPv4', tip: TB.help.bird.nodeIp, type: 'text', value: n.ipv4, width: '110px',
          validate: function (v) { return TB.util.isIpv4(v) ? null : 'invalid IPv4'; },
          onChange: function (v) { n.ipv4 = v || ''; regen(); } }));
        r2.appendChild(field({ label: '/subnet', tip: TB.help.bird.nodeSubnet, type: 'int', value: n.ipv4Subnet, width: '55px',
          onChange: function (v) { n.ipv4Subnet = v === null ? 24 : v; regen(); } }));
        r2.appendChild(field({ label: 'IPv6', tip: TB.help.bird.nodeIpv6, type: 'checkbox', value: n.ipv6Enabled,
          onChange: function (v) { n.ipv6Enabled = v; renderBody(); regen(); } }));
        if (n.ipv6Enabled) {
          r2.appendChild(field({ label: 'Node IPv6', tip: TB.help.bird.nodeIpv6, type: 'text', value: n.ipv6, width: '160px',
            validate: function (v) { return TB.util.isIpv6(v) ? null : 'invalid IPv6'; },
            onChange: function (v) { n.ipv6 = v; regen(); } }));
          r2.appendChild(field({ label: '/subnet', tip: TB.help.bird.nodeSubnet, type: 'int', value: n.ipv6Subnet, width: '55px',
            onChange: function (v) { n.ipv6Subnet = v === null ? 124 : v; regen(); } }));
        }
        box.appendChild(r2);
        return box;
      }

      function bgpSection() {
        var box = el('div', {});
        (model.bgp || []).forEach(function (b, i) {
          var r = el('div', { class: 'vm-var-row' });
          r.appendChild(field({ label: 'Name', tip: TB.help.bird.bgpName, type: 'text', value: b.name, width: '90px',
            onChange: function (v) { b.name = v || ''; regen(); } }));
          r.appendChild(field({ label: 'AF', tip: TB.help.bird.bgpAf, type: 'select', value: b.ipv6 ? 'ipv6' : 'ipv4',
            options: [{ value: 'ipv4' }, { value: 'ipv6' }],
            onChange: function (v) { b.ipv6 = v === 'ipv6'; regen(); } }));
          r.appendChild(field({ label: 'Local IP', tip: TB.help.bird.bgpLocal, type: 'text', value: b.localIp, width: '110px',
            onChange: function (v) { b.localIp = v || ''; regen(); } }));
          r.appendChild(field({ label: 'Local AS', tip: TB.help.bird.bgpAs, type: 'int', value: b.localAs, width: '70px',
            onChange: function (v) { b.localAs = v; regen(); } }));
          r.appendChild(field({ label: 'Neighbor IP (DUT)', tip: TB.help.bird.bgpNeighbor, type: 'text', value: b.neighborIp, width: '110px',
            onChange: function (v) { b.neighborIp = v || ''; regen(); } }));
          r.appendChild(field({ label: 'Neighbor AS', tip: TB.help.bird.bgpAs, type: 'int', value: b.neighborAs, width: '70px',
            onChange: function (v) { b.neighborAs = v; regen(); } }));
          r.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
            onclick: function () { model.bgp.splice(i, 1); renderBody(); regen(); } }));
          box.appendChild(r);
        });
        box.appendChild(el('button', { class: 'btn btn-small', text: '+ Add BGP instance',
          onclick: function () {
            var n = model.bgp.length + 1;
            model.bgp.push({ name: 'my_bgp' + n, localIp: '1.1.' + n + '.3', localAs: 65000,
                             neighborIp: '1.1.' + n + '.1', neighborAs: 65000, ipv6: false });
            renderBody(); regen();
          } }));
        return box;
      }

      function igpSection() {
        var box = el('div', {});
        var r = el('div', { class: 'field-row' });
        r.appendChild(field({ label: 'OSPF (all interfaces, broadcast)', tip: TB.help.bird.ospf, type: 'checkbox',
          value: model.ospf.enabled,
          onChange: function (v) { model.ospf.enabled = v; renderBody(); regen(); } }));
        if (model.ospf.enabled) {
          r.appendChild(field({ label: 'Area', tip: TB.help.bird.ospfArea, type: 'int', value: model.ospf.area, width: '60px',
            onChange: function (v) { model.ospf.area = v === null ? 0 : v; regen(); } }));
        }
        r.appendChild(field({ label: 'RIP (all interfaces, multicast)', tip: TB.help.bird.rip, type: 'checkbox',
          value: model.rip.enabled,
          onChange: function (v) { model.rip.enabled = v; regen(); } }));
        box.appendChild(r);
        return box;
      }

      function routesSection() {
        var box = el('div', {});
        (model.staticRoutes || []).forEach(function (rt, i) {
          var r = el('div', { class: 'vm-var-row' });
          r.appendChild(field({ label: 'AF', tip: TB.help.bird.routeAf, type: 'select', value: rt.ipv6 ? 'ipv6' : 'ipv4',
            options: [{ value: 'ipv4' }, { value: 'ipv6' }],
            onChange: function (v) { rt.ipv6 = v === 'ipv6'; renderBody(); regen(); } }));
          r.appendChild(field({ label: 'First prefix', tip: TB.help.bird.routePrefix, type: 'text', value: rt.prefix, width: '130px',
            onChange: function (v) { rt.prefix = v || ''; regen(); } }));
          r.appendChild(field({ label: '/len', tip: TB.help.bird.routeLen, type: 'int', value: rt.prefixLen, width: '55px',
            onChange: function (v) { rt.prefixLen = v; regen(); } }));
          if (!rt.ipv6) {
            r.appendChild(field({ label: 'Count', tip: TB.help.bird.routeCount, type: 'int', value: rt.count, width: '75px',
              onChange: function (v) { rt.count = v; regen(); } }));
          }
          r.appendChild(field({ label: 'Next hop', tip: TB.help.bird.routeNextHop, type: 'text', value: rt.nextHop, width: '130px',
            onChange: function (v) { rt.nextHop = v || ''; regen(); } }));
          r.appendChild(el('button', { class: 'btn btn-small btn-danger', text: '✕',
            onclick: function () { model.staticRoutes.splice(i, 1); renderBody(); regen(); } }));
          box.appendChild(r);
        });
        box.appendChild(el('button', { class: 'btn btn-small', text: '+ Add route block',
          onclick: function () {
            model.staticRoutes.push({ ipv6: false, prefix: '42.42.42.0', prefixLen: 32, count: 10, nextHop: '1.1.1.3' });
            renderBody(); regen();
          } }));
        return box;
      }

      function renderBody() {
        body.innerHTML = '';
        body.appendChild(TB.ui.section('General (router id + bird veth node)', generalSection(), true, TB.help.bird._sections.general));
        body.appendChild(TB.ui.section('BGP instances (one session per DUT peering)', bgpSection(),
          !!(model.bgp && model.bgp.length), TB.help.bird._sections.bgp));
        body.appendChild(TB.ui.section('IGPs (OSPF / RIP)', igpSection(),
          model.ospf.enabled || model.rip.enabled, TB.help.bird._sections.igp));
        body.appendChild(TB.ui.section('Static routes (generated tables to advertise)', routesSection(),
          !!(model.staticRoutes && model.staticRoutes.length), TB.help.bird._sections.routes));
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
