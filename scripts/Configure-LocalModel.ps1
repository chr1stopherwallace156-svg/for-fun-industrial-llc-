[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$LlamaServerPath,
 [Parameter(Mandatory=$true)][string]$ModelPath,
 [ValidateRange(1,16)][int]$Threads=4,
 [ValidateRange(512,8192)][int]$Context=2048
)
$ErrorActionPreference="Stop"
$RepoRoot=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$server=(Resolve-Path -LiteralPath $LlamaServerPath).Path
$model=(Resolve-Path -LiteralPath $ModelPath).Path
if(-not(Test-Path -LiteralPath $server -PathType Leaf)){throw "llama-server executable not found."}
if(-not(Test-Path -LiteralPath $model -PathType Leaf)){throw "GGUF model not found."}
if([IO.Path]::GetExtension($model) -ne ".gguf"){throw "Model must be a GGUF file."}
$envFile=Join-Path $RepoRoot ".env"
if(-not(Test-Path $envFile)){throw "Run Activate-FunIndustrial.ps1 first to create the isolated .env file."}
$values=@{LLAMA_CPP_SERVER=$server;LLAMA_CPP_MODEL=$model;LLAMA_CPP_THREADS="$Threads";LLAMA_CPP_CONTEXT="$Context";FUN_INDUSTRIAL_RUNTIME=(Join-Path $RepoRoot ".runtime")}
$lines=[System.Collections.Generic.List[string]]::new()
$lines.AddRange([string[]](Get-Content $envFile))
foreach($key in $values.Keys){
 $found=$false
 for($i=0;$i -lt $lines.Count;$i++){if($lines[$i] -match ("^"+[regex]::Escape($key)+"=")){$lines[$i]=$key+"="+$values[$key];$found=$true;break}}
 if(-not $found){$lines.Add($key+"="+$values[$key])}
}
$lines|Set-Content -Encoding UTF8 $envFile
Write-Host "LOCAL_MODEL_CONFIGURATION=PASS"
Write-Host "LLAMA_SERVER=$server"
Write-Host "GGUF_MODEL=$model"
Write-Host "CPU_THREADS=$Threads CONTEXT=$Context"
Write-Host "Model license and provenance must be reviewed separately before use."
