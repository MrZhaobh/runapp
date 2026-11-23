param(
    [switch]$Lan
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $Root "logs"
$LogFile = Join-Path $LogDir "static-server.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $Root

$BindAddress = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
python3 "$Root\static_server.py" --host $BindAddress --port 8000 --directory "$Root" --index "depplink测试.html" *> $LogFile
exit $LASTEXITCODE
