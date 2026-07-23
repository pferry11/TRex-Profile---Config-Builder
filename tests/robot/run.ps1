<#
.SYNOPSIS
    Runs the TRex Builder test harness.

.DESCRIPTION
    Wraps `robot` with the two things that are easy to get wrong by hand:

      * PYTHONIOENCODING=utf-8. Without it, Robot crashes on this Windows
        console with "unknown encoding: utf-8:surrogateescape" while printing
        its own output - the run is fine, the printing is not.
      * the topology variable file, which supplies the traffic thresholds. The
        same suites serve looped / DUT / two-box labs; only this file changes.

.PARAMETER Topology
    loop (default), dut, or dual. Selects variables/env_<topology>.py and the
    matching --include tag for the lab tiers.

.PARAMETER Suite
    Optional suite name (e.g. t1_static) to run just one tier. Default: all.

.PARAMETER NoLab
    Run only the tiers that need no TRex box (T0, T1, T2, T4). This is the
    default set on a machine with no lab reachable.

.PARAMETER Headed
    Show the browser instead of running headless - useful when demonstrating
    the UI tier rather than just asserting on it.

.EXAMPLE
    .\tests\robot\run.ps1 -NoLab
.EXAMPLE
    .\tests\robot\run.ps1 -Topology dut
.EXAMPLE
    .\tests\robot\run.ps1 -Suite t1_static
#>
param(
    [ValidateSet('loop', 'dut', 'dual')][string]$Topology = 'loop',
    [string]$Suite,
    [switch]$NoLab,
    [switch]$Headed
)

$ErrorActionPreference = 'Stop'
$robotRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $robotRoot)

$env:PYTHONIOENCODING = 'utf-8'

$target = if ($Suite) { Join-Path $robotRoot "suites\$Suite.robot" } else { Join-Path $robotRoot 'suites' }
if (-not (Test-Path $target)) { throw "no such suite: $target" }

$robotArgs = @(
    '--outputdir', (Join-Path $robotRoot 'results')
    '--variablefile', (Join-Path $robotRoot "variables\env_$Topology.py")
    # The fixture-capture task is a maintenance job, never part of a run.
    '--exclude', 'maintenance'
)

if ($NoLab) { $robotArgs += @('--include', 'nolab') }
else { $robotArgs += @('--include', "nolabOR$Topology") }

if ($Headed) { $robotArgs += @('--variable', 'BROWSER_HEADLESS:False') }

$robotArgs += $target

Push-Location $repoRoot
try {
    Write-Host "robot $($robotArgs -join ' ')" -ForegroundColor DarkGray
    & python -m robot @robotArgs
    $rc = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($rc -eq 0) { Write-Host "`nAll tests passed." -ForegroundColor Green }
else { Write-Host "`n$rc test(s) failed - see tests/robot/results/report.html" -ForegroundColor Red }
exit $rc
