# TRex Profile & Config Builder - capture UI screenshots for the Manual tab.
# Uses headless Microsoft Edge (built into Windows) and the app's ?tab= deep links.
# Re-run whenever the UI changes:  powershell -File tools\screenshots.ps1

$repo = Split-Path -Parent $PSScriptRoot
$imgDir = Join-Path $repo "docs\img"
if (-not (Test-Path $imgDir)) { New-Item -ItemType Directory -Force $imgDir | Out-Null }

$edge = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $edge) { Write-Error "Microsoft Edge not found"; exit 1 }

$index = (Join-Path $repo "index.html") -replace '\\', '/'
$tabs = @("stl", "astf", "cap2", "scenarios", "cfg", "cli", "settings")

foreach ($tab in $tabs) {
    $out = Join-Path $imgDir "$tab.png"
    $url = "file:///$index`?tab=$tab"
    Write-Host "capturing $tab -> $out"
    & $edge --headless --disable-gpu --window-size=1500,950 --hide-scrollbars `
        --virtual-time-budget=4000 --screenshot="$out" $url 2>$null | Out-Null
    Start-Sleep -Milliseconds 400
    if (Test-Path $out) {
        $kb = [math]::Round((Get-Item $out).Length / 1KB)
        Write-Host "  ok ($kb KB)"
    } else {
        Write-Warning "  FAILED: $tab"
    }
}
Write-Host "done - images in docs/img/"
