$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run PowerShell as Administrator."
}

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$binDir = Join-Path $PSScriptRoot "bin"
$envPath = Join-Path $PSScriptRoot ".env"
$caddy = Join-Path $binDir "caddy.exe"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Get-Command node.exe -ErrorAction Stop | Out-Null
Get-Command npm.cmd -ErrorAction Stop | Out-Null

New-Item -ItemType Directory -Force -Path $binDir | Out-Null
if (-not (Test-Path $caddy)) {
  Invoke-WebRequest "https://caddyserver.com/api/download?os=windows&arch=amd64" -OutFile $caddy -UseBasicParsing
}

if (-not (Test-Path $envPath)) {
  $seedKey = -join ((1..48) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
  @(
    "NODE_ENV=production"
    "PORT=5173"
    "SEED_KEY=$seedKey"
  ) | Set-Content -Encoding ASCII $envPath
}

Push-Location (Join-Path $repoRoot "server")
try {
  & npm.cmd install --omit=dev
} finally {
  Pop-Location
}

if (-not (Get-NetFirewallRule -DisplayName "OceanFishing HTTP" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "OceanFishing HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow | Out-Null
}
if (-not (Get-NetFirewallRule -DisplayName "OceanFishing HTTPS" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "OceanFishing HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow | Out-Null
}

$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$serverArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\run-server.ps1`""
$caddyArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\run-caddy.ps1`""
$refreshArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\refresh-data.ps1`""

$startup = New-ScheduledTaskTrigger -AtStartup
$daily = New-ScheduledTaskTrigger -Daily -At 2:10AM
$system = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable

Register-ScheduledTask -TaskName "OceanFishing Node" -Action (New-ScheduledTaskAction -Execute $powerShell -Argument $serverArgs) -Trigger $startup -Principal $system -Settings $settings -Force | Out-Null
Register-ScheduledTask -TaskName "OceanFishing Caddy" -Action (New-ScheduledTaskAction -Execute $powerShell -Argument $caddyArgs) -Trigger $startup -Principal $system -Settings $settings -Force | Out-Null
Register-ScheduledTask -TaskName "OceanFishing Refresh" -Action (New-ScheduledTaskAction -Execute $powerShell -Argument $refreshArgs) -Trigger $daily -Principal $system -Force | Out-Null

Start-ScheduledTask -TaskName "OceanFishing Node"
Start-Sleep -Seconds 3
Start-ScheduledTask -TaskName "OceanFishing Caddy"

Write-Host "Installed. Seed initial data with:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\refresh-data.ps1`" -Initial"
Write-Host "Then verify: https://fish.britesky.net/api/health"
