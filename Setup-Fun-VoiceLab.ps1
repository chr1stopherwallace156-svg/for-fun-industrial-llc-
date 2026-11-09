# Isolated Fun Industrial local spoken voice lab installation.
# Does not stop/restart/patch dashboard 8789, compute 8791, llama.cpp 8088,
# Cognee, REA, Gmail, Elektron's Ollama or any other service.
[CmdletBinding()]param(
 [switch]$WithMicrophone,
 [switch]$WithSpeakerComparison
)
$ErrorActionPreference="Stop"
$Source=$PSScriptRoot
$Root=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab"
$Venv=Join-Path $Root "venv"
$Python=Join-Path $Venv "Scripts\python.exe"
$ports=@(8789,8791,8088)
function Pids(){
 $result=@{}
 foreach($port in $ports){
  $c=Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue|Where-Object {$_.LocalAddress -eq "127.0.0.1"}|Select-Object -First 1
  $result[[string]$port]=if($c){[int]$c.OwningProcess}else{0}
 }
 return $result
}
function Check([string]$stage){if($LASTEXITCODE -ne 0){throw "FUN_VOICE_DEPENDENCY_OR_TEST_HOLD STAGE=$stage EXIT=$LASTEXITCODE"}}
foreach($f in @("voice_lab\__main__.py","voice_lab\analyzer.py","voice_lab\profiles.py","tests\test_voice_lab.py","requirements-voice.txt")){
 if(-not(Test-Path -LiteralPath (Join-Path $Source $f) -PathType Leaf)){throw "FUN_VOICE_SOURCE_MISSING=$f"}
}
$before=Pids
if(-not(Test-Path $Python)){
 New-Item -ItemType Directory -Force -Path $Root|Out-Null
 $py=Get-Command py.exe -ErrorAction SilentlyContinue
 if($py){
  & $py.Source -3.12 -m venv $Venv
  Check "VENV_CREATE"
 }else{
  $sys=Get-Command python.exe -ErrorAction Stop
  & $sys.Source -m venv $Venv
  Check "VENV_CREATE"
 }
}
& $Python -c "import sys; assert (3,10) <= sys.version_info[:2] <= (3,13), sys.version"
Check "PYTHON_VERSION"
& $Python -m pip install --disable-pip-version-check --no-cache-dir -r (Join-Path $Source "requirements-voice.txt")
Check "CORE_DEPENDENCIES"
if($WithMicrophone){
 & $Python -m pip install --disable-pip-version-check --no-cache-dir -r (Join-Path $Source "requirements-voice-mic.txt")
 Check "MICROPHONE_DEPENDENCIES"
}
if($WithSpeakerComparison){
 & $Python -m pip install --disable-pip-version-check --no-cache-dir -r (Join-Path $Source "requirements-voice-speaker.txt")
 Check "SPEAKER_DEPENDENCIES"
}
New-Item -ItemType Directory -Path (Join-Path $Root "recordings") -Force|Out-Null
New-Item -ItemType Directory -Path (Join-Path $Root "profiles") -Force|Out-Null
New-Item -ItemType Directory -Path (Join-Path $Root "exports") -Force|Out-Null
Push-Location $Source
try{
 & $Python -m unittest discover -s tests -p test_voice_lab.py -v
 Check "TESTS"
 & $Python -m voice_lab status
 Check "CLI_STATUS"
}finally{Pop-Location}
$after=Pids
foreach($port in $ports){
 if($before[[string]$port] -ne $after[[string]$port]){
  throw "FUN_VOICE_UNRELATED_SERVICE_PROCESS_CHANGED_HOLD PORT=$port BEFORE=$($before[[string]$port]) AFTER=$($after[[string]$port])"
 }
}
Write-Host "FUN_VOICE_LAB_SETUP=PASS MODE=ISOLATED LOCAL_ONLY=TRUE MODEL_AUTODOWNLOADS=FALSE"
Write-Host "FUN_VOICE_EXISTING_SERVICES=UNCHANGED DASHBOARD=$($after['8789']) COMPUTE=$($after['8791']) LLAMA_CPP=$($after['8088'])"
Write-Host "FUN_VOICE_PYTHON=$Python"
Write-Host "FUN_VOICE_SOURCE=$Source"
Write-Host "FUN_VOICE_PRIVATE_HOME=$Root"
Write-Host "FUN_VOICE_SYNTHESIS=OPTIONAL_MODEL_CHECKPOINTS_NOT_INSTALLED_BY_THIS_SCRIPT"
