# ============================================================
#  Publish your cookbook!  (run via publish.bat)
#  Finds your latest export in Downloads, makes it the shared
#  cookbook, and pushes it live for both of you.
# ============================================================
$ErrorActionPreference = "Stop"
$repo = $PSScriptRoot
$downloads = Join-Path $env:USERPROFILE "Downloads"

Write-Host ""
Write-Host "  ~*~ Melissa's Cookbook publisher ~*~"
Write-Host ""

$exports = Get-ChildItem -Path $downloads -Filter "melissas-cookbook-*.json" -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending

if (-not $exports) {
  Write-Host "  Hmm, no export found in your Downloads folder."
  Write-Host "  Open the cookbook, click the ... menu -> 'Export recipes',"
  Write-Host "  then double-click publish.bat again!"
  Write-Host ""
  Read-Host  "  Press Enter to close"
  exit 1
}

$latest = $exports | Select-Object -First 1
$age = (Get-Date) - $latest.LastWriteTime
$ageText = if ($age.TotalMinutes -lt 90) { "$([math]::Round($age.TotalMinutes)) minutes ago" }
           elseif ($age.TotalHours -lt 36) { "$([math]::Round($age.TotalHours)) hours ago" }
           else { "$([math]::Round($age.TotalDays)) days ago" }

Write-Host "  Found:   $($latest.Name)"
Write-Host "  Created: $ageText"
if ($age.TotalHours -gt 12) {
  Write-Host ""
  Write-Host "  ! That export is a bit old. If you've added recipes since,"
  Write-Host "    close this, export a fresh one, and run me again."
}
Write-Host ""
Read-Host "  Press Enter to publish it (or just close this window to cancel)"

Copy-Item -Path $latest.FullName -Destination (Join-Path $repo "recipes.json") -Force

git -C "$repo" add recipes.json
$pending = git -C "$repo" status --porcelain
if (-not $pending) {
  Write-Host ""
  Write-Host "  Nothing new to publish - the site already matches this export!"
  Read-Host  "  Press Enter to close"
  exit 0
}

git -C "$repo" commit -m "Publish recipes" | Out-Null
git -C "$repo" push
Write-Host ""
Write-Host "  Published! Give it a minute or two to go live,"
Write-Host "  then tell him to refresh the page <3"
Write-Host ""
Read-Host "  Press Enter to close"
