# FIAL5.7 one bounded scheduled cycle. Reuses FIAL5.6 and observes business
# correspondence only. Absolutely no Gmail send, payment or government filing.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL56-BusinessCompetence'
$OldRunner=Join-Path $OldRoot 'Run-Fun-Business-Competence-V5-6.ps1'
$NewRunner=Join-Path $Root 'scripts\Run-Fun-Outcome-V5-7.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
$Outcome=Join-Path $Data 'OutcomeV57\verified-outcomes-v1.json'
$Competence=Join-Path $Data 'BusinessCompetenceV56\last-cycle.json'
function Hold([string]$why){throw ('FIAL57_SCHEDULE_HOLD='+$why)}
foreach($file in @($OldRunner,$NewRunner)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_SOURCE_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'REPARSE_SOURCE_REFUSED'}
}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $Data -Force|Out-Null
$lock=[Threading.Mutex]::new($false,'Local\FunIndustrial-VerifiedOutcomeCycleV57')
$held=$false
try{
 try{$held=$lock.WaitOne(0)}catch [Threading.AbandonedMutexException]{$held=$true}
 if(!$held){Write-Host 'FIAL57_ALREADY_RUNNING_NO_DUPLICATE';return}
 $logDir=Join-Path $Data 'OutcomeV57\logs'
 New-Item -ItemType Directory -Path $logDir -Force|Out-Null
 $log=Join-Path $logDir ('cycle-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 $started=[DateTimeOffset]::UtcNow
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $OldRunner *>&1|Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold 'PREVIOUS_BUSINESS_WORKER_FAILED'}
 if(!(Test-Path -LiteralPath $Competence -PathType Leaf)){Hold 'BUSINESS_COMPETENCE_RECEIPT_MISSING'}
 $prior=Get-Content -LiteralPath $Competence -Raw|ConvertFrom-Json
 if($prior.version -cne 'fial5.6-business-operator-v1' -or
  [DateTimeOffset]::Parse([string]$prior.cycle_utc) -lt $started.AddSeconds(-4) -or
  $prior.actions.mail_sent -ne 0 -or
  $prior.actions.government_filings -ne 0){Hold 'BUSINESS_COMPETENCE_RECEIPT_STALE_OR_INVALID'}
 & $Node $NewRunner --observe *>&1|Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold 'OUTCOME_OBSERVATION_FAILED'}
 if(!(Test-Path -LiteralPath $Outcome -PathType Leaf)){Hold 'OUTCOME_RECEIPT_MISSING'}
 $receipt=Get-Content -LiteralPath $Outcome -Raw|ConvertFrom-Json
 if($receipt.version -cne 'fial5.7-verified-outcomes-v1' -or
  $receipt.scope -cne 'ELEKTRON_INQUIRY_ONLY' -or
  [DateTimeOffset]::Parse([string]$receipt.last_observed_utc) -lt $started.AddSeconds(-4) -or
  $receipt.external_form_submissions -ne 0 -or
  $receipt.purchases -ne 0 -or
  $receipt.rea_calls -ne 0 -or
  $receipt.send_attempts -gt 1){Hold 'OUTCOME_AUTHORITY_OR_TIME_MISMATCH'}
 Write-Host ('FIAL57_SCHEDULED_OBSERVATION=PASS STATE='+$receipt.state+
  ' REPLY_CANDIDATES='+@($receipt.reply_candidates).Count+
  ' MAILBOX='+$receipt.mailbox_state)
 Write-Host 'FIAL57_SCHEDULED_SENDS=0 GOVERNMENT_FILINGS=0 PAYMENTS=0 REA=0'
 Write-Host ('FIAL57_OUTCOME_RECEIPT='+$Outcome)
}finally{
 if($held){$lock.ReleaseMutex()}
 $lock.Dispose()
}
