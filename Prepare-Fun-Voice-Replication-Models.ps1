# Prepare verified, official OpenVoice V2 + MeloTTS English-v3 model assets only.
# No runtime installation, no model deserialization, no dashboard/service changes.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Base=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceReplicationModels"
$ov=Join-Path $Base "OpenVoiceV2"
$melo=Join-Path $Base "MeloTTS-English-v3"
$ModelSpec=@(
 @{repo="myshell-ai/OpenVoiceV2";file="converter/checkpoint.pth";dest="OpenVoiceV2\converter\checkpoint.pth";hash="9652c27e92b6b2a91632590ac9962ef7ae2b712e5c5b7f4c34ec55ee2b37ab9e"},
 @{repo="myshell-ai/OpenVoiceV2";file="base_speakers/ses/en-newest.pth";dest="OpenVoiceV2\base_speakers\ses\en-newest.pth";hash="6a3798229b1114f0e9cc137b33211809def7dda5a8a9398d5a112c0b42699177"},
 @{repo="myshell-ai/MeloTTS-English-v3";file="checkpoint.pth";dest="MeloTTS-English-v3\checkpoint.pth";hash="959433dc1c6df618922560b4b7bc8c7af0a4b7ceaea267480c5d9ae8a3cfe536"}
)
$ConfigSpec=@(
 @{repo="myshell-ai/OpenVoiceV2";file="converter/config.json";dest="OpenVoiceV2\converter\config.json"},
 @{repo="myshell-ai/MeloTTS-English-v3";file="config.json";dest="MeloTTS-English-v3\config.json"}
)
function Hold([string]$reason){throw ("FUN_VOICE_REPLICATION_MODELS_HOLD="+$reason)}
function CheckNoReparse([string]$p){
 if(Test-Path -LiteralPath $p){
  if((Get-Item -LiteralPath $p -Force -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "REPARSE_POINT_REJECTED"}
 }
}
if(-not $env:LOCALAPPDATA){Hold "WINDOWS_LOCALAPPDATA_MISSING"}
$localRoot=Join-Path $env:LOCALAPPDATA "FunIndustrial"
CheckNoReparse $localRoot
CheckNoReparse $Base
if(-not(Get-Command curl.exe -ErrorAction SilentlyContinue)){Hold "CURL_EXE_REQUIRED"}
$drive=[IO.Path]::GetPathRoot($Base)
$disk=[IO.DriveInfo]::new($drive)
if($disk.AvailableFreeSpace -lt 1200000000){Hold "DISK_SPACE_UNDER_1.2GB"}
Write-Host "FUN_VOICE_MODEL_SOURCE=OFFICIAL_MY_SHELL_HUGGINGFACE LICENSE=MIT MODEL_LOAD=NOT_PERFORMED"
Write-Host "FUN_VOICE_MODEL_TOTAL_APPROX_MB=340 STORAGE_ISOLATED=TRUE"
New-Item -ItemType Directory -Path $Base -Force -ErrorAction Stop|Out-Null
function Fetch([hashtable]$spec,[bool]$binary){
 $relative=[string]$spec.dest
 $dest=Join-Path $Base $relative
 $parent=Split-Path -Parent $dest
 New-Item -ItemType Directory -Path $parent -Force -ErrorAction Stop|Out-Null
 CheckNoReparse $parent
 CheckNoReparse $dest
 $url="https://huggingface.co/"+$spec.repo+"/resolve/main/"+$spec.file
 if(Test-Path -LiteralPath $dest -PathType Leaf){
  if($binary){
   $actual=(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
   if($actual -ne $spec.hash){Hold "EXISTING_CHECKPOINT_HASH_MISMATCH_NO_OVERWRITE"}
   Write-Host ("FUN_VOICE_MODEL_CHECK=PASS CACHED="+$relative)
   return
  }
  # Validate source checkpoint configurations again below; preserve files.
  Write-Host ("FUN_VOICE_MODEL_CONFIG=CACHED "+$relative)
  return
 }
 $part=$dest+"."+[guid]::NewGuid().ToString("N")+".part"
 try{
  & curl.exe --fail --location --retry 2 --connect-timeout 20 --output $part $url
  if($LASTEXITCODE -ne 0){Hold ("DOWNLOAD_FAILED_"+$spec.file)}
  $file=Get-Item -LiteralPath $part -ErrorAction Stop
  if($file.Length -lt 100){Hold ("DOWNLOADED_FILE_TOO_SMALL_"+$spec.file)}
  if($binary){
   $actual=(Get-FileHash -LiteralPath $part -Algorithm SHA256).Hash.ToLowerInvariant()
   if($actual -ne $spec.hash){Hold ("PUBLISHED_SHA256_MISMATCH_"+$spec.file)}
  }else{
   try{$cfg=Get-Content -LiteralPath $part -Raw -ErrorAction Stop|ConvertFrom-Json -ErrorAction Stop}catch{Hold "MODEL_CONFIG_INVALID_JSON"}
   if($spec.repo -eq "myshell-ai/OpenVoiceV2"){
    if([int]$cfg.data.sampling_rate -ne 22050 -or [int]$cfg.data.n_speakers -ne 0 -or $cfg._version_ -ne "v2"){
     Hold "OPENVOICE_CONVERTER_CONFIG_UNEXPECTED"
    }
   }else{
    if([int]$cfg.data.sampling_rate -ne 44100 -or [int]$cfg.data.spk2id.'EN-Newest' -ne 0){
     Hold "MELO_EN_NEWEST_CONFIG_UNEXPECTED"
    }
   }
  }
  Move-Item -LiteralPath $part -Destination $dest -ErrorAction Stop
  Write-Host ("FUN_VOICE_MODEL_CHECK=PASS VERIFIED="+$relative)
 }finally{if(Test-Path -LiteralPath $part){Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue}}
}
foreach($spec in $ModelSpec){Fetch $spec $true}
foreach($spec in $ConfigSpec){Fetch $spec $false}
foreach($cfg in $ConfigSpec){
 $path=Join-Path $Base $cfg.dest
 try{$data=Get-Content -LiteralPath $path -Raw -ErrorAction Stop|ConvertFrom-Json -ErrorAction Stop}
 catch{Hold "CONFIG_RECHECK_INVALID"}
 if($cfg.repo -eq "myshell-ai/OpenVoiceV2"){
  if($data._version_ -ne "v2" -or [int]$data.data.sampling_rate -ne 22050){Hold "OPENVOICE_CONFIG_CHANGED"}
 }else{
  if([int]$data.data.spk2id.'EN-Newest' -ne 0 -or [int]$data.data.sampling_rate -ne 44100){Hold "MELO_CONFIG_CHANGED"}
 }
}
$manifest=[ordered]@{
 schema="fun.voice.replication.models.v1";source="myshell-ai official Hugging Face repositories";
 mode="local-model-assets-only";modelsVerified=$true;codeInstalled=$false;voiceSynthesisTested=$false;
 modelFiles=@($ModelSpec|ForEach-Object{@{file=$_.dest;sha256=$_.hash}});
 capturedUtc=[DateTime]::UtcNow.ToString("o")
}
$manifestFile=Join-Path $Base "verified-manifest.json"
if(Test-Path -LiteralPath $manifestFile){CheckNoReparse $manifestFile}
[IO.File]::WriteAllText($manifestFile,($manifest|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
Write-Host "FUN_VOICE_REPLICATION_MODELS=PASS VERIFIED_SHA256=3 SOURCE_CONFIGS=2"
Write-Host ("FUN_VOICE_OPENVOICE_CHECKPOINTS="+$ov)
Write-Host ("FUN_VOICE_MELO_EN_NEWEST_HOME="+$melo)
$py=Get-Command py.exe -ErrorAction SilentlyContinue
if($py){
 try{
  $v=(& $py.Source -3.9 -c "import sys; print(sys.version_info[:2] == (3,9))" 2>&1|Out-String).Trim()
  Write-Host ("FUN_VOICE_PYTHON39_PRESENT="+$($LASTEXITCODE -eq 0 -and $v -eq 'True')")
 }catch{Write-Host "FUN_VOICE_PYTHON39_PRESENT=False"}
}else{Write-Host "FUN_VOICE_PYTHON39_PRESENT=False"}
Write-Host "FUN_VOICE_REPLICATION_ENGINE=NOT_YET_ACTIVATED INFERENCE_RUNTIME=NOT_INSTALLED_OR_TESTED"
Write-Host "FUN_VOICE_OTHER_SERVICES=NOT_TOUCHED"
