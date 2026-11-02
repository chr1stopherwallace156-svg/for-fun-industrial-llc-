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
 $pkg=Get-Content (Join-Path $RepoRoot "package.json") -Raw | ConvertFrom-Json
 if($pkg.license -ne "Apache-2.0" -or -not(Test-Path (Join-Path $RepoRoot "LICENSE"))){throw "Apache-2.0 licensing declaration or LICENSE file missing."}
 Record "Project license declaration" "PASS" "package.json declares Apache-2.0 and LICENSE exists."
 if($GhidraRoot){
  $gh=(Resolve-Path -LiteralPath $GhidraRoot).Path
  if(-not(Test-Path (Join-Path $gh "support\analyzeHeadless.bat"))){throw "Ghidra analyzeHeadless.bat missing under supplied GhidraRoot."}
  Record "Ghidra installation" "PASS" "Headless analyzer located; no sample imported or executed."
  if($GhidraArchivePath){
   $expected="2c2cd776db3c1f6a097ba418922378ac3649cadd5e844a6f5f088ae628a7be67"
   $actual=(Get-FileHash -LiteralPath $GhidraArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
   if($actual -ne $expected){throw "Ghidra archive SHA-256 mismatch: $actual"}
   Record "Ghidra archive integrity" "PASS" "Official 12.2 archive SHA-256 matches."
  }else{Record "Ghidra archive integrity" "WARN" "Archive hash not supplied; installed folder presence alone does not prove release archive integrity."}
 }else{Record "Ghidra installation" "WARN" "Not supplied. Static analysis tests ran with synthetic fixtures only; install and verify Ghidra before real-sample analysis."}
 $gitStatus=(& git -C $RepoRoot status --short | Out-String).Trim()
 $state=if(($Stages|Where-Object{$_.state -eq "FAIL"}).Count){ "FAILED" }elseif(($Stages|Where-Object{$_.state -eq "WARN"}).Count){ "PASS_WITH_ACTIONS_REQUIRED" }else{"PASS"}
 $result=[ordered]@{document="FUN_INDUSTRIAL_WINDOWS_QUALIFICATION_V1";started_at=$script:Started;finished_at=(Get-Date).ToString("o");repository=$RepoRoot;branch=$branch;commit_sha=$headSha;python_version=(& $python --version 2>&1 | Out-String).Trim();node_version=(& node --version).Trim();final_state=$state;stages=$Stages;git_status=$gitStatus;sample_execution_performed=$false;real_malware_sample_qualification="NOT_PERFORMED"}
 $result|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 $Report
 Write-Host "QUALIFICATION_FINAL=$state"
 Write-Host "EVIDENCE_REPORT=$Report"
 if($state -eq "FAILED"){exit 1}
}catch{
 Record "Qualification run" "FAIL" $_.Exception.Message
 $result=[ordered]@{document="FUN_INDUSTRIAL_WINDOWS_QUALIFICATION_V1";finished_at=(Get-Date).ToString("o");repository=$RepoRoot;final_state="FAILED";stages=$Stages;sample_execution_performed=$false}
 $result|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 $Report
 Write-Host "QUALIFICATION_FINAL=FAILED"
 Write-Host "EVIDENCE_REPORT=$Report"
 exit 1
}
