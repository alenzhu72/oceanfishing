$ErrorActionPreference = "Stop"

$caddy = Join-Path $PSScriptRoot "bin\caddy.exe"
$config = Join-Path $PSScriptRoot "Caddyfile"

if (-not (Test-Path $caddy)) {
  throw "Missing $caddy. Run install.ps1 first."
}

& $caddy run --config $config --adapter caddyfile
