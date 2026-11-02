[CmdletBinding()]
param([string]$Destination=(Join-Path (Split-Path $PSScriptRoot -Parent) ".runtime\models"))
$ErrorActionPreference="Stop"
$ProgressPreference="SilentlyContinue"
$revision="bc640142c66e1fdd12af0bd68f40445458f3869b"
$file="Qwen3-4B-Q4_K_M.gguf"
$url="https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/$revision/$file"
$expectedSize=[int64]2497280256
$expectedSha="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$target=Join-Path $Destination $file
$licensePath=Join-Path $Destination "Qwen3-MODEL-LICENSE.txt"
if(Test-Path -LiteralPath $target){
 $size=(Get-Item -LiteralPath $target).Length
 $sha=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
 if($size -eq $expectedSize -and $sha -eq $expectedSha){Write-Host "QWEN_MODEL=ALREADY_VERIFIED";Write-Host "MODEL_PATH=$target"
$global:LASTEXITCODE=0;return}
 throw "Existing model file does not match pinned size/SHA-256. It was not overwritten."
}
$temp=$target+".partial"
if(Test-Path $temp){throw "Partial download already exists at $temp. Inspect and remove it deliberately before retrying."}
Write-Host "Downloading pinned Qwen3-4B Q4_K_M GGUF (approximately 2.5 GB)..." -ForegroundColor Cyan
try{Invoke-WebRequest -Uri $url -OutFile $temp -UseBasicParsing}catch{throw "Model download failed; partial file preserved at $temp. $_"}
$size=(Get-Item -LiteralPath $temp).Length
$sha=(Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
if($size -ne $expectedSize -or $sha -ne $expectedSha){throw "Model integrity check FAILED. Expected size=$expectedSize SHA256=$expectedSha; got size=$size SHA256=$sha. Partial file preserved."}
Move-Item -LiteralPath $temp -Destination $target
$licensePath=Join-Path $Destination "Qwen3-MODEL-LICENSE.txt"
Invoke-WebRequest -Uri "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/$revision/LICENSE" -OutFile $licensePath -UseBasicParsing
if((Get-Item -LiteralPath $licensePath).Length -lt 1000){throw "Model license download is incomplete; inspect $licensePath"}
Write-Host "QWEN_MODEL_DOWNLOAD=PASS"
Write-Host "MODEL_SIZE=$size"
Write-Host "MODEL_SHA256=$sha"
Write-Host "MODEL_LICENSE=Apache-2.0"
Write-Host "MODEL_PATH=$target"
$global:LASTEXITCODE=0
