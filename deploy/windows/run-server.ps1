$ErrorActionPreference = "Stop"

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$envPath = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envPath)) {
  throw "Missing $envPath. Run install.ps1 first."
}

Get-Content $envPath | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#")) {
    $parts = $line.Split("=", 2)
    if ($parts.Count -eq 2) {
      [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
    }
  }
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
Set-Location (Join-Path $repoRoot "server")

while ($true) {
  & $node "index.js"
  Start-Sleep -Seconds 5
}
