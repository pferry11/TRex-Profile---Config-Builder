/* TRex Profile & Config Builder - shared CLI plumbing for the three
 * *_import_coverage.js dev tools.
 *
 * The tools started life as human-readable reports (run them, read the "100%"
 * count). The Robot harness (tests/robot suites/t2_import_fidelity.robot) needs
 * the same numbers as data, and needs a non-zero exit when coverage regresses,
 * so the baselines in the README become defended rather than merely documented.
 *
 * Flags (all optional; the bare "node tool.js [repoRoot]" form is unchanged):
 *   --json           emit one line of JSON instead of the human report
 *   --min-full N     exit 1 if fewer than N files map at 100%
 *   --quiet          suppress the human report (implied by --json)
 */
'use strict';

/* Parse argv tail (process.argv.slice(2)). First non-flag arg is repoRoot. */
function parseArgs(argv) {
  var out = { repoRoot: null, json: false, minFull: null, quiet: false };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--json') { out.json = true; }
    else if (a === '--quiet') { out.quiet = true; }
    else if (a === '--min-full') { out.minFull = parseInt(argv[++i], 10); }
    else if (a.indexOf('--min-full=') === 0) { out.minFull = parseInt(a.slice('--min-full='.length), 10); }
    else if (a.charAt(0) === '-') {
      process.stderr.write('unknown flag: ' + a + '\n');
      process.exit(2);
    } else if (out.repoRoot === null) { out.repoRoot = a; }
  }
  if (out.minFull !== null && isNaN(out.minFull)) {
    process.stderr.write('--min-full needs an integer\n');
    process.exit(2);
  }
  out.repoRoot = out.repoRoot || process.cwd();
  return out;
}

/* Emit the report and apply the gate. `stats` is
 * { kind, headline, full, partial, failed, unmapped, rows }.
 * Exits non-zero (and never returns) when a --min-full gate fails. */
function report(args, stats) {
  var total = stats.full + stats.partial + stats.failed;

  if (args.json) {
    process.stdout.write(JSON.stringify({
      kind: stats.kind, total: total, full: stats.full,
      partial: stats.partial, failed: stats.failed,
      minFull: args.minFull,
      ok: args.minFull === null || stats.full >= args.minFull
    }) + '\n');
  } else if (!args.quiet) {
    console.log(stats.headline, total, '| 100%:', stats.full,
                ' partial:', stats.partial, ' failed:', stats.failed);
    console.log('\n--- most common UNMAPPED tokens (token -> #files) ---');
    Object.keys(stats.unmapped)
      .sort(function (a, b) { return stats.unmapped[b] - stats.unmapped[a]; })
      .slice(0, 25)
      .forEach(function (k) { console.log(String(stats.unmapped[k]).padStart(4), k); });
    console.log('\n--- per-file (partial/fail only) ---');
    stats.rows.filter(function (r) { return r[1] !== '100%'; })
      .forEach(function (r) { console.log(r.join('  |  ')); });
  }

  if (args.minFull !== null && stats.full < args.minFull) {
    process.stderr.write('COVERAGE REGRESSION: ' + stats.kind + ' maps ' + stats.full +
      ' files at 100%, below the required ' + args.minFull + '\n');
    process.exit(1);
  }
}

module.exports = { parseArgs: parseArgs, report: report };
