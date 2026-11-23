# Fun Industrial V4: read-only GGUF identity and Windows AMD VRAM telemetry.
# Never installs, trains, downloads, changes Qwen process, or touches Elektron.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V4_PREFLIGHT_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$inspect=Join-Path $root 'scripts\Inspect-Fun-Qwen-GGUF-Provenance-V4.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-gguf-provenance-v4-test.py'
$gguf=Join-Path $HOME 'FunIndustrial\.runtime\models\Qwen3-4B-Q4_K_M.gguf'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_REPO_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'REPO_LOCAL_CHANGES_REQUIRE_REVIEW'}
foreach($p in @($inspect,$tests,$gguf)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('FILE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$pyVersion=(& $py -3.12 --version 2>&1 | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $pyVersion -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_MISSING'}
$listen=@(Get-NetTCPConnection -LocalPort 8088 -State Listen -ErrorAction SilentlyContinue)
if($listen.Count -ne 1){Hold 'QWEN_8088_LISTENER_NOT_UNIQUE'}
$proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listen[0].OwningProcess)
if(!$proc -or $proc.Name -notlike '*llama-server*' -or !$proc.CommandLine){Hold 'LIVE_QWEN_PROCESS_UNVERIFIED'}
if(!$proc.CommandLine.Contains($gguf)){Hold 'LIVE_QWEN_MODEL_PATH_MISMATCH'}
Write-Host ('FUN_QWEN_V4_LIVE_MODEL_PATH='+$gguf)
Write-Host ('FUN_QWEN_V4_LIVE_PID='+$proc.ProcessId)
Write-Host 'FUN_QWEN_V4_SCOPE=READONLY_HEADER_AND_TELEMETRY'
Write-Host 'FUN_QWEN_V4_TESTS=RUNNING'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'GGUF_HEADER_PARSER_UNIT_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V4_TESTS=PASS'
Write-Host 'FUN_QWEN_V4_GGUF_INSPECTION=START'
& $py -3.12 $inspect --gguf $gguf
if($LASTEXITCODE -ne 0){Hold 'LIVE_GGUF_ARCHITECTURE_NOT_VERIFIED'}
Write-Host 'FUN_QWEN_V4_GGUF_GEOMETRY=PASS_NO_EXACT_WEIGHT_REVISION_CLAIM'
Write-Host '=== WINDOWS AMD GRAPHICS MEMORY SNAPSHOT ==='
# Windows GPU performance counters may not be installed/registered; no
# invented VRAM values and no claim this snapshot measures training peak.
try {
 $stats=Get-Counter -Counter '\GPU Adapter Memory(*)\Dedicated Usage' -MaxSamples 1 -ErrorAction Stop
 $entries=@($stats.CounterSamples | Where-Object {$_.Status -eq 0 -and $_.CookedValue -ge 0})
 if($entries.Count -eq 0){
   Write-Host 'FUN_QWEN_V4_GPU_COUNTER=UNAVAILABLE_NO_PEAK_CLAIM'
 }else{
   foreach($item in @($entries|Sort-Object CookedValue -Descending|Select-Object -First 5)){
     Write-Host ('GPU_ADAPTER_INSTANCE='+$item.InstanceName+' DEDICATED_USAGE_GIB='+[math]::Round([double]$item.CookedValue/1GB,3))
   }
   Write-Host 'FUN_QWEN_V4_GPU_COUNTER=SNAPSHOT_ONLY_NOT_TRAINING_PEAK'
 }
}catch{
 Write-Host 'FUN_QWEN_V4_GPU_COUNTER=UNAVAILABLE_NO_PEAK_CLAIM'
}
$os=Get-CimInstance Win32_OperatingSystem
Write-Host ('FUN_QWEN_V4_HOST_AVAILABLE_GIB='+[math]::Round([double]$os.FreePhysicalMemory/1MB,2))
$end=@(Get-NetTCPConnection -LocalPort 8088 -State Listen -ErrorAction SilentlyContinue)
if($end.Count -ne 1 -or $end[0].OwningProcess -ne $listen[0].OwningProcess){Hold 'QWEN_LISTENER_CHANGED_DURING_READONLY_CHECK'}
Write-Host 'FUN_QWEN_V4_MODEL_TENSOR_DATA_READ=FALSE'
Write-Host 'FUN_QWEN_V4_QWEN_WEIGHT_CHANGES=ZERO'
Write-Host 'FUN_QWEN_V4_HF_REVISION_MATCH=UNVERIFIED'
Write-Host 'FUN_QWEN_V4_TRAINING=NOT_STARTED'
Write-Host 'FUN_QWEN_V4_ELEKTRON=UNTOUCHED'
