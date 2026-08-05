param(
  [string]$VolumeName = "dermatitis-tracker-data",
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI를 찾을 수 없습니다."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "dermatitis-tracker-data-$timestamp.tar.gz"
$outputPath = Join-Path $OutputDirectory $archiveName
$backupRoot = (Resolve-Path $OutputDirectory).Path

docker run --rm `
  -v "${VolumeName}:/data:ro" `
  -v "${backupRoot}:/backup" `
  alpine tar czf "/backup/$archiveName" -C /data .

Write-Output "Backup created: $outputPath"
