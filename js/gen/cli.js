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
      '# Mode: ' + (mode === 'legacy' ? 'legacy/batch STF' : 'interactive ' + mode.toUpperCase()),
      '# ' + new Array(78).join('-')
    ];

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
      consoleLines.push('');
      files.push({ name: 'CONSOLE.txt', language: 'shell', content: consoleLines.join('\n') });
    }

    return { files: files, warnings: warnings, command: command };
  }

  TB.gen.register('3.06', 'cli', generate);
})(typeof window !== 'undefined' ? window : globalThis);
