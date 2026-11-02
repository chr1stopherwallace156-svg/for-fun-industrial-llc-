[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$ArchivePath,
 [Parameter(Mandatory=$true)][ValidatePattern("^[A-Fa-f0-9]{64}$")][string]$ExpectedSha256
)
$ErrorActionPreference="Stop"
$RepoRoot=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$archive=(Resolve-Path -LiteralPath $ArchivePath).Path
$actual=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if($actual -ne $ExpectedSha256.ToLowerInvariant()){throw "llama.cpp archive SHA-256 mismatch. Expected $ExpectedSha256; received $actual. Nothing extracted."}
$target=Join-Path $RepoRoot ".runtime\llama.cpp"
if(Test-Path $target){throw "Target already exists; refusing to overwrite: $target"}
New-Item -ItemType Directory -Force -Path $target | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[System.IO.Compression.ZipFile]::OpenRead($archive)
try{
 foreach($entry in $zip.Entries){
  if(-not $entry.FullName){continue}
  $normalized=$entry.FullName.Replace("\","/")
  if($normalized.StartsWith("/") -or $normalized -match "^[A-Za-z]:" -or ($normalized -split "/") -contains ".."){throw "Unsafe archive entry path rejected: $($entry.FullName)"}
  $destination=Join-Path $target $normalized.Replace("/",[IO.Path]::DirectorySeparatorChar)
  $full=[IO.Path]::GetFullPath($destination)
  if(-not $full.StartsWith($target,[System.StringComparison]::OrdinalIgnoreCase)){throw "Archive entry escapes the isolated runtime directory."}
  if($entry.FullName.EndsWith("/")){New-Item -ItemType Directory -Force -Path $full | Out-Null;continue}
  New-Item -ItemType Directory -Force -Path (Split-Path $full -Parent) | Out-Null
  [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$full,$false)
 }
}finally{$zip.Dispose()}
$server=Get-ChildItem -LiteralPath $target -Recurse -File -Filter "llama-server.exe" | Select-Object -First 1
$cli=Get-ChildItem -LiteralPath $target -Recurse -File -Filter "llama.exe" | Select-Object -First 1
$binary=if($server){$server}else{$cli}
if(-not $binary){throw "Archive did not contain llama-server.exe or llama.exe. Extracted files are retained for inspection."}
$downloads=Join-Path $RepoRoot ".runtime\downloads"
New-Item -ItemType Directory -Force -Path $downloads | Out-Null
$storedArchive=Join-Path $downloads (Split-Path $archive -Leaf)
if($archive -ne $storedArchive){Move-Item -LiteralPath $archive -Destination $storedArchive -Force}
$manifest=[ordered]@{document="FUN_INDUSTRIAL_LLAMA_CPP_INSTALL_V1";archive=$storedArchive;archive_sha256=$actual;binary=$binary.FullName;binary_sha256=(Get-FileHash $binary.FullName -Algorithm SHA256).Hash.ToLowerInvariant();scope="repository-private .runtime";global_install=$false;created_at=(Get-Date).ToString("o")}
$manifest|ConvertTo-Json -Depth 4|Set-Content -Encoding UTF8 (Join-Path $target "install-manifest.json")
Write-Host "LLAMA_CPP_INSTALL=PASS"
Write-Host "ARCHIVE_SHA256=PASS"
Write-Host "BINARY=$($binary.FullName)"
Write-Host "BINARY_SHA256=$($manifest.binary_sha256)"
$global:LASTEXITCODE=0
