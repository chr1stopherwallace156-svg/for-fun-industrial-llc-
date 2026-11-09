# Generate one locally authorized spoken sentence in enrolled 'selfvoice'
# using Windows SpeechSynthesizer as the base and OpenVoice V2 conversion.
# No microphone, external network listener, REA, Cognee or Electron/Ollama.
[CmdletBinding()]param(
 [string]$Text="Hello, this is a locally generated Fun Industrial voice replication test.",
 # Optional explicit authorization for Windows SSH / Termius sessions, where
 # [Environment]::UserInteractive is False even though the operator typed
 # the command. This parameter is never stored and authorizes ONE run only.
 [string]$ApprovalPhrase=""
)
$ErrorActionPreference="Stop"
$SpeakerId="selfvoice"
$Root=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceReplicationRuntime"
$Python=Join-Path $Root "venv\Scripts\python.exe"
$Upstream=Join-Path $Root "OpenVoice-Upstream"
$Models=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceReplicationModels"
$Profile=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab\profiles\selfvoice\profile.json"
$Module=Join-Path $PSScriptRoot "voice_lab\openvoice_windows_backend.py"
$OutRoot=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab\exports"
$Ports=@(8789,8791,8088,8443)
function Hold([string]$why){throw "FUN_VOICE_REPLICATION_SYNTHESIS_HOLD=$why"}
function CurrentPorts(){
 $states=@{}
 foreach($port in $Ports){
  $states[[string]$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object) -join ",")
 }
 return $states
}
# Do not use [Environment]::UserInteractive to detect Termius/SSH input:
# remote sessions commonly report False even with a human operator.
# Fail closed unless this invocation explicitly supplies or prompts the
# exact authorization phrase. A missing phrase in redirected/non-console
# sessions must not silently approve the operation.
if($Text.Length -lt 5 -or $Text.Length -gt 180 -or $Text -match '[\x00-\x1F]'){Hold "TEXT_LENGTH_OR_CONTROLS_REJECTED"}
foreach($file in @($Python,$Module,$Profile,(Join-Path $Models "verified-manifest.json"))){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Hold "RUNTIME_OR_ENROLLMENT_MISSING"}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "UNTRUSTED_FILE_LINK"}
}
if(-not(Test-Path -LiteralPath (Join-Path $Upstream "openvoice\api.py") -PathType Leaf)){Hold "OPENVOICE_UPSTREAM_MISSING"}
$actual=(& git.exe -C $Upstream rev-parse HEAD 2>$null|Out-String).Trim()
if($actual -ne "74a1d147b17a8c3092dd5430504bd83ef6c7eb23"){Hold "OPENVOICE_UPSTREAM_COMMIT_MISMATCH"}
try{$enrolled=Get-Content -LiteralPath $Profile -Raw|ConvertFrom-Json}catch{Hold "VOICE_PROFILE_JSON_UNREADABLE"}
if($enrolled.speaker_id -ne $SpeakerId -or $enrolled.status -ne "authorized" -or
   $enrolled.operator_asserted_rights -ne $true -or
   $enrolled.reference_sha256 -ne "8882b4b156e8b97ccd650671e09618fda199a1d50ae3c66e73664d8cb19d67dc"){
 Hold "ORIGINAL_AUTHORIZED_SELFVOICE_PROFILE_CHANGED"
}
$before=CurrentPorts
$knownReplicaFiles=@{}
if(Test-Path -LiteralPath $OutRoot){
 foreach($file in @(Get-ChildItem -LiteralPath $OutRoot -Filter "selfvoice-replica-*.wav" -File -ErrorAction SilentlyContinue)){
  $knownReplicaFiles[$file.FullName]=$true
 }
}
$phrase="SYNTHESIZE VOICE "+$SpeakerId
Write-Host "FUN_VOICE_REPLICATION_MODEL=OPENVOICE_V2 CPU_ONLY=TRUE BASE=WINDOWS_OFFLINE_SPEECH"
Write-Host "FUN_VOICE_REPLICATION_DISCLOSURE=THIS_IS_SYNTHETIC_AUDIO_NOT_AN_IDENTITY_CREDENTIAL"
Write-Host ("FUN_VOICE_REPLICATION_TEST_SENTENCE="+$Text)
if($PSBoundParameters.ContainsKey("ApprovalPhrase")){
 $entered=$ApprovalPhrase
 Write-Host "FUN_VOICE_REPLICATION_APPROVAL_MODE=EXPLICIT_COMMAND_ARGUMENT ONE_OUTPUT_ONLY=TRUE"
}else{
 if([Console]::IsInputRedirected){Hold "EXPLICIT_APPROVAL_PHRASE_REQUIRED_FOR_REDIRECTED_INPUT"}
 try{
  $entered=Read-Host ("Type exactly ["+$phrase+"] to authorize ONE new WAV")
 }catch{Hold "OPERATOR_APPROVAL_INPUT_UNAVAILABLE"}
}
if($entered -cne $phrase){Hold "OPERATOR_APPROVAL_NOT_GRANTED"}
Write-Host "FUN_VOICE_REPLICATION_APPROVAL=PASS SELFVOICE_ONE_OUTPUT_ONLY"
$base=Join-Path $Root "base"
New-Item -ItemType Directory -Force -Path $base|Out-Null
if((Get-Item -LiteralPath $base).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "BASE_DIRECTORY_LINK_REJECTED"}
$baseWav=Join-Path $base ("windows-source-"+[guid]::NewGuid().ToString("N")+".wav")
$tts=$null
try{
 Add-Type -AssemblyName System.Speech -ErrorAction Stop
 $tts=New-Object System.Speech.Synthesis.SpeechSynthesizer
 $en=@($tts.GetInstalledVoices()|Where-Object{
  $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq "en"
 })
 if($en.Count -eq 0){Hold "WINDOWS_ENGLISH_SAPI_VOICE_MISSING"}
 $tts.SelectVoice($en[0].VoiceInfo.Name)
 $tts.SetOutputToWaveFile($baseWav)
 $tts.Speak($Text)
 $tts.SetOutputToNull()
}finally{
 if($tts){$tts.Dispose()}
}
if(-not(Test-Path -LiteralPath $baseWav -PathType Leaf) -or
   (Get-Item -LiteralPath $baseWav).Length -lt 1024){Hold "WINDOWS_BASE_WAV_NOT_CREATED"}
