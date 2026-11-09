# Isolated OpenVoice V2 CPU inference prerequisites for Windows 10/11 Python 3.12.
# Deliberately does not install legacy MeloTTS, restart services, or synthesize.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Root=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceReplicationRuntime"
$EnvDir=Join-Path $Root "venv"
$Python=Join-Path $EnvDir "Scripts\python.exe"
$Upstream=Join-Path $Root "OpenVoice-Upstream"
$Models=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceReplicationModels"
$Manifest=Join-Path $Models "verified-manifest.json"
$Source=Join-Path $PSScriptRoot "voice_lab\openvoice_windows_backend.py"
$Commit="74a1d147b17a8c3092dd5430504bd83ef6c7eb23"
$ports=@(8789,8791,8088,8443)
function Hold([string]$cause){throw "FUN_VOICE_REPLICATION_RUNTIME_HOLD=$cause"}
function Owners(){
 $map=@{}
 foreach($port in $ports){
  $listen=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  $map[[string]$port]=(@($listen|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object) -join ",")
 }
 return $map
}
function Check([string]$step){
 if($LASTEXITCODE -ne 0){Hold ($step+"_EXIT_"+$LASTEXITCODE)}
}
function ParseSafe([string]$path){
 if(-not(Test-Path -LiteralPath $path -PathType Leaf)){Hold ("FILE_MISSING_"+[IO.Path]::GetFileName($path))}
 $item=Get-Item -LiteralPath $path -Force
 if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "UNTRUSTED_SYMLINK"}
}
$before=Owners
ParseSafe $Source
ParseSafe $Manifest
foreach($part in @("OpenVoiceV2\converter\checkpoint.pth","OpenVoiceV2\base_speakers\ses\en-newest.pth","MeloTTS-English-v3\checkpoint.pth")){
 ParseSafe (Join-Path $Models $part)
}
try{$spec=Get-Content $Manifest -Raw -ErrorAction Stop|ConvertFrom-Json -ErrorAction Stop}
catch{Hold "MODEL_MANIFEST_INVALID"}
if($spec.schema -ne "fun.voice.replication.models.v1" -or $spec.modelsVerified -ne $true -or @($spec.modelFiles).Count -ne 3){Hold "MODEL_MANIFEST_UNVERIFIED"}
$expected=@{
 "OpenVoiceV2\converter\checkpoint.pth"="9652c27e92b6b2a91632590ac9962ef7ae2b712e5c5b7f4c34ec55ee2b37ab9e"
 "OpenVoiceV2\base_speakers\ses\en-newest.pth"="6a3798229b1114f0e9cc137b33211809def7dda5a8a9398d5a112c0b42699177"
 "MeloTTS-English-v3\checkpoint.pth"="959433dc1c6df618922560b4b7bc8c7af0a4b7ceaea267480c5d9ae8a3cfe536"
}
foreach($file in $spec.modelFiles){
 if(-not $expected.ContainsKey([string]$file.file) -or $expected[[string]$file.file] -ne [string]$file.sha256){Hold "MODEL_MANIFEST_HASH_PIN_CHANGED"}
}
foreach($entry in $expected.GetEnumerator()){
 if((Get-FileHash -LiteralPath (Join-Path $Models $entry.Key) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value){Hold "CHECKPOINT_SHA256_MISMATCH"}
}
Write-Host "FUN_VOICE_REPLICATION_MODELS=PASS PINNED_SHA256=3 ORIGINAL_FILES_UNCHANGED"
$free=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($Root)).AvailableFreeSpace
if($free -lt 1800000000){Hold "RUNTIME_DISK_SPACE_UNDER_1.8GB"}
New-Item -ItemType Directory -Path $Root -Force|Out-Null
if((Get-Item -LiteralPath $Root).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "RUNTIME_SYMLINK_REJECTED"}
$launcher=Get-Command py.exe -ErrorAction SilentlyContinue
if(-not(Test-Path -LiteralPath $Python -PathType Leaf)){
 if(-not $launcher){Hold "PYTHON312_LAUNCHER_REQUIRED"}
 & $launcher.Source -3.12 -c "import sys; assert sys.version_info[:2] == (3,12)"
 Check "SYSTEM_PYTHON312"
 & $launcher.Source -3.12 -m venv $EnvDir
 Check "CREATE_SEPARATE_REPLICATION_VENV"
}
& $Python -c "import sys; assert sys.version_info[:2] == (3,12); print('FUN_VOICE_REPLICATION_PYTHON=3.12')"
Check "ISOLATED_PYTHON312"
& $Python -m pip install --disable-pip-version-check --no-input --upgrade "pip>=24,<26" "setuptools>=70,<81" wheel
Check "BOOTSTRAP_PACKAGING"
# PyTorch is installed explicitly as a CPU build in the new venv only.
& $Python -m pip install --disable-pip-version-check --no-input --index-url "https://download.pytorch.org/whl/cpu" "torch==2.5.1"
Check "TORCH_251_CPU"
& $Python -m pip install --disable-pip-version-check --no-input "numpy==1.26.4" "scipy==1.13.1" "librosa==0.11.0" "soundfile==0.13.1" "inflect==7.0.0" "eng-to-ipa==0.0.2" "Unidecode==1.3.7" "pypinyin==0.50.0" "cn2an==0.5.22" "jieba==0.42.1"
Check "OPENVOICE_CPU_DEPENDENCIES"
if(Test-Path -LiteralPath $Upstream){
 if(-not(Test-Path -LiteralPath (Join-Path $Upstream ".git") -PathType Container)){Hold "OPENVOICE_SOURCE_CONFLICT"}
 $actual=(& git.exe -C $Upstream rev-parse HEAD 2>$null|Out-String).Trim()
 if($actual -ne $Commit){Hold "OPENVOICE_UPSTREAM_COMMIT_CHANGED"}
}else{
 $git=Get-Command git.exe -ErrorAction Stop
 & $git.Source clone --quiet --depth 1 https://github.com/myshell-ai/OpenVoice.git $Upstream
 Check "OPENVOICE_SOURCE_CLONE"
 $actual=(& $git.Source -C $Upstream rev-parse HEAD|Out-String).Trim()
 if($actual -ne $Commit){Hold "OPENVOICE_UPSTREAM_COMMIT_CHANGED"}
}
$env:PYTHONPATH=$Upstream
$env:PYTHONNOUSERSITE="1"
$env:HF_HUB_OFFLINE="1";$env:TRANSFORMERS_OFFLINE="1";$env:HF_DATASETS_OFFLINE="1"
& $Python -c "import torch, openvoice.api; assert not torch.cuda.is_available() or torch.device('cpu').type == 'cpu'; print('FUN_VOICE_OPENVOICE_IMPORT=PASS TORCH='+torch.__version__+' DEVICE=CPU')"
Check "OPENVOICE_SOURCE_IMPORT"
& $Python -m py_compile $Source
Check "FUN_VOICE_REPLICATION_BACKEND_SYNTAX"
$after=Owners
foreach($port in $ports){
 if($before[[string]$port] -ne $after[[string]$port]){
  Hold ("EXISTING_SERVICE_LISTENER_CHANGED_PORT_"+$port)
 }
}
Write-Host "FUN_VOICE_REPLICATION_RUNTIME=PASS OPENVOICE_UPSTREAM_COMMIT=$Commit"
Write-Host "FUN_VOICE_REPLICATION_MODELS=VERIFIED REFERENCE_ENROLLMENT=UNCHANGED"
Write-Host "FUN_VOICE_REPLICATION_SOURCE=$PSScriptRoot"
Write-Host "FUN_VOICE_REPLICATION_PYTHON=$Python"
Write-Host "FUN_VOICE_REPLICATION_OTHER_SERVICES=UNCHANGED"
Write-Host "FUN_VOICE_REPLICATION_NEXT=EXPLICIT_OPERATOR_SAPI_TO_OPENVOICE_TEST"
