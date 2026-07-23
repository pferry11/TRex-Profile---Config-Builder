/* T1 tier - artifact generation harness.
 *
 * Loads the app's real generators in Node (js/gen/* are plain classic scripts
 * with no DOM dependency - the same bootstrap tools/stl_import_coverage.js
 * uses), runs every committed fixture model through them, and writes the
 * resulting artifacts to disk for ArtifactValidator.py to check.
 *
 * No browser and no server: T1 is meant to be the cheap tier that runs before
 * any lab time is spent.
 *
 * Usage:
 *   node generate_artifacts.js <repoRoot> <fixturesJson> <outDir>
 * Prints a JSON manifest on the last stdout line:
 *   { ok, count, artifacts: [{ fixture, kind, file, path, bytes, warnings }] }
 */
'use strict';
var fs = require('fs');
var path = require('path');

var repoRoot = process.argv[2];
var fixturesJson = process.argv[3];
var outDir = process.argv[4];

if (!repoRoot || !fixturesJson || !outDir) {
  process.stderr.write('usage: generate_artifacts.js <repoRoot> <fixturesJson> <outDir>\n');
  process.exit(2);
}

/* Same load order as index.html / tests.html. Order matters: registry before
 * the generators that register into it, util before everything. */
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
var VERSION = '3.06';
/* Pinned date so generated headers are byte-stable between runs - the same
 * trick the golden tests use. */
var NOW = { now: '2026-07-23' };

/* Fixtures whose "model" is a server-registry entry rather than a builder
 * model; the cfg generator takes those directly. */
function kindOf(name, model) {
  if (model && model.kind) { return model.kind; }
  if (/^cfgServer/.test(name)) { return 'cfg'; }
  return null;
}

var fixtures = JSON.parse(fs.readFileSync(fixturesJson, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

var artifacts = [];
var errors = [];

Object.keys(fixtures).sort().forEach(function (name) {
  var model = fixtures[name];
  var kind = kindOf(name, model);
  if (!kind) { errors.push(name + ': could not determine kind'); return; }

  var gen = TB.gen.resolve(VERSION, kind);
  if (typeof gen !== 'function') {
    errors.push(name + ': no generator registered for ' + VERSION + '/' + kind);
    return;
  }

  var res;
  try {
    res = gen(model, NOW);
  } catch (e) {
    errors.push(name + ' (' + kind + '): generator threw: ' + e.message);
    return;
  }
  if (!res || !res.files || !res.files.length) {
    errors.push(name + ' (' + kind + '): generator produced no files');
    return;
  }

  /* One fixture can yield several files (profile + runbook + console block). */
  res.files.forEach(function (f) {
    var dest = path.join(outDir, name + '__' + f.name.replace(/[\\/]/g, '_'));
    fs.writeFileSync(dest, f.content, 'utf8');
    artifacts.push({
      fixture: name, kind: kind, file: f.name, path: dest,
      bytes: Buffer.byteLength(f.content, 'utf8'),
      warnings: res.warnings || []
    });
  });
});

process.stdout.write(JSON.stringify({
  ok: errors.length === 0,
  count: artifacts.length,
  fixtures: Object.keys(fixtures).length,
  errors: errors,
  artifacts: artifacts
}) + '\n');
process.exit(errors.length === 0 ? 0 : 1);