$env:PYTHONPATH=$Upstream
$env:PYTHONNOUSERSITE="1"
$env:HF_HUB_OFFLINE="1";$env:TRANSFORMERS_OFFLINE="1";$env:HF_DATASETS_OFFLINE="1"
$env:FUN_VOICE_OPENVOICE_CHECKPOINTS=Join-Path $Models "OpenVoiceV2"
$env:FUN_VOICE_MELO_EN_NEWEST_HOME=Join-Path $Models "MeloTTS-English-v3"
$env:FUN_VOICE_HOME=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab"
Push-Location $PSScriptRoot
try{
 & $Python -m voice_lab.openvoice_windows_backend $SpeakerId --base $baseWav --runtime-root $Root --operator-attested $phrase
 if($LASTEXITCODE -ne 0){Hold "OPENVOICE_CONVERSION_FAILED"}
}finally{Pop-Location}
$last=@(Get-ChildItem -LiteralPath $OutRoot -Filter "selfvoice-replica-*.wav" -File -ErrorAction SilentlyContinue|Where-Object{-not $knownReplicaFiles.ContainsKey($_.FullName)})
if($last.Count -ne 1){Hold "NEW_REPLICA_FILE_MISSING_OR_AMBIGUOUS"}
$meta=[IO.Path]::ChangeExtension($last[0].FullName,".json")
if(-not(Test-Path -LiteralPath $meta)){Hold "REPLICA_PROVENANCE_MISSING"}
$record=Get-Content -LiteralPath $meta -Raw|ConvertFrom-Json
if($record.schema -ne "fun.voice.replication.sapi.v1" -or $record.speaker_id -ne "selfvoice" -or
   (Get-FileHash -LiteralPath $last[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.output_sha256){
 Hold "REPLICA_PROVENANCE_INVALID"
}
$after=CurrentPorts
foreach($port in $Ports){
 if($before[[string]$port] -ne $after[[string]$port]){Hold ("PROTECTED_SERVICE_LISTENER_CHANGED_"+$port)}
}
Write-Host "FUN_VOICE_REPLICATION_FIRST_WAV=PASS LOCAL_ONLY=TRUE SYNTHETIC=TRUE"
Write-Host ("FUN_VOICE_REPLICATION_RESULT="+$last[0].FullName)
Write-Host ("FUN_VOICE_REPLICATION_RESULT_JSON="+$meta)
Write-Host "FUN_VOICE_REPLICATION_OTHER_SERVICES=UNCHANGED NO_NETWORK_SERVER=TRUE"
