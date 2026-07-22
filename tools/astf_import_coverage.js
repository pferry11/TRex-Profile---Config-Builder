/* TRex Profile & Config Builder - ASTF re-import coverage harness (dev tool).
 *
 * Runs the real importer (js/core/import.js, no DOM needed) against the shipped
 * v3.06 astf/*.py profiles and reports how much of each file it can map back
 * into an editable model. The objective metric when closing ASTF import gaps.
 *
 * As with STL, shipped ASTF profiles are arbitrary Python (get_profile builds
 * templates/programs with loops, helpers, conditionals), so the offline parser
 * maps our own generated shape 100% and simpler hand-written files partially;
 * full corpus coverage is the job of the backend Python resolver (phase A3c).
 *
 * Requires a local v3.06 tree (not committed - see README). Usage:
 *   node tools/astf_import_coverage.js [repoRoot]
 */
'use strict';
var fs = require('fs');
var path = require('path');

var repoRoot = process.argv[2] || process.cwd();
require(path.join(repoRoot, 'js', 'core', 'import.js')); // attaches TB.imp to globalThis
var TB = globalThis.TB;

var root = path.join(repoRoot, 'v3.06', 'astf');
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
  var res = TB.imp.parse(t, { kind: 'astf' });
  var short = path.relative(root, f).replace(/\\/g, '/');
  if (!res.ok) { failed++; rows.push([short, 'FAIL', res.error]); return; }
  var pct = Math.round(res.coverage * 100);
  if (pct === 100) { full++; } else { partial++; }
  var shape = res.model.mode + (res.model.mode === 'pcap'
    ? ' ' + (res.model.capList || []).length + 'cap'
    : ' ' + (res.model.templates || []).length + 'tmpl');
  rows.push([short, pct + '%', res.mapped + '/' + res.total, shape, res.unmapped.slice(0, 4).join(' ; ')]);
  res.unmapped.forEach(function (u) {
    var k = (String(u).split(/[\s(=.]/)[0] || u).trim();
    if (k) { unmapped[k] = (unmapped[k] || 0) + 1; }
  });
});

console.log('astf .py files:', rows.length, '| 100%:', full, ' partial:', partial, ' failed:', failed);
console.log('\n--- most common UNMAPPED tokens (token -> #files) ---');
Object.keys(unmapped).sort(function (a, b) { return unmapped[b] - unmapped[a]; }).slice(0, 25)
  .forEach(function (k) { console.log(String(unmapped[k]).padStart(4), k); });
console.log('\n--- per-file (partial/fail only) ---');
rows.filter(function (r) { return r[1] !== '100%'; }).forEach(function (r) { console.log(r.join('  |  ')); });
