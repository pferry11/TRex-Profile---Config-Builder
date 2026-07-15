/* TRex Profile & Config Builder - STL (stateless) profile generator for TRex v3.06.
 *
 * Pure function: generate(model, opts) -> { files: [{name, language, content}], warnings: [] }
 * opts.now (YYYY-MM-DD) makes output deterministic for tests.
 * Registered as TB.gen.registry["3.06"].stl.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  var HEADER_BYTES = { ether: 14, dot1q: 4, ipv4: 20, ipv6: 40, ipv6ext: 8, udp: 8, tcp: 20, icmp: 8 };

  /* Outer-header bytes each tunnel adds in front of the inner L3:
   * vxlan = outer IP + UDP + VXLAN + inner Ether; gre = outer IP + GRE base;
   * mpls/qinq = one 4-byte tag; nsh = 8-byte base header. */
  var TUNNEL_BYTES = { vxlan: 20 + 8 + 8 + 14, gre: 20 + 4, mpls: 4, qinq: 4, nsh: 8 };

  function tunnelType(p) {
    return (p.tunnel && p.tunnel.type && p.tunnel.type !== 'none') ? p.tunnel.type : null;
  }

  // Exposed so the UI can show a live packet-size readout with the same numbers
  // the generator warns about.
  function packetInfo(stream) {
    var p = stream.packet;
    var hdr = HEADER_BYTES.ether;
    if (p.vlan && p.vlan.enabled) { hdr += HEADER_BYTES.dot1q; }
    var tun = tunnelType(p);
    if (tun) { hdr += TUNNEL_BYTES[tun] || 0; }
    if (p.l3.type === 'ipv4') { hdr += HEADER_BYTES.ipv4; }
    else if (p.l3.type === 'ipv6') {
      hdr += HEADER_BYTES.ipv6;
      if (p.l3.ext && p.l3.ext !== 'none') { hdr += HEADER_BYTES.ipv6ext; }
    }
    if (p.l4.type === 'udp') { hdr += HEADER_BYTES.udp; }
    else if (p.l4.type === 'tcp') { hdr += HEADER_BYTES.tcp; }
    else if (p.l4.type === 'icmp') { hdr += HEADER_BYTES.icmp; }
    var frame = null;
    if (p.payload && p.payload.mode === 'pad' && !p.payload.rawScapy) {
      frame = Math.max(hdr, p.payload.frameSize || 0);
    }
    return { headerBytes: hdr, frameBytes: frame };
  }

  function hasVal(x) { return x !== null && x !== undefined && x !== ''; }

  function packetExpr(stream) {
    var py = TB.gen.py;
    var p = stream.packet;
    var parts = [];

    var etherArgs = [];
    if (p.l2 && p.l2.srcMac) { etherArgs.push('src=' + py.dq(p.l2.srcMac)); }
    if (p.l2 && p.l2.dstMac) { etherArgs.push('dst=' + py.dq(p.l2.dstMac)); }
    parts.push('Ether(' + etherArgs.join(',') + ')');

    var tun = tunnelType(p);
    var t = p.tunnel || {};
    if (tun === 'qinq') { parts.push('Dot1AD(vlan=' + py.num(t.outerVlanId) + ')'); }

    if (p.vlan && p.vlan.enabled) {
      var vArgs = ['vlan=' + py.num(p.vlan.id)];
      if (p.vlan.prio) { vArgs.push('prio=' + py.num(p.vlan.prio)); }
      parts.push('Dot1Q(' + vArgs.join(',') + ')');
    }

    if (tun === 'mpls') {
      var mArgs = ['label=' + py.num(t.label)];
      if (hasVal(t.mplsTtl)) { mArgs.push('ttl=' + py.num(t.mplsTtl)); }
      parts.push('MPLS(' + mArgs.join(',') + ')');
    } else if (tun === 'nsh') {
      parts.push('NSH(spi=' + py.num(t.spi) + ',si=' + py.num(t.si) + ')');
    } else if (tun === 'gre') {
      parts.push('IP(src=' + py.dq(t.outerSrc) + ',dst=' + py.dq(t.outerDst) + ')');
      parts.push('GRE()');
    } else if (tun === 'vxlan') {
      parts.push('IP(src=' + py.dq(t.outerSrc) + ',dst=' + py.dq(t.outerDst) + ')');
      parts.push('UDP(sport=1025,dport=4789)');
      parts.push('VXLAN(vni=' + py.num(t.vni) + ')');
      parts.push('Ether()');
    }

    if (p.l3.type === 'ipv4') {
      var ipArgs = ['src=' + py.dq(p.l3.src), 'dst=' + py.dq(p.l3.dst)];
      if (hasVal(p.l3.tos)) { ipArgs.push('tos=' + py.num(p.l3.tos)); }
      if (hasVal(p.l3.ttl)) { ipArgs.push('ttl=' + py.num(p.l3.ttl)); }
      if (p.l3.moreFrags) { ipArgs.push('flags="MF"'); }
      if (hasVal(p.l3.fragOffset)) { ipArgs.push('frag=' + py.num(p.l3.fragOffset)); }
      parts.push('IP(' + ipArgs.join(',') + ')');
    } else if (p.l3.type === 'ipv6') {
      parts.push('IPv6(src=' + py.dq(p.l3.src) + ',dst=' + py.dq(p.l3.dst) + ')');
      if (p.l3.ext === 'hbh') { parts.push('IPv6ExtHdrHopByHop()'); }
      else if (p.l3.ext === 'frag') { parts.push('IPv6ExtHdrFragment()'); }
    }

    if (p.l4.type === 'udp') {
      parts.push('UDP(dport=' + py.num(p.l4.dport) + ',sport=' + py.num(p.l4.sport) + ')');
    } else if (p.l4.type === 'tcp') {
      var tArgs = ['dport=' + py.num(p.l4.dport), 'sport=' + py.num(p.l4.sport)];
      if (p.l4.tcpFlags) { tArgs.push('flags=' + py.dq(p.l4.tcpFlags)); }
      parts.push('TCP(' + tArgs.join(',') + ')');
    } else if (p.l4.type === 'icmp') {
      var reply = p.l4.icmpKind === 'echo-reply';
      var icmpArgs = [];
      if (hasVal(p.l4.icmpId)) { icmpArgs.push('id=' + py.num(p.l4.icmpId)); }
      if (hasVal(p.l4.icmpSeq)) { icmpArgs.push('seq=' + py.num(p.l4.icmpSeq)); }
      if (p.l3.type === 'ipv6') {
        parts.push((reply ? 'ICMPv6EchoReply(' : 'ICMPv6EchoRequest(') + icmpArgs.join(',') + ')');
      } else {
        icmpArgs.unshift('type=' + (reply ? 0 : 8));
        parts.push('ICMP(' + icmpArgs.join(',') + ')');
      }
    }

    return parts.join('/');
  }

  function offsetLit(writeTo) {
    var py = TB.gen.py;
    return /^\d+$/.test(String(writeTo)) ? String(writeTo) : py.dq(writeTo);
  }

  function vmLines(stream, indent) {
    var py = TB.gen.py;
    var vm = stream.vm;
    var lines = [];
    var vars = (vm && Array.isArray(vm.vars)) ? vm.vars : [];
    var tuple = vm ? vm.tuple : null;
    if (!vars.length && !tuple) { return null; }

    lines.push(indent + 'vm = STLVM()');
    var needFix = false;
    var i;
    for (i = 0; i < vars.length; i++) {
      var v = vars[i];
      var args = [
        'name=' + py.dq(v.name),
        'min_value=' + py.val(v.min),
        'max_value=' + py.val(v.max),
        'size=' + py.num(v.sizeBytes),
        'op=' + py.dq(v.op)
      ];
      if (v.step !== null && v.step !== undefined && v.step !== 1) { args.push('step=' + py.num(v.step)); }
      if (v.nextVar) { args.push('next_var=' + py.dq(v.nextVar)); }
      if (v.splitToCores === false) { args.push('split_to_cores=False'); }
      lines.push(indent + 'vm.var(' + args.join(', ') + ')');
      if (v.fixChecksum) { needFix = true; }
    }
    for (i = 0; i < vars.length; i++) {
      var wArgs = 'fv_name=' + py.dq(vars[i].name) + ', pkt_offset=' + offsetLit(vars[i].writeTo);
      if (hasVal(vars[i].offsetFixup)) { wArgs += ', offset_fixup=' + py.num(vars[i].offsetFixup); }
      lines.push(indent + 'vm.write(' + wArgs + ')');
    }
    if (tuple) {
      lines.push(indent + 'vm.tuple_var(name=' + py.dq(tuple.name) +
        ', ip_min=' + py.dq(tuple.ipMin) + ', ip_max=' + py.dq(tuple.ipMax) +
        ', port_min=' + py.num(tuple.portMin) + ', port_max=' + py.num(tuple.portMax) +
        ', limit_flows=' + py.num(tuple.limitFlows) + ')');
      lines.push(indent + 'vm.write(fv_name=' + py.dq(tuple.name + '.ip') + ', pkt_offset=' + offsetLit(tuple.writeIpTo) + ')');
      lines.push(indent + 'vm.write(fv_name=' + py.dq(tuple.name + '.port') + ', pkt_offset=' + offsetLit(tuple.writePortTo) + ')');
      needFix = true;
    }
    if (needFix) { lines.push(indent + 'vm.fix_chksum()'); }
    if (vm.cacheSize) { lines.push(indent + 'vm.set_cached(' + py.num(vm.cacheSize) + ')'); }
    return lines;
  }

  // mode.pps holds the rate value in whichever unit mode.rateUnit selects;
  // models saved before rateUnit existed have no field and default to pps.
  var RATE_KWARGS = { pps: 'pps', bps_L1: 'bps_L1', bps_L2: 'bps_L2', percentage: 'percentage' };

  function rateArg(mode) {
    var kw = RATE_KWARGS[mode.rateUnit] || 'pps';
    return kw + '=' + TB.gen.py.num(mode.pps);
  }

  function modeExpr(mode) {
    var py = TB.gen.py;
    if (mode.type === 'cont') {
      return 'STLTXCont(' + rateArg(mode) + ')';
    }
    if (mode.type === 'single_burst') {
      return 'STLTXSingleBurst(' + rateArg(mode) + ', total_pkts=' + py.num(mode.totalPkts) + ')';
    }
    return 'STLTXMultiBurst(' + rateArg(mode) + ', pkts_per_burst=' + py.num(mode.pktsPerBurst) +
      ', ibg=' + py.num(mode.ibgUsec) + ', count=' + py.num(mode.count) + ')';
  }

  function streamNeedsPortId(stream) {
    return stream.flowStats && stream.flowStats.type !== 'none' && stream.flowStats.addPortId;
  }

  function createStreamLines(stream, idx, tunables) {
    var py = TB.gen.py;
    var lines = [];
    var sig = streamNeedsPortId(stream) ? '(self, args, port_id)' : '(self, args)';
    lines.push('    def create_stream_' + idx + sig + ':');

    var pay = stream.packet.payload || {};
    if (pay.rawScapy) {
      lines.push('        # UNVALIDATED raw scapy expression');
      lines.push('        base_pkt = ' + pay.rawScapy);
    } else {
      lines.push('        base_pkt = ' + packetExpr(stream));
      if (pay.mode === 'pad') {
        var sizeExpr = pay.frameSizeTunable ? ('args.' + pay.frameSizeTunable) : py.num(pay.frameSize);
        lines.push("        pad = max(0, " + sizeExpr + " - len(base_pkt)) * " + py.sq(pay.fill || 'x'));
      }
    }

    var vm = vmLines(stream, '        ');
    if (vm) { lines = lines.concat(vm); }

    var pktArg;
    if (pay.rawScapy) {
      pktArg = 'pkt=base_pkt';
    } else if (pay.mode === 'pad') {
      pktArg = 'pkt=base_pkt/pad';
    } else {
      pktArg = 'pkt=base_pkt';
    }
    if (vm) { pktArg += ', vm=vm'; }

    var kw = [];
    kw.push("name=" + py.sq(stream.name));
    kw.push('packet=STLPktBuilder(' + pktArg + ')');
    kw.push('mode=' + modeExpr(stream.mode));
    if (stream.isgUsec) { kw.push('isg=' + py.num(stream.isgUsec)); }
    if (stream.flowStats && stream.flowStats.type !== 'none') {
      var cls = stream.flowStats.type === 'latency' ? 'STLFlowLatencyStats' : 'STLFlowStats';
      var pg = py.num(stream.flowStats.pgId);
      if (stream.flowStats.addPortId) { pg += ' + port_id'; }
      kw.push('flow_stats=' + cls + '(pg_id=' + pg + ')');
    }
    if (stream.chain && stream.chain.next) { kw.push("next=" + py.sq(stream.chain.next)); }
    if (stream.chain && stream.chain.selfStart === false) { kw.push('self_start=False'); }
    if (stream.chain && stream.chain.actionCount !== null && stream.chain.actionCount !== undefined && stream.chain.actionCount !== '') {
      kw.push('action_count=' + py.num(stream.chain.actionCount));
    }

    lines.push('        return STLStream(');
    for (var i = 0; i < kw.length; i++) {
      lines.push('            ' + kw[i] + (i < kw.length - 1 ? ',' : ')'));
    }
    return lines;
  }

  function collectWarnings(model, enabled) {
    var warnings = [];
    var names = {};
    var i, j, s;
    for (i = 0; i < enabled.length; i++) { names[enabled[i].name] = true; }

    if (!enabled.length) {
      warnings.push('Profile has no enabled streams; get_streams() will return an empty list.');
    }

    for (i = 0; i < enabled.length; i++) {
      s = enabled[i];
      var info = packetInfo(s);
      if (info.frameBytes !== null && s.packet.payload.frameSize < 60 && !s.packet.payload.frameSizeTunable) {
        warnings.push('Stream "' + s.name + '": frame size ' + s.packet.payload.frameSize +
          ' is below 60 bytes; TRex/NICs may pad or reject short frames.');
      }
      if (info.frameBytes !== null && !s.packet.payload.frameSizeTunable && s.packet.payload.frameSize < info.headerBytes) {
        warnings.push('Stream "' + s.name + '": frame size ' + s.packet.payload.frameSize +
          ' is smaller than the headers (' + info.headerBytes + ' bytes); no padding will be added.');
      }
      if (s.chain && s.chain.next && !names[s.chain.next]) {
        warnings.push('Stream "' + s.name + '": next stream "' + s.chain.next + '" does not exist or is disabled.');
      }
      if (s.vm && Array.isArray(s.vm.vars)) {
        var varNames = s.vm.vars.map(function (v) { return v.name; });
        s.vm.vars.forEach(function (v) {
          if (v.nextVar && varNames.indexOf(v.nextVar) === -1) {
            warnings.push('Stream "' + s.name + '": variable "' + v.name +
              '" depends on unknown variable "' + v.nextVar + '".');
          }
          if (v.nextVar && v.nextVar === v.name) {
            warnings.push('Stream "' + s.name + '": variable "' + v.name + '" cannot depend on itself.');
          }
        });
      }
      if (s.vm && s.vm.tuple && Array.isArray(s.vm.vars)) {
        for (j = 0; j < s.vm.vars.length; j++) {
          var w = s.vm.vars[j].writeTo;
          if (w === s.vm.tuple.writeIpTo || w === s.vm.tuple.writePortTo) {
            warnings.push('Stream "' + s.name + '": variable "' + s.vm.vars[j].name +
              '" and the tuple generator write to the same offset "' + w + '".');
          }
        }
      }
      if (s.flowStats && s.flowStats.type === 'latency') {
        for (j = i + 1; j < enabled.length; j++) {
          var o = enabled[j];
          if (o.flowStats && o.flowStats.type === 'latency' &&
              o.flowStats.pgId === s.flowStats.pgId &&
              o.flowStats.addPortId === s.flowStats.addPortId) {
            warnings.push('Streams "' + s.name + '" and "' + o.name + '" share latency pg_id ' +
              s.flowStats.pgId + '; each latency stream needs a unique pg_id.');
          }
        }
      }
    }
    return warnings;
  }

  function pcapReplayOn(model) {
    return !!(model.pcapReplay && model.pcapReplay.enabled);
  }

  /* Body lines for a load_pcap profile (stl/pcap.py-like): ipg and loop count
   * are exposed as -t arguments with the form values as defaults. */
  function pcapReplayLines(model) {
    var py = TB.gen.py;
    var r = model.pcapReplay;
    var lines = [];
    lines.push('');
    lines.push('    def get_streams(self, tunables, **kwargs):');
    lines.push("        parser = argparse.ArgumentParser(description='trexb generated profile',");
    lines.push('                                         formatter_class=argparse.ArgumentDefaultsHelpFormatter)');
    var ipgDefault = (r.ipgUsec === null || r.ipgUsec === undefined || r.ipgUsec === '') ? 'None' : py.num(r.ipgUsec);
    lines.push("        parser.add_argument('--ipg_usec', type=float, default=" + ipgDefault +
      ", help='usec between replayed packets (None = pcap timing)')");
    lines.push("        parser.add_argument('--loop_count', type=int, default=" + py.num(r.loopCount) +
      ", help='times to replay the pcap (0 = forever)')");
    lines.push('        args = parser.parse_args(tunables)');
    var kw = 'ipg_usec=args.ipg_usec, loop_count=args.loop_count';
    if (r.speedup !== null && r.speedup !== undefined && r.speedup !== '' && r.speedup !== 1) {
      kw += ', speedup=' + py.num(r.speedup);
    }
    lines.push('        return STLProfile.load_pcap(' + py.sq(r.file) + ', ' + kw + ').get_streams()');
    return lines;
  }

  function pcapReplayWarnings(model, enabled) {
    var r = model.pcapReplay;
    var warnings = [];
    if (!r.file) { warnings.push('Pcap replay: no pcap path set.'); }
    if (r.loopCount === null || r.loopCount === undefined || r.loopCount < 0) {
      warnings.push('Pcap replay: loop count must be 0 (forever) or a positive number.');
    }
    if (enabled.length) {
      warnings.push('Pcap replay is ON: the ' + enabled.length + ' enabled stream(s) and any tunables are ignored.');
    }
    return warnings;
  }

  function generate(model, opts) {
    opts = opts || {};
    var py = TB.gen.py;
    var name = (model.meta && model.meta.name) ? model.meta.name : 'stl_profile';
    var fileBase = name.replace(/[^\w.-]+/g, '_');
    var enabled = model.streams.filter(function (s) { return s.enabled !== false; });
    var replay = pcapReplayOn(model);
    var warnings = replay ? pcapReplayWarnings(model, enabled) : collectWarnings(model, enabled);
    var needsPortId = enabled.some(streamNeedsPortId);
    var tunables = Array.isArray(model.tunables) ? model.tunables : [];

    var lines = TB.gen.py.header({
      title: 'STL profile',
      date: opts.now || TB.util.todayIso(),
      trexVersion: model.trexVersion || '3.06',
      validate: './stl-sim -f ' + fileBase + '.py -o /tmp/out.pcap -l 50',
      modelFile: fileBase + '.trexb.json'
    });
    var summary = py.summaryComment(TB.gen.summary ? TB.gen.summary(model) : []);
    if (summary.length) {
      var closing = lines.pop();
      lines = lines.concat(summary);
      lines.push(closing);
    }
    lines.push('from trex_stl_lib.api import *');
    /* MPLS and NSH live in scapy contrib modules, not scapy.all */
    var usesTunnel = function (kind) {
      return !replay && enabled.some(function (s) {
        return !(s.packet.payload && s.packet.payload.rawScapy) && tunnelType(s.packet) === kind;
      });
    };
    if (usesTunnel('mpls')) { lines.push('from scapy.contrib.mpls import MPLS'); }
    if (usesTunnel('nsh')) { lines.push('from scapy.contrib.nsh import NSH'); }
    lines.push('import argparse');
    lines.push('');
    lines.push('');
    lines.push('class STLGenProfile(object):');

    var i;
    if (replay) {
      lines = lines.concat(pcapReplayLines(model));
    } else {
      for (i = 0; i < enabled.length; i++) {
        lines.push('');
        lines = lines.concat(createStreamLines(enabled[i], i + 1, tunables));
      }

      lines.push('');
      var sig = needsPortId ? '(self, port_id, tunables, **kwargs)' : '(self, tunables, **kwargs)';
      lines.push('    def get_streams' + sig + ':');
      lines = lines.concat(py.argparseLines(tunables, '        '));

      var calls = [];
      for (i = 0; i < enabled.length; i++) {
        calls.push('self.create_stream_' + (i + 1) + (streamNeedsPortId(enabled[i]) ? '(args, port_id)' : '(args)'));
      }
      if (calls.length <= 1) {
        lines.push('        return [' + calls.join(', ') + ']');
      } else {
        lines.push('        return [');
        for (i = 0; i < calls.length; i++) {
          lines.push('            ' + calls[i] + ',');
        }
        lines.push('        ]');
      }
    }

    lines.push('');
    lines.push('');
    lines.push('def register():');
    lines.push('    return STLGenProfile()');
    lines.push('');

    return {
      files: [{ name: fileBase + '.py', language: 'python', content: lines.join('\n') }],
      warnings: warnings
    };
  }

  TB.gen.stlPacketInfo = packetInfo;
  TB.gen.register('3.06', 'stl', generate);
})(typeof window !== 'undefined' ? window : globalThis);
