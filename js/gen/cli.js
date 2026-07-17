/* TRex Profile & Config Builder - t-rex-64 CLI command builder (TRex v3.06).
 *
 * Pure function: generate(model, opts) -> { files, warnings, command }
 * Emits run_<name>.sh (the t-rex-64 launch line) and, for interactive modes,
 * CONSOLE.txt with the matching trex-console commands. In interactive modes
 * -m/-d/-l belong on the console start line, not on t-rex-64.
 * Registered as TB.gen.registry["3.06"].cli.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  var MASK_RE = /^0x[0-9a-fA-F]+$/;

  function set(v) { return v !== null && v !== undefined && v !== ''; }

  /* "0, 1" / "0 1" -> "0 1"; returns null when empty or not all ints */
  function portList(raw) {
    if (!set(raw)) { return null; }
    var parts = String(raw).trim().split(/[\s,]+/);
    for (var i = 0; i < parts.length; i++) {
      if (!/^\d+$/.test(parts[i])) { return null; }
    }
    return parts.join(' ');
  }

  /* Console lines for the service-mode + capture helper (interactive only).
   * v3.06 console syntax (trex_capture.py / service_line):
   *   service [-p PORTS] [--off]
   *   capture record start --rx P.. --tx P.. -l N -f BPF -s SNAP
   *   capture record stop -i ID -o FILE  |  capture monitor start/stop  */
  function serviceBlock(svc, warnings) {
    var lines = [];
    lines.push('# --- service mode & capture ' + new Array(47).join('-'));
    lines.push('# Service mode makes ports answer ARP/ICMP and enables rx capture.');
    lines.push('# NOTE: service mode filters/forwards rx traffic to software - do not');
    lines.push('# measure performance while it is on.');
    var ports = portList(svc.ports);
    if (set(svc.ports) && ports === null) {
      warnings.push('Service ports "' + svc.ports + '" is not a list of port numbers; using all acquired ports.');
    }
    lines.push('trex> service' + (ports ? ' -p ' + ports : '') + (ports ? '' : '          # all acquired ports'));

    var rx = portList(svc.rx);
    var tx = portList(svc.tx);
    var bpf = set(svc.bpf) ? ' -f "' + svc.bpf + '"' : '';
    var snap = set(svc.snaplen) ? ' -s ' + svc.snaplen : '';

    if (svc.capture === 'record') {
      if (!rx && !tx) {
        warnings.push('Capture record has no --rx or --tx ports; defaulting to --rx 0.');
        rx = '0';
      }
      var limit = set(svc.limit) ? svc.limit : 1000;
      lines.push('trex> capture record start' + (rx ? ' --rx ' + rx : '') + (tx ? ' --tx ' + tx : '') +
        ' -l ' + limit + bpf + snap);
      lines.push('trex> capture show                    # note the capture id');
      lines.push('# ... run traffic, then write the buffer to a pcap:');
      lines.push('trex> capture record stop -i 1 -o ' + (set(svc.outFile) ? svc.outFile : '/tmp/capture.pcap'));
    } else if (svc.capture === 'monitor') {
      if (!rx && !tx) {
        warnings.push('Capture monitor has no --rx or --tx ports; defaulting to --rx 0.');
        rx = '0';
      }
      lines.push('trex> capture monitor start' + (rx ? ' --rx ' + rx : '') + (tx ? ' --tx ' + tx : '') +
        (svc.pipe ? ' -p' : ' -v') + bpf + snap +
        (svc.pipe ? '    # pipe to wireshark' : '    # print to screen'));
      lines.push('trex> capture monitor stop');
    }
    lines.push('trex> capture clear                   # drop any leftover captures');
    lines.push('trex> service --off' + (ports ? ' -p ' + ports : '') + '                   # back to full-speed forwarding');
    return lines;
  }

  function generate(model, opts) {
    opts = opts || {};
    var warnings = [];
    var name = (model.meta && model.meta.name) ? model.meta.name : 'trex_run';
    var fileBase = name.replace(/[^\w.-]+/g, '_');
    var mode = model.mode || 'astf';
    var interactive = mode !== 'legacy';
    var cores = set(model.cores) ? model.cores : 4;
    var mult = set(model.mult) ? model.mult : 1;
    var profile = model.profile || '';
    var trexDir = model.trexDir || '<trex dir>';

    if (!set(model.cfgPath)) {
      warnings.push('No --cfg path set; t-rex-64 will fall back to /etc/trex_cfg.yaml if it exists.');
    }
    if (model.astfServerOnly && model.astfClientMask) {
      warnings.push('--astf-server-only and --astf-client-mask are mutually exclusive; emitting server-only.');
    }
    if (model.astfClientMask && !MASK_RE.test(model.astfClientMask)) {
      warnings.push('Client mask "' + model.astfClientMask + '" is not valid hex (expected e.g. 0x1).');
    }
    if (model.astfServerOnly && mult !== 1) {
      warnings.push('-m has no effect with --astf-server-only; the server side does not generate load.');
    }
    if (mode === 'stl' && set(model.latencyPps)) {
      warnings.push('STL interactive mode does not use -l; add a latency stream (STLFlowLatencyStats) to the ' +
        'profile instead - note latency streams ignore the -m multiplier.');
    }
    if (!profile) {
      warnings.push('No profile selected; using a <profile> placeholder.');
      profile = mode === 'legacy' ? '<profile.yaml>' : '<profile.py>';
    }
    var svc = model.service;
    if (svc && svc.enabled && !interactive) {
      warnings.push('Service mode & capture are trex-console commands; they need an interactive mode ' +
        '(legacy STF has no console). Block skipped.');
    }

    /* ---- t-rex-64 line (canonical flag order) ---- */
    var parts = ['sudo ./t-rex-64'];
    if (interactive) {
      parts.push('-i');
      parts.push(mode === 'stl' ? '--stl' : '--astf');
    } else {
      parts.push('-f ' + profile);
    }
    if (set(model.cfgPath)) { parts.push('--cfg ' + model.cfgPath); }
    parts.push('-c ' + cores);
    if (!interactive) {
      parts.push('-m ' + mult);
      if (set(model.durationSec)) { parts.push('-d ' + model.durationSec); }
      if (set(model.latencyPps)) { parts.push('-l ' + model.latencyPps); }
      if (model.flowPortAffinity) { parts.push('-p'); }
    }
    if (mode === 'astf') {
      if (model.astfServerOnly) {
        parts.push('--astf-server-only');
      } else if (model.astfClientMask) {
        parts.push('--astf-client-mask ' + model.astfClientMask);
      }
    }
    if (set(model.extraArgs)) { parts.push(model.extraArgs.trim()); }
    var command = parts.join(' ');

    var header = [
      '# ' + new Array(78).join('-'),
      '# TRex Profile & Config Builder - t-rex-64 launcher',
      '# Generated: ' + (opts.now || TB.util.todayIso()) + '   Target: TRex v' + (model.trexVersion || '3.06'),
      '# Mode: ' + (mode === 'legacy' ? 'legacy/batch STF' : 'interactive ' + mode.toUpperCase())
    ];
    header = header.concat(TB.gen.py.summaryComment(TB.gen.summary ? TB.gen.summary(model) : []));
    header.push('# ' + new Array(78).join('-'));

    var script = ['#!/bin/bash'].concat(header).concat([
      'cd ' + trexDir,
      command,
      ''
    ]).join('\n');

    var files = [{ name: 'run_' + fileBase + '.sh', language: 'shell', content: script }];

    /* ---- console block for interactive modes ---- */
    if (interactive) {
      var consoleLines = header.slice();
      consoleLines.push('# Run in a SECOND terminal on the same box once t-rex-64 is up:');
      consoleLines.push('cd ' + trexDir);
      consoleLines.push('./trex-console');
      consoleLines.push('');
      if (mode === 'astf' && model.astfServerOnly) {
        consoleLines.push('# This box runs --astf-server-only: it answers connections only.');
        consoleLines.push('# Start traffic from the CLIENT box console; useful here:');
        consoleLines.push('trex> stats');
      } else {
        var start = ['start -f ' + profile];
        if (mode === 'stl') { start.push('-a'); }
        start.push('-m ' + mult);
        if (set(model.durationSec)) { start.push('-d ' + model.durationSec); }
        if (mode === 'astf' && set(model.latencyPps)) { start.push('-l ' + model.latencyPps); }
        if (mode === 'astf' && model.astfClientMask && MASK_RE.test(model.astfClientMask)) {
          start.push('--client_mask ' + model.astfClientMask);
        }
        consoleLines.push('trex> ' + start.join(' '));
        consoleLines.push('trex> tui        # live stats dashboard');
        consoleLines.push('trex> stop       # stop traffic');
      }
      if (svc && svc.enabled) {
        consoleLines.push('');
        consoleLines = consoleLines.concat(serviceBlock(svc, warnings));
      }
      consoleLines.push('');
      files.push({ name: 'CONSOLE.txt', language: 'shell', content: consoleLines.join('\n') });
    }

    return { files: files, warnings: warnings, command: command };
  }

  TB.gen.register('3.06', 'cli', generate);
})(typeof window !== 'undefined' ? window : globalThis);
