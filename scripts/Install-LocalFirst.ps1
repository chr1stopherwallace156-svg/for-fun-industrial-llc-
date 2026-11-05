[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$nodeVersion = (& $Node --version).Trim()
if ([version]($nodeVersion.TrimStart("v")) -lt [version]"22.23.4") { throw "Node.js 22.23.4 or newer is required; found $nodeVersion." }
$Port = 8788
$ComputePort = 8791
$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($listener) { throw "Port $Port is already occupied. No process was stopped." }
if (-not (Test-Path (Join-Path $Root ".env"))) {
  $reaRoot = Join-Path $Root ".runtime\rea"
  New-Item -ItemType Directory -Force -Path $reaRoot | Out-Null
  $reaEntry = Join-Path $reaRoot "node_modules\rea-agents\scripts\rea.mjs"
  $envLines = @(
    "HOST=127.0.0.1",
    "PORT=$Port",
    "LOCAL_FIRST_MODE=true",
    "VPN_REQUIRED=true",
    "VPN_REQUIRE_EXIT_NODE=true",
    "NETBIRD_ENABLED=true",
    "REA_ENABLED=true",
    "REA_COMMAND=$Node",
    "REA_ARGS=$reaEntry,mcp",
    "REA_REQUIRES_VPN=false",
    "REA_ALLOWED_TOOLS=",
    "COMPUTE_ENABLED=false",
    "COMPUTE_PORT=$ComputePort",
    "AI_ENABLED=true",
    "AI_AUTOSTART=true",
    "LLAMA_CPP_SERVER=",
    "LLAMA_CPP_MODEL="
  )
  [System.IO.File]::WriteAllLines((Join-Path $Root ".env"), $envLines, [System.Text.UTF8Encoding]::new($false))
} else {
  $envText = Get-Content (Join-Path $Root ".env") -Raw
  if ($envText -notmatch "(?m)^LOCAL_FIRST_MODE=true\s*$") { throw "Existing .env found without LOCAL_FIRST_MODE=true. Refusing to overwrite or modify it." }
}
& $Npm install --prefix (Join-Path $Root ".runtime\rea") --ignore-scripts --no-audit --no-fund "rea-agents@6.8.0"
if ($LASTEXITCODE -ne 0) { throw "Pinned REA MCP package installation failed." }
$reaEntry = Join-Path $Root ".runtime\rea\node_modules\rea-agents\scripts\rea.mjs"
if (-not (Test-Path $reaEntry)) { throw "REA MCP entrypoint not found: $reaEntry" }
& $Node --check (Join-Path $Root "src\server.mjs")
if ($LASTEXITCODE -ne 0) { throw "Server syntax check failed." }
& $Npm test
if ($LASTEXITCODE -ne 0) { throw "Tests failed; activation stopped." }
$env:PORT = "$Port"
$env:COMPUTE_PORT = "$ComputePort"
$logDir = Join-Path $Root "reports"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$log = Join-Path $logDir "local-first-$stamp.log"
$err = "$log.err"
$proc = Start-Process -FilePath $Node -ArgumentList (Join-Path $Root "src\server.mjs") -WorkingDirectory $Root -PassThru -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err
$ready = $false
for ($i=0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try { $status = Invoke-RestMethod "http://127.0.0.1:$Port/api/status" -TimeoutSec 2; if ($status.application -eq "Fun Industrial Platform") { $ready = $true; break } } catch {}
}
if (-not $ready) { throw "Local dashboard did not become ready. Process PID $($proc.Id) was left running for inspection; see $err" }
$activation = Invoke-RestMethod "http://127.0.0.1:$Port/api/activate" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 180
$activation | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 (Join-Path $logDir "local-first-activation-$stamp.json")
Write-Host "=== LOCAL-FIRST ACTIVATION ===" -ForegroundColor Cyan
Write-Host "Dashboard: http://127.0.0.1:$Port"
Write-Host "PID: $($proc.Id)"
$activation.results | Format-Table id,state,detail -Wrap
Write-Host "REA_ALLOWED_TOOLS remains empty; REA catalogue is discovery-only."
Write-Host "AI remains not-configured until LLAMA_CPP_SERVER and LLAMA_CPP_MODEL point to valid local files."
Start-Process "http://127.0.0.1:$Port"
