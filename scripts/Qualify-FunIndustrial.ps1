[CmdletBinding()]
param([string]$GhidraRoot="",[string]$GhidraArchivePath="")
$ErrorActionPreference="Stop"
$RepoRoot=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ReportDir=Join-Path $RepoRoot "reports"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$Stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$Report=Join-Path $ReportDir "qualification-$Stamp.json"
$Stages=[System.Collections.Generic.List[object]]::new()
$script:Started=(Get-Date).ToString("o")
function Record([string]$Name,[string]$State,[string]$Detail){
 $Stages.Add([ordered]@{name=$Name;state=$State;detail=$Detail})
 Write-Host "[$State] $Name - $Detail"
}
function Run([string]$Name,[scriptblock]$Command){
 & $Command
 if($LASTEXITCODE -ne 0){Record $Name "FAIL" "Exit code $LASTEXITCODE";throw "$Name failed"}
 Record $Name "PASS" "Command exited 0"
}
try{
 if($env:OS -ne "Windows_NT"){throw "This qualification script is Windows-only."}
 $branch=(& git -C $RepoRoot branch --show-current).Trim()
 $headSha=(& git -C $RepoRoot rev-parse HEAD).Trim()
 Record "Git branch" $(if($branch -match "^(main|integration/.+|feature/.+)$"){"PASS"}else{"WARN"}) "Current branch: $branch"
 Run "Git whitespace validation" { git -C $RepoRoot diff --check }
 $python=Join-Path $RepoRoot ".venv\Scripts\python.exe"
 if(-not(Test-Path $python)){throw "Python environment missing. Run Activate-FunIndustrial.ps1 first."}
 Run "Python dependency consistency" { & $python -m pip check }
 & $python -m pip freeze --all | Set-Content -Encoding UTF8 (Join-Path $ReportDir "python-environment-$Stamp.txt")
 Record "Python package inventory" "PASS" "Resolved Python packages saved."
 Run "Python compute, AI/ML and malware tests" { & $python -m pytest (Join-Path $RepoRoot "compute_service\test_compute.py") (Join-Path $RepoRoot "ai_ml\test_ai_ml.py") (Join-Path $RepoRoot "malware_analysis\test_static_analysis.py") -q }
 $node=Get-Command "node.exe" -ErrorAction Stop
 Run "Node syntax validation" { Push-Location $RepoRoot; try { npm run check } finally { Pop-Location } }
 Run "Node regression tests" { Push-Location $RepoRoot; try { npm test } finally { Pop-Location } }
 Push-Location $RepoRoot; try { npm ls --depth=0 --json | Set-Content -Encoding UTF8 (Join-Path $ReportDir "node-dependencies-$Stamp.json"); if($LASTEXITCODE -ne 0){throw "npm dependency inventory reported a problem."} } finally { Pop-Location }
 Record "Node package inventory" "PASS" "Top-level installed Node packages saved."
 $reaPackagePath=Join-Path $RepoRoot ".runtime\rea\node_modules\rea-agents\package.json"
 if(-not(Test-Path $reaPackagePath)){throw "Private REA package missing from .runtime\rea."}
 $reaPackage=Get-Content $reaPackagePath -Raw|ConvertFrom-Json
 if($reaPackage.version -ne "6.8.0"){throw "Expected pinned rea-agents 6.8.0; found $($reaPackage.version)."}
 Push-Location $RepoRoot;try{npm ls --prefix (Join-Path $RepoRoot ".runtime\rea") --depth=0 --json | Set-Content -Encoding UTF8 (Join-Path $ReportDir "rea-dependencies-$Stamp.json");if($LASTEXITCODE -ne 0){throw "REA dependency inventory failed."}}finally{Pop-Location}
 Record "REA pinned package" "PASS" "rea-agents 6.8.0 and its private dependency inventory verified."
 $pkg=Get-Content (Join-Path $RepoRoot "package.json") -Raw | ConvertFrom-Json
 if($pkg.license -ne "Apache-2.0" -or -not(Test-Path (Join-Path $RepoRoot "LICENSE"))){throw "Apache-2.0 licensing declaration or LICENSE file missing."}
 Record "Project license declaration" "PASS" "package.json declares Apache-2.0 and LICENSE exists."
 if($GhidraRoot){
  $gh=(Resolve-Path -LiteralPath $GhidraRoot).Path
  if(-not(Test-Path (Join-Path $gh "support\analyzeHeadless.bat"))){throw "Ghidra analyzeHeadless.bat missing under supplied GhidraRoot."}
  $java=Get-Command "java.exe" -ErrorAction Stop
  $javaVersion=(& $java.Source -version 2>&1 | Out-String)
  if($javaVersion -notmatch 'version "25\.'){throw "Ghidra 12.2 requires JDK 25; found $javaVersion"}
  Record "JDK 25 runtime" "PASS" ($javaVersion.Trim())
  Record "Ghidra installation" "PASS" "Headless analyzer located; no sample imported or executed."
  if($GhidraArchivePath){
   $expected="2c2cd776db3c1f6a097ba418922378ac3649cadd5e844a6f5f088ae628a7be67"
   $actual=(Get-FileHash -LiteralPath $GhidraArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
   if($actual -ne $expected){throw "Ghidra archive SHA-256 mismatch: $actual"}
   Record "Ghidra archive integrity" "PASS" "Official 12.2 archive SHA-256 matches."
  }else{Record "Ghidra archive integrity" "WARN" "Archive hash not supplied; installed folder presence alone does not prove release archive integrity."}
 }else{Record "Ghidra installation" "WARN" "Not supplied. Static analysis tests ran with synthetic fixtures only; install and verify Ghidra before real-sample analysis."}
 $platform=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/status" -TimeoutSec 10
 if($platform.application -ne "Fun Industrial Platform"){throw "Local API identity mismatch."}
 Record "Platform control plane" "PASS" ("Lifecycle="+$platform.lifecycle+"; services="+$platform.services.Count)
 $localTools=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/ai/tools" -TimeoutSec 10
 if($localTools.local_tool_count -lt 15){throw "Built-in AI tool registry is incomplete."}
 Record "AI tool registry" "PASS" ("Local tools="+$localTools.local_tool_count+"; allowlisted REA tools="+$localTools.rea_tool_count)
 if($platform.vpn_policy.required -and $platform.vpn_policy.state -ne "connected"){
  Record "VPN exit-node gate" "WARN" $platform.vpn_policy.detail
  Record "Built-in tool dispatch" "WARN" "Skipped safely because the required VPN exit-node gate is not ready."
 }else{
  Record "VPN exit-node gate" "PASS" "Configured VPN policy satisfied or VPN requirement explicitly disabled."
  $graphBody='{"name":"fi_graph_analyze","arguments":{"nodes":["a","b","c"],"edges":[["a","b"],["b","c"]]}}'
  $graphTest=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/ai/tool-call" -Method Post -ContentType "application/json" -Body $graphBody -TimeoutSec 20
  if(-not $graphTest.result){throw "Built-in graph tool integration returned no result."}
  Record "Built-in tool dispatch" "PASS" "Graph analysis completed through the same approval-gated tool gateway used by AI chat."
 }
 $reaService=$platform.services|Where-Object{$_.id -eq "rea"}|Select-Object -First 1
 if($reaService.state -eq "ready"){
  $reaCatalog=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/rea/catalog" -TimeoutSec 15
  Record "REA MCP handshake and tools/list" "PASS" ("REA READY; tools discovered="+$reaCatalog.tools.Count)
  if($localTools.rea_tool_count -gt 0){Record "REA tool allowlist" "PASS" ("Explicitly allowlisted tools="+$localTools.rea_tool_count)}else{Record "REA tool allowlist" "WARN" "MCP is ready, but the default-deny allowlist is empty; add reviewed read-only tools before AI can call REA."}
 }else{Record "REA MCP handshake and tools/list" "WARN" ("REA state="+$reaService.state+"; "+$reaService.detail)}
 $aiService=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/ai/status" -TimeoutSec 10
 if($aiService.state -eq "ready"){
  $chatBody=@{messages=@(@{role="user";content="Reply with a short confirmation that local inference is operational."});max_tokens=48;temperature=0.1;tools=@()}|ConvertTo-Json -Depth 8
  $chatResult=Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/ai/chat" -Method Post -ContentType "application/json" -Body $chatBody -TimeoutSec 180
  if(-not $chatResult.reply){throw "Local model chat returned no text."}
  Record "Local AI inference" "PASS" ("Model="+$aiService.model_path+"; response received.")
 }else{
  $modelConfigured=(Get-Content (Join-Path $RepoRoot ".env") -ErrorAction SilentlyContinue | Where-Object {$_ -match "^LLAMA_CPP_(SERVER|MODEL)=" -and $_ -notmatch "=$"}).Count -ge 2
  if($platform.vpn_policy.required -and $platform.vpn_policy.state -ne "connected"){Record "Local AI inference" "WARN" "Local AI is deliberately blocked until the VPN exit-node gate is ready."}
  elseif($modelConfigured){Record "Local AI inference" "FAIL" ("Model configured but not ready: "+$aiService.state);throw "Configured local model failed readiness."}
  else{Record "Local AI inference" "WARN" "Local GGUF model not configured; install/configure it before using the conversation box."}
 }
 $gitStatus=(& git -C $RepoRoot status --short | Out-String).Trim()
 $state=if(($Stages|Where-Object{$_.state -eq "FAIL"}).Count){ "FAILED" }elseif(($Stages|Where-Object{$_.state -eq "WARN"}).Count){ "PASS_WITH_ACTIONS_REQUIRED" }else{"PASS"}
 $result=[ordered]@{document="FUN_INDUSTRIAL_WINDOWS_QUALIFICATION_V1";started_at=$script:Started;finished_at=(Get-Date).ToString("o");repository=$RepoRoot;branch=$branch;commit_sha=$headSha;python_version=(& $python --version 2>&1 | Out-String).Trim();node_version=(& node --version).Trim();final_state=$state;stages=$Stages;git_status=$gitStatus;sample_execution_performed=$false;real_malware_sample_qualification="NOT_PERFORMED"}
 $result|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 $Report
 Write-Host "QUALIFICATION_FINAL=$state"
 Write-Host "EVIDENCE_REPORT=$Report"
 $global:LASTEXITCODE=0
}catch{
 Record "Qualification run" "FAIL" $_.Exception.Message
 $result=[ordered]@{document="FUN_INDUSTRIAL_WINDOWS_QUALIFICATION_V1";finished_at=(Get-Date).ToString("o");repository=$RepoRoot;final_state="FAILED";stages=$Stages;sample_execution_performed=$false}
 $result|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 $Report
 Write-Host "QUALIFICATION_FINAL=FAILED"
 Write-Host "EVIDENCE_REPORT=$Report"
 $global:LASTEXITCODE=1
 return
}
