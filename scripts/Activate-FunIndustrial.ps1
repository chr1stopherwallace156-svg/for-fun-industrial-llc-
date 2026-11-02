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
$RuntimeRoot=Join-Path $RepoRoot ".runtime"
New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
$Ownership=[ordered]@{git_installed_by_funindustrial=$false;node_installed_by_funindustrial=$false;python312_installed_by_funindustrial=$false;netbird_installed_by_funindustrial=$false}
function Save-InstallManifest {
 $manifestPath=Join-Path $RuntimeRoot "install-manifest.json"
 $manifest=[ordered]@{}
 if(Test-Path $manifestPath){$prior=Get-Content $manifestPath -Raw|ConvertFrom-Json;foreach($property in $prior.PSObject.Properties){$manifest[$property.Name]=$property.Value}}
 foreach($key in $Ownership.Keys){if($Ownership[$key]){$manifest[$key]=$true}elseif(-not $manifest.Contains($key)){$manifest[$key]=$false}}
 $manifest["repository_root"]=$RepoRoot
 $manifest["updated_at"]=(Get-Date).ToString("o")
 $manifest|ConvertTo-Json -Depth 6|Set-Content -Encoding UTF8 $manifestPath
}

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
 $winget=Get-Command "winget.exe" -ErrorAction SilentlyContinue
 if(-not $winget){throw "winget is required for one-pass prerequisite installation. Install Microsoft App Installer, then rerun."}
 if(-not (Get-Command "git.exe" -ErrorAction SilentlyContinue)){& $winget.Source install --id Git.Git --exact --accept-package-agreements --accept-source-agreements;if($LASTEXITCODE -ne 0){throw "Git installation failed."};$Ownership.git_installed_by_funindustrial=$true;Save-InstallManifest}
 if(-not (Get-Command "node.exe" -ErrorAction SilentlyContinue)){& $winget.Source install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements;if($LASTEXITCODE -ne 0){throw "Node.js LTS installation failed."};$Ownership.node_installed_by_funindustrial=$true;Save-InstallManifest}
 $pyLauncher=Get-Command "py.exe" -ErrorAction SilentlyContinue
 $pythonCommand=Get-Command "python.exe" -ErrorAction SilentlyContinue
 $pythonReady=$false
 if($pyLauncher){& $pyLauncher.Source -3.12 --version *> $null;$pythonReady=($LASTEXITCODE -eq 0)}
 elseif($pythonCommand){$pv=(& $pythonCommand.Source --version 2>&1 | Out-String).Trim();$pythonReady=($pv -match "^Python 3\.12\.")}
 if(-not $pythonReady){& $winget.Source install --id Python.Python.3.12 --exact --accept-package-agreements --accept-source-agreements;if($LASTEXITCODE -ne 0){throw "Python 3.12 installation failed."};$Ownership.python312_installed_by_funindustrial=$true;Save-InstallManifest}
 $env:Path=[Environment]::GetEnvironmentVariable("Path","Machine")+";"+[Environment]::GetEnvironmentVariable("Path","User")
 $Git=Require-Command "git.exe" "Install Git for Windows."
 $Node=Require-Command "node.exe" "Install Node.js LTS."
 $Npm=Require-Command "npm.cmd" "Install Node.js LTS."
 $Python=Get-Command "py.exe" -ErrorAction SilentlyContinue
 if(-not $Python){$Python=Get-Command "python.exe" -ErrorAction SilentlyContinue}
 if(-not $Python){throw "Python 3.12 installation was not found after winget completed."}
 if($Python.Name -eq "py.exe"){& $Python.Source -3.12 --version *> $null;if($LASTEXITCODE -ne 0){throw "Python launcher does not find Python 3.12."}}
 else{$pyVersion=(& $Python.Source --version 2>&1 | Out-String).Trim();if($pyVersion -notmatch "^Python 3\.12\."){throw "Python 3.12 required; found $pyVersion."}}
 $nodeVersion=(& $Node --version).Trim()
 $parsedNode=[version]($nodeVersion.TrimStart("v"))
 $supportedNode=($parsedNode.Major -eq 22 -and $parsedNode -ge [version]"22.23.4") -or ($parsedNode.Major -eq 24 -and $parsedNode -ge [version]"24.22.1") -or ($parsedNode.Major -ge 26 -and $parsedNode -ge [version]"26.12.1")
 if(-not $supportedNode){throw "REA requires Node 22.23.4+, 24.22.1+, or 26.12.1+; found $nodeVersion"}
 Add-Result "Prerequisites" "PASS" "Git and Node $nodeVersion found."
 $branch=(& $Git -C $RepoRoot branch --show-current).Trim()
 if($branch -notmatch "^(main|integration/.+|feature/.+)$"){Add-Result "Git branch" "WARN" "Running from $branch; expected main, integration/*, or feature/*. No branch switch performed."}else{Add-Result "Git branch" "PASS" $branch}
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
 & $pythonExe -m pytest (Join-Path $RepoRoot "compute_service\test_compute.py") (Join-Path $RepoRoot "ai_ml\test_ai_ml.py") (Join-Path $RepoRoot "malware_analysis\test_static_analysis.py") -q
 if($LASTEXITCODE -ne 0){throw "Compute, AI/ML, and defensive malware static-analysis tests failed."}
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
 $runtimeRoot=Join-Path $RepoRoot ".runtime"
 $reaRoot=Join-Path $runtimeRoot "rea"
 New-Item -ItemType Directory -Force -Path $reaRoot | Out-Null
 & $Npm install --prefix $reaRoot --ignore-scripts --no-audit --no-fund "rea-agents@6.8.0"
 if($LASTEXITCODE -ne 0){throw "Pinned REA package installation failed."}
 $reaEntry=Join-Path $reaRoot "node_modules\rea-agents\scripts\rea.mjs"
 if(-not(Test-Path $reaEntry)){throw "Pinned REA package entrypoint missing: $reaEntry"}
 Add-Result "REA package" "PASS" "rea-agents 6.8.0 installed privately under .runtime\rea; no global client configuration modified."
 $envFile=Join-Path $RepoRoot ".env"
 if(-not(Test-Path $envFile)){
 @"
HOST=127.0.0.1
PORT=8787
REA_ENABLED=true
REA_COMMAND=$Node
REA_ARGS=$(Join-Path $RepoRoot ".runtime\rea\node_modules\rea-agents\scripts\rea.mjs"),mcp
REA_REQUIRES_VPN=true
REA_ALLOWED_TOOLS=
NETBIRD_ENABLED=true
NETBIRD_COMMAND=netbird
NETBIRD_AUTOCONNECT=true
VPN_REQUIRED=true
VPN_REQUIRE_EXIT_NODE=true
COMPUTE_ENABLED=true
COMPUTE_COMMAND=$pythonExe
COMPUTE_PORT=8790
FUN_INDUSTRIAL_RUNTIME=$(Join-Path $RepoRoot ".runtime")
LLAMA_CPP_SERVER=
LLAMA_CPP_MODEL=
LLAMA_CPP_THREADS=4
LLAMA_CPP_CONTEXT=2048
AI_ENABLED=true
AI_AUTOSTART=true
"@ | Set-Content -Encoding UTF8 $envFile
  Add-Result "Configuration" "PASS" "Created loopback-only .env with VPN-required REA and local AI defaults. REA tools remain deny-by-default until explicitly allowlisted."
 }else{
  $existing=Get-Content $envFile -Raw
  if($existing -notmatch "(?m)^HOST=127\.0\.0\.1\s*$"){throw ".env must retain HOST=127.0.0.1. Unsafe binding refused."}
  $reaEntry=Join-Path $RepoRoot ".runtime\rea\node_modules\rea-agents\scripts\rea.mjs"
  $oldReaCommand=Get-Content $envFile | Where-Object { $_ -match "^REA_COMMAND=" } | Select-Object -Last 1
  if($oldReaCommand -eq "REA_COMMAND=rea"){(Get-Content $envFile) -replace "^REA_COMMAND=rea$","REA_COMMAND=$Node" | Set-Content -Encoding UTF8 $envFile}
  $oldReaArgs=Get-Content $envFile | Where-Object { $_ -match "^REA_ARGS=" } | Select-Object -Last 1
  if($oldReaArgs -eq "REA_ARGS=mcp"){(Get-Content $envFile) -replace "^REA_ARGS=mcp$","REA_ARGS=$reaEntry,mcp" | Set-Content -Encoding UTF8 $envFile}
  $required = @("COMPUTE_ENABLED=true","COMPUTE_COMMAND=$pythonExe","COMPUTE_PORT=8790","NETBIRD_ENABLED=true","VPN_REQUIRED=true","VPN_REQUIRE_EXIT_NODE=true","REA_ENABLED=true","REA_REQUIRES_VPN=true","REA_COMMAND=$Node","REA_ARGS=$reaEntry,mcp","REA_ALLOWED_TOOLS=","FUN_INDUSTRIAL_RUNTIME=$(Join-Path $RepoRoot '.runtime')","LLAMA_CPP_SERVER=","LLAMA_CPP_MODEL=","LLAMA_CPP_THREADS=4","LLAMA_CPP_CONTEXT=2048","AI_ENABLED=true","AI_AUTOSTART=true")
  foreach($line in $required){$key=$line.Split("=")[0];if($existing -notmatch ("(?m)^"+[regex]::Escape($key)+"=")){Add-Content -Encoding UTF8 $envFile $line}}
  Add-Result "Configuration" "PASS" "Existing .env preserved; missing compute, VPN, REA and local AI settings appended without overwriting existing values."
 }
 if(-not $SkipNetBirdInstall){
  $netbirdPreexisting=([bool](Get-Command "netbird.exe" -ErrorAction SilentlyContinue)) -or (Test-Path "C:\Program Files\NetBird\netbird.exe")
  $winget=Get-Command "winget.exe" -ErrorAction SilentlyContinue
  if(-not $winget){Add-Result "NetBird install" "WARN" "winget unavailable; install using https://docs.netbird.io/get-started/install/windows."}
  else{
   & $winget.Source install --id Netbird.NetBird --exact --accept-package-agreements --accept-source-agreements
   if($LASTEXITCODE -ne 0){Add-Result "NetBird install" "WARN" "winget returned $LASTEXITCODE; check whether NetBird is already installed."}else{Add-Result "NetBird install" "PASS" "NetBird package installation completed.";if(-not $netbirdPreexisting){$Ownership.netbird_installed_by_funindustrial=$true;Save-InstallManifest}}
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
 if($listener){
  foreach($entry in $listener){
   $owner=Get-CimInstance Win32_Process -Filter ("ProcessId="+$entry.OwningProcess) -ErrorAction SilentlyContinue
   if(-not $owner -or -not $owner.CommandLine.Contains((Join-Path $RepoRoot "src\server.mjs"))){throw "Port 8787 is owned by a process not identified as this Fun Industrial checkout. Refusing to connect to or stop it."}
  }
  Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/shutdown" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 10 | Out-Null
  Start-Sleep -Seconds 2
 }
 $serverLog=Join-Path $ReportDir "platform-server-$Stamp.log"
 Start-Process -FilePath $Node -ArgumentList (Join-Path $RepoRoot "src\server.mjs") -WorkingDirectory $RepoRoot -RedirectStandardOutput $serverLog -RedirectStandardError ($serverLog+".err") -WindowStyle Hidden
 Start-Sleep -Seconds 3
 try{
  $status=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/status" -TimeoutSec 5
  if($status.application -ne "Fun Industrial Platform"){throw "Port 8787 did not return the expected Fun Industrial application identity."}
  Add-Result "Platform API" "PASS" ("Lifecycle="+$status.lifecycle)
  $activated=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/activate" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 180
  foreach($service in $activated.results){$state=if($service.state -in @("running","connected","observed","ready")){"PASS"}elseif($service.state -eq "disabled"){"WARN"}else{"WARN"};Add-Result ("Service "+$service.name) $state $service.detail}
 }catch{Add-Result "Platform activation" "FAIL" $_.Exception.Message;throw "Local platform activation did not complete."}
 $Results.final_state=if(($Results.steps|Where-Object{$_.state -eq "FAIL"}).Count -gt 0){"FAILED"}elseif(($Results.steps|Where-Object{$_.state -eq "WARN"}).Count -gt 0){"READY_WITH_ACTIONS_REQUIRED"}else{"READY"}
 $Results.finished_at=(Get-Date).ToString("o")
 $Results|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 $Report
 Write-Host ""
 Write-Host "ACTIVATION REPORT: $Report" -ForegroundColor Cyan
 Start-Process "http://127.0.0.1:8787"
 Write-Host "The platform has been activated; review service states in the dashboard and the JSON report." -ForegroundColor Green
 $global:LASTEXITCODE=0
}catch{
 Add-Result "Activation run" "FAIL" $_.Exception.Message
 $Results.final_state="FAILED";$Results.finished_at=(Get-Date).ToString("o")
 $Results|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 $Report
 Write-Host "Activation stopped safely. Report: $Report" -ForegroundColor Red
 $global:LASTEXITCODE=1
 return
}
