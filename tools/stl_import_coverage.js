/* TRex Profile & Config Builder - STL re-import coverage harness (dev tool).
 *
 * Runs the real importer (js/core/import.js, no DOM needed) against the shipped
 * v3.06 stl/*.py profiles and reports how much of each file it can map back into
 * an editable model. Use it as the objective metric when closing STL import-
 * fidelity gaps: run before/after a change and watch the "100%" count.
 *
 * NOTE on expectations: unlike cap2 (declarative YAML), shipped STL profiles are
 * arbitrary Python (list-comprehensions, __init__ data tables, imperative STLVM,
 * conditionals). The offline JS parser maps our own generated shape 100% and the
 * simplest hand-written files partially; the realistic route to full corpus
 * coverage is the backend Python resolver (execute-not-parse) - see DESIGN notes.
 *
 * Requires a local v3.06 tree (intentionally not committed - see README). Usage:
 *   node tools/stl_import_coverage.js [repoRoot]
 * repoRoot defaults to the current working directory.
 */
'use strict';
var fs = require('fs');
var path = require('path');

var repoRoot = process.argv[2] || process.cwd();
require(path.join(repoRoot, 'js', 'core', 'import.js')); // attaches TB.imp to globalThis
var TB = globalThis.TB;

var root = path.join(repoRoot, 'v3.06', 'stl');
var files = [];
(function walk(dir) {
  try {
    fs.readdirSync(dir).forEach(function (f) {
      var p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { walk(p); }
      else if (/\.py$/.test(f)) { files.push(p); }
    });
  } catch (e) { /* dir may not exist */ }
})(root);

var unmapped = {}, full = 0, partial = 0, failed = 0, rows = [];
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8');
  var res = TB.imp.parse(t, { kind: 'stl' });
  var short = path.relative(root, f).replace(/\\/g, '/');
  if (!res.ok) { failed++; rows.push([short, 'FAIL', res.error]); return; }
  var pct = Math.round(res.coverage * 100);
  if (pct === 100) { full++; } else { partial++; }
  var shape = (res.model.streams || []).length + 'str' +
    (res.model.pcapReplay && res.model.pcapReplay.enabled ? ' pcap' : '');
  rows.push([short, pct + '%', res.mapped + '/' + res.total, shape, res.unmapped.slice(0, 4).join(' ; ')]);
  res.unmapped.forEach(function (u) {
    var k = (String(u).split(/[\s(=.]/)[0] || u).trim();
    if (k) { unmapped[k] = (unmapped[k] || 0) + 1; }
  });
});

console.log('stl .py files:', rows.length, '| 100%:', full, ' partial:', partial, ' failed:', failed);
console.log('\n--- most common UNMAPPED tokens (token -> #files) ---');
Object.keys(unmapped).sort(function (a, b) { return unmapped[b] - unmapped[a]; }).slice(0, 25)
  .forEach(function (k) { console.log(String(unmapped[k]).padStart(4), k); });
console.log('\n--- per-file (partial/fail only) ---');
rows.filter(function (r) { return r[1] !== '100%'; }).forEach(function (r) { console.log(r.join('  |  ')); });
