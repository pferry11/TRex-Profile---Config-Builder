/* TRex Profile & Config Builder - ASTF (advanced stateful) profile generator for TRex v3.06.
 *
 * Pure function: generate(model, opts) -> { files, warnings }
 * Supports pcap-list mode (ASTFCapInfo) and program mode (ASTFProgram +
 * client/server templates). Registered as TB.gen.registry["3.06"].astf.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  var HTTP_REQ = 'GET /3384 HTTP/1.1\r\nHost: 22.0.0.3\r\nConnection: Keep-Alive\r\nUser-Agent: Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322; .NET CLR 2.0.50727)\r\nAccept: */*\r\nAccept-Language: en-us\r\nAccept-Encoding: gzip, deflate, compress\r\n\r\n';

  function httpResponseHeader(bodyBytes) {
    return 'HTTP/1.1 200 OK\r\nServer: Microsoft-IIS/6.0\r\nContent-Type: text/html\r\nContent-Length: ' +
      bodyBytes + '\r\n\r\n';
  }

  /* Resolve a payload spec to { expr, len, base }.
   * expr is the python expression, len the byte length, base the variable-name stem. */
  function resolvePayload(p) {
    var py = TB.gen.py;
    if (p.kind === 'httpRequest') {
      return { expr: py.sq(HTTP_REQ), len: HTTP_REQ.length, base: 'http_req' };
    }
    if (p.kind === 'httpResponse') {
      var body = p.bodyBytes || 0;
      var head = httpResponseHeader(body);
      return { expr: py.sq(head) + " + ('*' * " + body + ')', len: head.length + body, base: 'http_response' };
    }
    var text = p.text || '';
    return { expr: py.sq(text), len: text.length, base: 'payload' };
  }

  /* Payload variable pool: identical expressions share one variable. */
  function makePool() {
    var byExpr = {};
    var usedNames = {};
    var order = [];
    return {
      add: function (payload) {
        var r = resolvePayload(payload);
        if (byExpr[r.expr]) { return byExpr[r.expr]; }
        var name = r.base;
        var n = 2;
        while (usedNames[name]) { name = r.base + '_' + n; n++; }
        usedNames[name] = true;
        var entry = { name: name, expr: r.expr, len: r.len };
        byExpr[r.expr] = entry;
        order.push(entry);
        return entry;
      },
      defs: function () { return order; }
    };
  }

  function ipGenDistLines(varName, side, indent) {
    var py = TB.gen.py;
    var args = ['ip_range=[' + py.dq(side.start) + ', ' + py.dq(side.end) + ']',
                'distribution=' + py.dq(side.distribution || 'seq')];
    if (side.perCore) { args.push('per_core_distribution=' + py.dq(side.perCore)); }
    return indent + varName + ' = ASTFIPGenDist(' + args.join(', ') + ')';
  }

  function ipGenLines(suffix, ipGen, indent) {
    var py = TB.gen.py;
    var lines = [];
    lines.push(ipGenDistLines('ip_gen_c' + suffix, ipGen.client, indent));
    lines.push(ipGenDistLines('ip_gen_s' + suffix, ipGen.server, indent));
    var head = indent + 'ip_gen' + suffix + ' = ASTFIPGen(';
    var cont = new Array(head.length + 1).join(' ');
    lines.push(head + 'glob=ASTFIPGenGlobal(ip_offset=' + py.dq(ipGen.ipOffset || '1.0.0.0') + '),');
    lines.push(cont + 'dist_client=ip_gen_c' + suffix + ',');
    lines.push(cont + 'dist_server=ip_gen_s' + suffix + ')');
    return lines;
  }

  var TCP_FIELDS = ['mss', 'rxbufsize', 'txbufsize', 'initwnd', 'no_delay', 'do_rfc1323',
                    'keepinit', 'keepidle', 'keepintvl', 'no_delay_counter', 'delay_ack_msec'];

  function globInfoLines(varName, g, indent) {
    var py = TB.gen.py;
    var lines = [];
    var i, f, v;
    for (i = 0; i < TCP_FIELDS.length; i++) {
      f = TCP_FIELDS[i];
      v = g.tcp ? g.tcp[f] : null;
      if (v !== null && v !== undefined && v !== '') {
        lines.push(indent + varName + '.tcp.' + f + ' = ' + py.num(v));
      }
    }
    ['tos', 'ttl'].forEach(function (f2) {
      var iv = g.ip ? g.ip[f2] : null;
      if (iv !== null && iv !== undefined && iv !== '') {
        lines.push(indent + varName + '.ip.' + f2 + ' = ' + py.num(iv));
      }
    });
    if (g.scheduler && g.scheduler.rampupSec !== null && g.scheduler.rampupSec !== undefined && g.scheduler.rampupSec !== '') {
      lines.push(indent + varName + '.scheduler.rampup_sec = ' + py.num(g.scheduler.rampupSec));
    }
    if (g.ipv6 && g.ipv6.enable) {
      lines.push(indent + varName + '.ipv6.enable = 1');
      if (g.ipv6.srcMsb) { lines.push(indent + varName + '.ipv6.src_msb = ' + py.dq(g.ipv6.srcMsb)); }
      if (g.ipv6.dstMsb) { lines.push(indent + varName + '.ipv6.dst_msb = ' + py.dq(g.ipv6.dstMsb)); }
    }
    if (!lines.length) { return null; }
    return [indent + varName + ' = ASTFGlobalInfo()'].concat(lines);
  }

  /* Emit one program's command list. peerSends: payload-pool entries the peer
   * sends, in order, used to resolve recv byte counts to len(var). */
  function programLines(progVar, prog, isUdp, pool, peerSends, indent, warnings, ctx) {
    var py = TB.gen.py;
    var lines = [indent + progVar + ' = ASTFProgram(' + (isUdp ? 'stream=False' : '') + ')'];
    var autoIdx = 0;
    var labels = {};
    var vars = {};
    var cmds = prog.commands || [];
    var i, c;
    for (i = 0; i < cmds.length; i++) {
      c = cmds[i];
      if (c.op === 'set_label') { labels[c.name] = true; }
      if (c.op === 'set_var') { vars[c.id] = true; }
    }
    for (i = 0; i < cmds.length; i++) {
      c = cmds[i];
      switch (c.op) {
        case 'send':
        case 'send_msg': {
          var entry = pool.add(c.payload);
          lines.push(indent + progVar + '.' + c.op + '(' + entry.name + ')');
          break;
        }
        case 'recv':
        case 'recv_msg': {
          if (c.op === 'recv_msg') {
            lines.push(indent + progVar + '.recv_msg(' + py.num(c.count || 1) + ')');
            break;
          }
          var arg;
          if (c.bytes === null || c.bytes === undefined) {
            // auto: pair with the peer's next send, in order
            var peer = peerSends[autoIdx];
            autoIdx += 1;
            if (peer) {
              arg = 'len(' + peer.name + ')';
            } else {
              arg = '0';
              warnings.push(ctx + ': recv set to "auto" has no matching peer send.');
            }
          } else {
            var match = null;
            for (var j = 0; j < peerSends.length; j++) {
              if (peerSends[j].len === c.bytes) { match = peerSends[j]; break; }
            }
            if (match) {
              arg = 'len(' + match.name + ')';
            } else {
              /* peer sends one buffer in a loop (http_eflow pattern): an exact
               * multiple of a peer send length is emitted as len(buf) * N */
              var mult = null;
              for (j = 0; j < peerSends.length; j++) {
                if (peerSends[j].len > 0 && c.bytes % peerSends[j].len === 0) {
                  mult = { entry: peerSends[j], n: c.bytes / peerSends[j].len };
                  break;
                }
              }
              if (mult) {
                arg = 'len(' + mult.entry.name + ') * ' + mult.n;
              } else {
                arg = py.num(c.bytes);
                warnings.push(ctx + ': recv(' + c.bytes + ') does not match any peer send length.');
              }
            }
          }
          lines.push(indent + progVar + '.recv(' + arg + ')');
          break;
        }
        case 'delay':
          lines.push(indent + progVar + '.delay(' + py.num(c.usec) + ')');
          break;
        case 'delay_rand':
          lines.push(indent + progVar + '.delay_rand(' + py.num(c.minUsec) + ', ' + py.num(c.maxUsec) + ')');
          break;
        case 'set_var':
          lines.push(indent + progVar + '.set_var(' + py.dq(c.id) + ', ' + py.num(c.value) + ')');
          break;
        case 'set_label':
          lines.push(indent + progVar + '.set_label(' + py.dq(c.name) + ')');
          break;
        case 'jmp_nz':
          if (!vars[c.id]) { warnings.push(ctx + ': jmp_nz references unknown var "' + c.id + '".'); }
          if (!labels[c.label]) { warnings.push(ctx + ': jmp_nz references unknown label "' + c.label + '".'); }
          lines.push(indent + progVar + '.jmp_nz(' + py.dq(c.id) + ', ' + py.dq(c.label) + ')');
          break;
        case 'wait_for_peer_close':
          lines.push(indent + progVar + '.wait_for_peer_close()');
          break;
        default:
          warnings.push(ctx + ': unknown command "' + c.op + '" skipped.');
      }
    }
    return lines;
  }

  function sendEntries(prog, pool) {
    var out = [];
    (prog.commands || []).forEach(function (c) {
      if (c.op === 'send' || c.op === 'send_msg') { out.push(pool.add(c.payload)); }
    });
    return out;
  }

  /* ---------------- GTP-U tunnels topology (astf/gtpu_topo.py-like) ---------------- */

  function ip2num(ip) {
    var p = ip.split('.');
    return ((+p[0]) << 24 >>> 0) + ((+p[1]) << 16) + ((+p[2]) << 8) + (+p[3]);
  }

  function topoOn(model) {
    return !!(model.tunnelsTopo && model.tunnelsTopo.enabled);
  }

  function topoWarnings(model, warnings) {
    var ctxs = model.tunnelsTopo.ctxs || [];
    if (!ctxs.length) {
      warnings.push('GTP-U topology is ON but has no tunnel contexts; nothing will be tunneled.');
      return;
    }
    var pool = model.ipGen && model.ipGen.client;
    var ps = pool && TB.util.isIpv4(pool.start) ? ip2num(pool.start) : null;
    var pe = pool && TB.util.isIpv4(pool.end) ? ip2num(pool.end) : null;
    ctxs.forEach(function (c, i) {
      var label = 'GTP-U context ' + (i + 1);
      if (!TB.util.isIpv4(c.srcStart) || !TB.util.isIpv4(c.srcEnd)) {
        warnings.push(label + ': src_start/src_end must be IPv4 addresses (client-pool addresses are always IPv4).');
        return;
      }
      var cs = ip2num(c.srcStart), ce = ip2num(c.srcEnd);
      if (cs > ce) { warnings.push(label + ': src_start is above src_end.'); }
      if (ps !== null && pe !== null && (cs < ps || ce > pe)) {
        warnings.push(label + ': range ' + c.srcStart + '-' + c.srcEnd +
          ' is outside the client pool ' + pool.start + '-' + pool.end + '; those clients will never exist.');
      }
      if (c.version === 6) {
        if (!TB.util.isIpv6(c.srcIp) || !TB.util.isIpv6(c.dstIp)) {
          warnings.push(label + ': version 6 needs IPv6 outer src/dst endpoints.');
        }
      } else if (!TB.util.isIpv4(c.srcIp) || !TB.util.isIpv4(c.dstIp)) {
        warnings.push(label + ': version 4 needs IPv4 outer src/dst endpoints.');
      }
      for (var j = i + 1; j < ctxs.length; j++) {
        var o = ctxs[j];
        if (TB.util.isIpv4(o.srcStart) && TB.util.isIpv4(o.srcEnd) &&
            Math.max(cs, ip2num(o.srcStart)) <= Math.min(ce, ip2num(o.srcEnd))) {
          warnings.push(label + ' and context ' + (j + 1) + ': client ranges overlap; each client needs exactly one tunnel.');
        }
      }
    });
  }

  /* Companion topology file: module-level get_topo() returning TunnelsTopo,
   * loaded in the console with "tunnels_topo load -f <file>" before start. */
  function topoFileLines(model, opts, fileBase) {
    var py = TB.gen.py;
    var lines = py.header({
      title: 'ASTF GTP-U tunnels topology (load before the profile)',
      date: opts.now || TB.util.todayIso(),
      trexVersion: model.trexVersion || '3.06',
      validate: 'trex console: tunnels_topo load -f ' + fileBase + '_topo.py',
      modelFile: fileBase + '.trexb.json'
    });
    lines.push('from trex.astf.api import *');
    lines.push('from trex.astf.tunnels_topo import TunnelsTopo');
    lines.push('');
    lines.push('');
    lines.push('def get_topo():');
    lines.push('    topo = TunnelsTopo()');
    (model.tunnelsTopo.ctxs || []).forEach(function (c) {
      lines.push('');
      lines.push('    topo.add_tunnel_ctx(');
      lines.push("        src_start = " + py.sq(c.srcStart) + ',');
      lines.push("        src_end = " + py.sq(c.srcEnd) + ',');
      lines.push('        initial_teid = ' + py.num(c.initialTeid) + ',');
      lines.push('        teid_jump = ' + py.num(c.teidJump) + ',');
      lines.push('        sport = ' + py.num(c.sport) + ',');
      lines.push('        version = ' + py.num(c.version || 4) + ',');
      lines.push('        tunnel_type = 1,  # GTP-U');
      lines.push("        src_ip = " + py.sq(c.srcIp) + ',');
      lines.push("        dst_ip = " + py.sq(c.dstIp) + ',');
      lines.push('        activate = ' + (c.activate === false ? 'False' : 'True'));
      lines.push('    )');
    });
    lines.push('');
    lines.push('    return topo');
    lines.push('');
    return lines;
  }

  function generate(model, opts) {
    opts = opts || {};
    var py = TB.gen.py;
    var warnings = [];
    var name = (model.meta && model.meta.name) ? model.meta.name : 'astf_profile';
    var fileBase = name.replace(/[^\w.-]+/g, '_');
    var IND = '        ';

    var lines = py.header({
      title: 'ASTF profile',
      date: opts.now || TB.util.todayIso(),
      trexVersion: model.trexVersion || '3.06',
      validate: './astf-sim -f ' + fileBase + '.py --full -o /tmp/',
      modelFile: fileBase + '.trexb.json'
    });
    var summary = py.summaryComment(TB.gen.summary ? TB.gen.summary(model) : []);
    if (summary.length) {
      var closing = lines.pop();
      lines = lines.concat(summary);
      lines.push(closing);
    }
    lines.push('from trex.astf.api import *');
    lines.push('import argparse');
    lines.push('');
    lines.push('');
    lines.push('class ASTFGenProfile(object):');
    lines.push('');
    lines.push('    def get_profile(self, tunables, **kwargs):');
    lines = lines.concat(py.argparseLines([], IND));
    lines.push('');

    /* default ip generator */
    lines.push(IND + '# ip generator');
    lines = lines.concat(ipGenLines('', model.ipGen, IND));

    /* global info */
    var profileKwargs = ['default_ip_gen=ip_gen'];
    var cLines = globInfoLines('c_glob_info', (model.globals && model.globals.client) || {}, IND);
    var sLines = globInfoLines('s_glob_info', (model.globals && model.globals.server) || {}, IND);
    if (cLines) {
      lines.push('');
      lines = lines.concat(cLines);
      profileKwargs.push('default_c_glob_info=c_glob_info');
    }
    if (sLines) {
      lines.push('');
      lines = lines.concat(sLines);
      profileKwargs.push('default_s_glob_info=s_glob_info');
    }
    var sRamp = model.globals && model.globals.server && model.globals.server.scheduler &&
      model.globals.server.scheduler.rampupSec;
    var cRamp = model.globals && model.globals.client && model.globals.client.scheduler &&
      model.globals.client.scheduler.rampupSec;
    if (sRamp && !cRamp) {
      warnings.push('scheduler.rampup_sec is set on the server side only; the CPS ramp is driven by the client side.');
    }

    var i;
    if (model.mode === 'pcap') {
      var capList = model.capList || [];
      if (!capList.length) { warnings.push('Pcap mode with an empty cap list; the profile generates no traffic.'); }

      /* per-cap ip_gen overrides */
      var ovrIdx = 0;
      var capOvrName = [];
      for (i = 0; i < capList.length; i++) {
        if (capList[i].ipGenOverride) {
          ovrIdx += 1;
          var suffix = '_' + (ovrIdx + 1);
          lines.push('');
          lines = lines.concat(ipGenLines(suffix, capList[i].ipGenOverride, IND));
          capOvrName[i] = 'ip_gen' + suffix;
        } else {
          capOvrName[i] = null;
        }
      }

      lines.push('');
      var head = IND + 'return ASTFProfile(';
      var cont = new Array(head.length + 1).join(' ');
      for (i = 0; i < profileKwargs.length; i++) {
        lines.push((i === 0 ? head : cont) + profileKwargs[i] + ',');
      }
      lines.push(cont + 'cap_list=[');
      for (i = 0; i < capList.length; i++) {
        var c = capList[i];
        var args = ['file=' + py.dq(c.file), 'cps=' + py.num(c.cps)];
        if (c.port !== null && c.port !== undefined && c.port !== '') { args.push('port=' + py.num(c.port)); }
        if (c.sDelayUsec !== null && c.sDelayUsec !== undefined && c.sDelayUsec !== '') { args.push('s_delay=' + py.num(c.sDelayUsec)); }
        if (capOvrName[i]) { args.push('ip_gen=' + capOvrName[i]); }
        lines.push(cont + '    ASTFCapInfo(' + args.join(', ') + ')' + (i < capList.length - 1 ? ',' : ''));
      }
      lines.push(cont + '])');
    } else {
      var templates = model.templates || [];
      if (!templates.length) { warnings.push('Program mode with no templates; the profile generates no traffic.'); }

      var ports = {};
      var pool = makePool();
      var multi = templates.length > 1;
      var tmplVars = [];

      for (i = 0; i < templates.length; i++) {
        var t = templates[i];
        var sfx = multi ? '_' + (i + 1) : '';
        var label = t.tgName ? t.tgName : ('template ' + (i + 1));
        var ctx = 'Template "' + label + '"';

        if (t.assocPort !== null && t.assocPort !== undefined) {
          if (ports[t.assocPort]) {
            warnings.push('Templates "' + ports[t.assocPort] + '" and "' + label + '" share association port ' + t.assocPort + '.');
          } else {
            ports[t.assocPort] = label;
          }
        }

        /* register payloads first so defs appear before the programs */
        var defsBefore = pool.defs().length;
        var cSends = sendEntries(t.client, pool);
        var sSends = sendEntries(t.server, pool);

        lines.push('');
        lines.push(IND + '# ' + (multi ? 'template ' + (i + 1) : 'template') + (t.tgName ? ': ' + t.tgName : ''));
        var newDefs = pool.defs().slice(defsBefore);
        for (var d = 0; d < newDefs.length; d++) {
          lines.push(IND + newDefs[d].name + ' = ' + newDefs[d].expr);
        }
        if (newDefs.length) { lines.push(''); }

        var isUdp = t.stream === false;
        lines = lines.concat(programLines('prog_c' + sfx, t.client, isUdp, pool, sSends, IND, warnings, ctx + ' client'));
        lines.push('');
        lines = lines.concat(programLines('prog_s' + sfx, t.server, isUdp, pool, cSends, IND, warnings, ctx + ' server'));
        lines.push('');

        var ipGenVar = 'ip_gen';
        if (t.ipGenOverride) {
          var osfx = sfx + '_ovr';
          lines = ipGenLines(osfx, t.ipGenOverride, IND).concat(['']).reduce(function (acc, l) { acc.push(l); return acc; }, lines);
          ipGenVar = 'ip_gen' + osfx;
        }

        var cArgs = ['program=prog_c' + sfx, 'ip_gen=' + ipGenVar];
        if (t.assocPort !== null && t.assocPort !== undefined) { cArgs.push('port=' + py.num(t.assocPort)); }
        cArgs.push('cps=' + py.num(t.cps === null || t.cps === undefined ? 1 : t.cps));
        lines.push(IND + 'temp_c' + sfx + ' = ASTFTCPClientTemplate(' + cArgs.join(', ') + ')');

        var sArgs = ['program=prog_s' + sfx];
        if (t.assocPort !== null && t.assocPort !== undefined) {
          sArgs.push('assoc=ASTFAssociationRule(' + py.num(t.assocPort) + ')');
        }
        lines.push(IND + 'temp_s' + sfx + ' = ASTFTCPServerTemplate(' + sArgs.join(', ') + ')');

        var tArgs = ['client_template=temp_c' + sfx, 'server_template=temp_s' + sfx];
        if (t.tgName) { tArgs.push('tg_name=' + py.sq(t.tgName)); }
        lines.push(IND + 'template' + sfx + ' = ASTFTemplate(' + tArgs.join(', ') + ')');
        tmplVars.push('template' + sfx);
      }

      lines.push('');
      var head2 = IND + 'return ASTFProfile(';
      var cont2 = new Array(head2.length + 1).join(' ');
      for (i = 0; i < profileKwargs.length; i++) {
        lines.push((i === 0 ? head2 : cont2) + profileKwargs[i] + ',');
      }
      lines.push(cont2 + 'templates=[' + tmplVars.join(', ') + '])');
    }

    lines.push('');
    lines.push('');
    lines.push('def register():');
    lines.push('    return ASTFGenProfile()');
    lines.push('');
    /* self-describing re-edit tag; values live in the file body above, so
       re-import reads them from there (see js/core/import.js). Mirrors STL/cap2.
       Only the main profile carries it - the companion _topo.py is not re-imported. */
    lines.push(TB.gen.py.fileTag('astf', model.schemaVersion));
    lines.push('');

    var files = [{ name: fileBase + '.py', language: 'python', content: lines.join('\n') }];
    if (topoOn(model)) {
      topoWarnings(model, warnings);
      files.push({ name: fileBase + '_topo.py', language: 'python',
                   content: topoFileLines(model, opts, fileBase).join('\n') });
    }

    return { files: files, warnings: warnings };
  }

  TB.gen.astfHttpReq = HTTP_REQ;
  TB.gen.astfHttpResponseHeader = httpResponseHeader;
  TB.gen.register('3.06', 'astf', generate);
})(typeof window !== 'undefined' ? window : globalThis);
