param(
  [switch]$Initial
)

$ErrorActionPreference = "Stop"
$envPath = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envPath)) {
  throw "Missing $envPath. Run install.ps1 first."
}

$settings = @{}
Get-Content $envPath | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#")) {
    $parts = $line.Split("=", 2)
    if ($parts.Count -eq 2) {
      $settings[$parts[0]] = $parts[1]
    }
  }
}

if (-not $settings.SEED_KEY) {
  throw "SEED_KEY is missing from $envPath"
}

$today = (Get-Date).ToUniversalTime().Date
$start = if ($Initial) { $today.AddDays(-364) } else { $today.AddDays(-7) }
$end = if ($Initial) { [DateTime]::Parse("2027-12-31") } else { $today.AddDays(16) }
$headers = @{ "x-seed-key" = $settings.SEED_KEY }
$areas = @("singapore_4h", "tioman_4h", "bali_4h", "maldives_4h")

foreach ($area in $areas) {
  $url = "http://127.0.0.1:5173/api/seed?areaId=$area&start=$($start.ToString('yyyy-MM-dd'))&end=$($end.ToString('yyyy-MM-dd'))&source=real"
  try {
    Invoke-RestMethod -Method Post -Uri $url -Headers $headers
  } catch {
    Write-Warning "Real marine data refresh failed for $area; falling back to mock data. $($_.Exception.Message)"
    $fallbackUrl = "http://127.0.0.1:5173/api/seed?areaId=$area&start=$($start.ToString('yyyy-MM-dd'))&end=$($end.ToString('yyyy-MM-dd'))&source=mock"
    Invoke-RestMethod -Method Post -Uri $fallbackUrl -Headers $headers
  }
}
