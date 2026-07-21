/* TRex Profile & Config Builder - cap2 re-import coverage harness (dev tool).
 *
 * Runs the real importer (js/core/import.js, no DOM needed) against the shipped
 * v3.06 cap2/avl YAML profiles and reports how much of each file it can map back
 * into an editable model. Use it as the objective metric when closing cap2
 * import-fidelity gaps: run before/after a change and watch the "100%" count.
 *
 * Requires a local v3.06 tree (the TRex distribution used as format reference;
 * intentionally not committed - see README). Usage:
 *   node tools/cap2_import_coverage.js [repoRoot]
 * repoRoot defaults to the current working directory.
 */
'use strict';
var fs = require('fs');
var path = require('path');

var repoRoot = process.argv[2] || process.cwd();
require(path.join(repoRoot, 'js', 'core', 'import.js')); // attaches TB.imp to globalThis
var TB = globalThis.TB;

var roots = [path.join(repoRoot, 'v3.06', 'cap2'), path.join(repoRoot, 'v3.06', 'avl')];
var files = [];
roots.forEach(function (r) {
  try { fs.readdirSync(r).forEach(function (f) { if (/\.yaml$/.test(f)) { files.push(path.join(r, f)); } }); }
  catch (e) { /* dir may not exist */ }
});

var unmapped = {}, full = 0, partial = 0, failed = 0, rows = [];
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8');
  if (!/cap_info/.test(t)) { return; }
  var res = TB.imp.parse(t, { kind: 'cap2' });
  var short = f.split(/[\\/]/).slice(-2).join('/');
  if (!res.ok) { failed++; rows.push([short, 'FAIL', res.error]); return; }
  var pct = Math.round(res.coverage * 100);
  if (pct === 100) { full++; } else { partial++; }
  rows.push([short, pct + '%', res.mapped + '/' + res.total, (res.model.capInfo || []).length + 'cap',
             res.unmapped.slice(0, 4).join(' ; ')]);
  res.unmapped.forEach(function (u) {
    var k = (u.split(':')[0] || u).trim().split(/\s+/)[0];
    unmapped[k] = (unmapped[k] || 0) + 1;
  });
});

console.log('files with cap_info:', rows.length, '| 100%:', full, ' partial:', partial, ' failed:', failed);
console.log('\n--- most common UNMAPPED tokens (token -> #files) ---');
Object.keys(unmapped).sort(function (a, b) { return unmapped[b] - unmapped[a]; }).slice(0, 25)
  .forEach(function (k) { console.log(String(unmapped[k]).padStart(4), k); });
console.log('\n--- per-file (partial/fail only) ---');
rows.filter(function (r) { return r[1] !== '100%'; }).forEach(function (r) { console.log(r.join('  |  ')); });
