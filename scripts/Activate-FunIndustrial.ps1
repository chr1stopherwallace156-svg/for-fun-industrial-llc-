[CmdletBinding()]
param([switch]$SkipNetBirdInstall,[switch]$SkipNetBirdLogin)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ReportDir = Join-Path $RepoRoot "reports"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $ReportDir "windows-activation-$Stamp.json"
$Results = [ordered]@{started_at=(Get-Date).ToString("o");repository=$RepoRoot;steps=@();final_state="RUNNING"}
function Add-Result([string]$Name,[string]$State,[string]$Detail) {
 $Results.steps += [ordered]@{name=$Name;state=$State;detail=$Detail}
 $color=if($State -eq "PASS"){"Green"}elseif($State -eq "WARN"){"Yellow"}else{"Red"}
 Write-Host ("[{0}] {1} - {2}" -f $State,$Name,$Detail) -ForegroundColor $color
}
function Require-Command([string]$Name,[string]$Hint) {
 $cmd=Get-Command $Name -ErrorAction SilentlyContinue
 if(-not $cmd){throw "$Name not found. $Hint"}
 return $cmd.Source
}
try {
 if($env:OS -ne "Windows_NT"){throw "Run this script on Windows."}
 $Git=Require-Command "git.exe" "Install Git for Windows."
 $Node=Require-Command "node.exe" "Install Node.js 22 LTS or newer."
 $Npm=Require-Command "npm.cmd" "Install Node.js 22 LTS or newer."
 $Python=Get-Command "py.exe" -ErrorAction SilentlyContinue
 if(-not $Python){$Python=Get-Command "python.exe" -ErrorAction SilentlyContinue}
 if(-not $Python){throw "Install Python 3.12 and rerun."}
 if($Python.Name -ne "py.exe"){$pyVersion=(& $Python.Source --version 2>&1 | Out-String).Trim();if($pyVersion -notmatch "^Python 3\.12\."){throw "Python 3.12 is required for this pinned CPU compute release. Found $pyVersion. Install Python 3.12 and rerun."}}
 $nodeVersion=(& $Node --version).Trim()
 if([version]($nodeVersion.TrimStart("v")) -lt [version]"22.23.4"){throw "Node.js 22.23.4 or newer required; found $nodeVersion"}
 Add-Result "Prerequisites" "PASS" "Git and Node $nodeVersion found."
 $branch=(& $Git -C $RepoRoot branch --show-current).Trim()
 if($branch -ne "integration/bootstrap-architecture-v1"){Add-Result "Git branch" "WARN" "Running from $branch; expected integration/bootstrap-architecture-v1. No branch switch performed."}else{Add-Result "Git branch" "PASS" $branch}
 $venv=Join-Path $RepoRoot ".venv"
 $pythonExe=Join-Path $venv "Scripts\python.exe"
 if(-not(Test-Path $pythonExe)){
  if($Python.Name -eq "py.exe"){& $Python.Source -3.12 -m venv $venv}else{& $Python.Source -m venv $venv}
  if($LASTEXITCODE -ne 0){throw "Could not create Python 3.12 venv. Ensure Python 3.12 is installed."}
 }
 & $pythonExe -m pip install --upgrade pip
 if($LASTEXITCODE -ne 0){throw "pip upgrade failed."}
 & $pythonExe -m pip install -r (Join-Path $RepoRoot "requirements-compute.txt")
 if($LASTEXITCODE -ne 0){throw "Compute dependencies installation failed."}
 & $pythonExe -m pip install torch==2.7.0 --extra-index-url https://download.pytorch.org/whl/cpu
 if($LASTEXITCODE -ne 0){throw "CPU PyTorch installation failed."}
 & $pythonExe -m pytest (Join-Path $RepoRoot "compute_service\test_compute.py") -q
 if($LASTEXITCODE -ne 0){throw "Graph/tensor/neural tests failed."}
 & $pythonExe -m pip freeze --all | Set-Content -Encoding UTF8 (Join-Path $ReportDir "compute-environment-$Stamp.txt")
 Add-Result "Compute engine" "PASS" "Python direct dependencies installed in isolated .venv; tests passed. Resolved environment recorded."
 Push-Location $RepoRoot
 try {
  & $Npm install --ignore-scripts
  if($LASTEXITCODE -ne 0){throw "npm install failed."}
  & $Npm run check
  if($LASTEXITCODE -ne 0){throw "Node syntax validation failed."}
  & $Npm test
  if($LASTEXITCODE -ne 0){throw "Node tests failed."}
 } finally {Pop-Location}
 Add-Result "Node application" "PASS" "Dependencies installed; syntax and tests passed."
 $envFile=Join-Path $RepoRoot ".env"
 if(-not(Test-Path $envFile)){
 @"
HOST=127.0.0.1
PORT=8787
REA_ENABLED=false
REA_COMMAND=rea
REA_ARGS=mcp
NETBIRD_ENABLED=true
NETBIRD_COMMAND=netbird
NETBIRD_AUTOCONNECT=false
COMPUTE_ENABLED=true
COMPUTE_COMMAND=$pythonExe
COMPUTE_PORT=8790
"@ | Set-Content -Encoding UTF8 $envFile
  Add-Result "Configuration" "PASS" "Created loopback-only .env. REA remains disabled until installed and enabled."
 }else{
  $existing=Get-Content $envFile -Raw
  if($existing -notmatch "(?m)^HOST=127\.0\.0\.1\s*$"){throw ".env must retain HOST=127.0.0.1. Unsafe binding refused."}
  $required = @("COMPUTE_ENABLED=true","COMPUTE_COMMAND=$pythonExe","COMPUTE_PORT=8790","NETBIRD_ENABLED=true")
  foreach($line in $required){$key=$line.Split("=")[0];if($existing -notmatch ("(?m)^"+[regex]::Escape($key)+"=")){Add-Content -Encoding UTF8 $envFile $line}}
  Add-Result "Configuration" "PASS" "Existing .env preserved; missing compute and NetBird settings appended without overwriting existing values."
 }
 if(-not $SkipNetBirdInstall){
  $winget=Get-Command "winget.exe" -ErrorAction SilentlyContinue
  if(-not $winget){Add-Result "NetBird install" "WARN" "winget unavailable; install using https://docs.netbird.io/get-started/install/windows."}
  else{
   & $winget.Source install --id Netbird.NetBird --exact --accept-package-agreements --accept-source-agreements
   if($LASTEXITCODE -ne 0){Add-Result "NetBird install" "WARN" "winget returned $LASTEXITCODE; check whether NetBird is already installed."}else{Add-Result "NetBird install" "PASS" "NetBird package installation completed."}
  }
 }
 $netbird=Get-Command "netbird.exe" -ErrorAction SilentlyContinue
 if(-not $netbird -and (Test-Path "C:\Program Files\NetBird\netbird.exe")){$netbird=Get-Item "C:\Program Files\NetBird\netbird.exe"}
 if($netbird){
  $nbVersion=(& $netbird.Source version 2>&1 | Out-String).Trim()
  Add-Result "NetBird client" "PASS" $nbVersion
  $netbirdConfigured=Get-Content $envFile | Where-Object { $_ -match "^NETBIRD_ENABLED=" } | Select-Object -Last 1
  if($netbirdConfigured -match "^NETBIRD_ENABLED=false$"){Add-Result "VPN activation" "WARN" "NETBIRD_ENABLED=false is preserved in .env; no connection command issued."}
  elseif(-not $SkipNetBirdLogin){
   Write-Host "NetBird may open browser-based SSO. Complete sign-in there; do not paste setup keys into this terminal." -ForegroundColor Cyan
   & $netbird.Source up
   if($LASTEXITCODE -eq 0){Add-Result "VPN activation" "PASS" "NetBird up completed."}else{Add-Result "VPN activation" "WARN" "NetBird up returned $LASTEXITCODE; complete SSO and connect from dashboard."}
   $nbStatus=(& $netbird.Source status -d 2>&1 | Out-String)
   if($nbStatus -match "(?i)daemon status:\s*connected"){Add-Result "VPN status" "PASS" "Daemon reports connected; peer policy/reachability still need verification."}
   else{Add-Result "VPN status" "WARN" "Daemon is not reporting Connected. Complete SSO or inspect the NetBird client UI; detailed peer data is intentionally omitted from the report."}
  }else{Add-Result "VPN activation" "WARN" "Skipped by operator option."}
 }else{Add-Result "NetBird client" "WARN" "Not detected; VPN controls remain unavailable until installed."}
 $listener=Get-NetTCPConnection -State Listen -LocalPort 8787 -ErrorAction SilentlyContinue
 if(-not $listener){
  $serverLog=Join-Path $ReportDir "platform-server-$Stamp.log"
  Start-Process -FilePath $Node -ArgumentList "src/server.mjs" -WorkingDirectory $RepoRoot -RedirectStandardOutput $serverLog -RedirectStandardError ($serverLog+".err") -WindowStyle Hidden
  Start-Sleep -Seconds 3
 }
 try{
  $status=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/status" -TimeoutSec 5
  Add-Result "Platform API" "PASS" ("Lifecycle="+$status.lifecycle)
  $activated=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/activate" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 45
  foreach($service in $activated.results){$state=if($service.state -in @("running","connected","observed")){"PASS"}elseif($service.state -eq "disabled"){"WARN"}else{"WARN"};Add-Result ("Service "+$service.name) $state $service.detail}
 }catch{Add-Result "Platform activation" "FAIL" $_.Exception.Message;throw "Local platform activation did not complete."}
 $Results.final_state=if(($Results.steps|Where-Object{$_.state -eq "FAIL"}).Count -gt 0){"FAILED"}elseif(($Results.steps|Where-Object{$_.state -eq "WARN"}).Count -gt 0){"READY_WITH_ACTIONS_REQUIRED"}else{"READY"}
 $Results.finished_at=(Get-Date).ToString("o")
 $Results|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 $Report
 Write-Host ""
 Write-Host "ACTIVATION REPORT: $Report" -ForegroundColor Cyan
 Start-Process "http://127.0.0.1:8787"
 Write-Host "The platform has been activated; review service states in the dashboard and the JSON report." -ForegroundColor Green
}catch{
 Add-Result "Activation run" "FAIL" $_.Exception.Message
 $Results.final_state="FAILED";$Results.finished_at=(Get-Date).ToString("o")
 $Results|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 $Report
 Write-Host "Activation stopped safely. Report: $Report" -ForegroundColor Red
 exit 1
}
