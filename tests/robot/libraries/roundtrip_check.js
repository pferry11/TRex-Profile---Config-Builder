/* T2 tier - byte-identical round-trip check.
 *
 * The README promises that a profile this tool generated re-imports and
 * regenerates byte-identically ("body is the source of truth"). tests.html
 * asserts that for its own fixtures; this asserts it for every committed
 * fixture, per format, as a gate rather than a sample - and reports which
 * fixture broke rather than just "a round-trip failed".
 *
 * generate -> TB.imp.parse -> regenerate -> compare.
 *
 * Usage:  node roundtrip_check.js <repoRoot> <fixturesJson>
 * Prints a JSON summary on the last stdout line; exit 1 on any mismatch.
 */
'use strict';
var fs = require('fs');
var path = require('path');

var repoRoot = process.argv[2];
var fixturesJson = process.argv[3];
if (!repoRoot || !fixturesJson) {
  process.stderr.write('usage: roundtrip_check.js <repoRoot> <fixturesJson>\n');
  process.exit(2);
}

[
  'js/core/util.js', 'js/core/zip.js', 'js/core/publish.js', 'js/core/history.js',
  'js/core/store.js', 'js/core/persist.js', 'js/core/settings.js', 'js/core/backend.js',
  'js/core/import.js',
  'js/gen/registry.js', 'js/gen/py.js', 'js/gen/summarize.js', 'js/gen/stl.js',
  'js/gen/astf.js', 'js/gen/scenarios.js', 'js/gen/cfg.js', 'js/gen/cli.js',
  'js/gen/cap2.js', 'js/gen/emu.js', 'js/gen/tpg.js', 'js/gen/bird.js'
].forEach(function (rel) {
  require(path.join(repoRoot, rel.replace(/\//g, path.sep)));
});

var TB = globalThis.TB;
var NOW = { now: '2026-07-23' };

/* Formats with a re-import path (the "Open profile..." action). cfg, cli, emu,
 * tpg and bird have no importer - they are generate-only, so they are reported
 * as skipped rather than silently ignored. */
var IMPORTABLE = { stl: true, astf: true, cap2: true };

/* Documented, intentional round-trip gaps. Each entry must STILL FAIL: if one
 * starts round-tripping cleanly the check reports it, so this list cannot rot
 * into a permanent excuse. Fix the app, then delete the entry. */
var KNOWN_LIMITATIONS = {
  fxAstfGtpu: 'GTP-U tunnel topology lives in a companion _topo.py which is ' +
              'deliberately not re-imported (js/core/import.js:732), so the ' +
              'tunnelsTopo block returns to defaults on reload.'
};

function firstDiff(a, b) {
  var la = a.split('\n'), lb = b.split('\n');
  for (var i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      return 'line ' + (i + 1) + '\n  expected: ' + JSON.stringify(la[i]) +
             '\n  actual:   ' + JSON.stringify(lb[i]);
    }
  }
  return 'files differ in length only';
}

var fixtures = JSON.parse(fs.readFileSync(fixturesJson, 'utf8'));
var checked = [], skipped = [], failures = [], knownStillBroken = [], knownNowFixed = [];

Object.keys(fixtures).sort().forEach(function (name) {
  var model = fixtures[name];
  var kind = model && model.kind;
  if (!kind || !IMPORTABLE[kind]) { skipped.push(name); return; }

  var gen = TB.gen.resolve('3.06', kind);
  var once = gen(model, NOW).files[0].content;

  var res = TB.imp.parse(once, { kind: kind });
  var problem = null;

  if (!res.ok) {
    problem = { stage: 'parse', detail: res.error };
  } else if (res.coverage !== 1) {
    /* A file this tool generated must map fully - anything less means a field
       was emitted that no reader reverses, which is exactly the drift the
       one-line trexb tag is supposed to make impossible. */
    problem = { stage: 'coverage',
                detail: 'coverage ' + res.coverage + ', unmapped: ' +
                        (res.unmapped || []).slice(0, 6).join(' ; ') };
  } else {
    /* The profile name is not stored in the file body - it is the filename.
       The UI restores it from the chosen file (js/ui/cap2_builder.js:194,
       js/ui/astf_builder.js), so replicate that here; otherwise every
       comparison fails on the "# Run: ..." header for the wrong reason. */
    res.model.meta.name = model.meta.name;
    var twice = gen(res.model, NOW).files[0].content;
    if (once !== twice) {
      problem = { stage: 'regenerate', detail: firstDiff(once, twice) };
    }
  }

  var known = KNOWN_LIMITATIONS[name];
  if (problem && known) {
    knownStillBroken.push({ fixture: name, kind: kind, reason: known, stage: problem.stage });
  } else if (problem) {
    failures.push(Object.assign({ fixture: name, kind: kind }, problem));
  } else if (known) {
    knownNowFixed.push({ fixture: name, kind: kind, reason: known });
  } else {
    checked.push({ fixture: name, kind: kind });
  }
});

process.stdout.write(JSON.stringify({
  ok: failures.length === 0,
  checked: checked.length,
  skipped: skipped.length,
  skippedFixtures: skipped,
  knownStillBroken: knownStillBroken,
  knownNowFixed: knownNowFixed,
  failures: failures
}) + '\n');
process.exit(failures.length === 0 ? 0 : 1);
