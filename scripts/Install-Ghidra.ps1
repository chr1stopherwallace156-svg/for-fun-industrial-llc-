[CmdletBinding()]
param(
 [string]$InstallRoot=(Join-Path $env:LOCALAPPDATA "FunIndustrial\tools"),
 [string]$ArchivePath=(Join-Path (Split-Path $PSScriptRoot -Parent) ".runtime\downloads\ghidra_12.2_PUBLIC_20261016.zip")
)
$ErrorActionPreference="Stop"
$ProgressPreference="SilentlyContinue"
$started=(Get-Date).ToString("o")
$expected="2c2cd776db3c1f6a097ba418922378ac3649cadd5e844a6f5f088ae628a7be67"
$url="https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.2_build/ghidra_12.2_PUBLIC_20261016.zip"
$ghidraRoot=Join-Path $InstallRoot "ghidra_12.2_PUBLIC"
try{
 if($env:OS -ne "Windows_NT"){throw "This installer is Windows-only."}
 $winget=Get-Command winget.exe -ErrorAction SilentlyContinue
 if(-not $winget){throw "winget is required to install the supported JDK 25. Install Microsoft App Installer first."}
 $jdkInstalledByFunIndustrial=$false
 $jdkDirs=@()
 if(Test-Path "C:\Program Files\Eclipse Adoptium"){$jdkDirs=Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory -Filter "jdk-25*" -ErrorAction SilentlyContinue}
 if(-not $jdkDirs){
  Write-Host "Installing Eclipse Temurin JDK 25 through the official WinGet package ID..." -ForegroundColor Cyan
  & $winget.Source install --id EclipseAdoptium.Temurin.25.JDK --exact --accept-package-agreements --accept-source-agreements
  if($LASTEXITCODE -ne 0){throw "Eclipse Temurin JDK 25 installation failed with exit code $LASTEXITCODE."}
  $jdkInstalledByFunIndustrial=$true
  if(Test-Path "C:\Program Files\Eclipse Adoptium"){$jdkDirs=Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory -Filter "jdk-25*" -ErrorAction SilentlyContinue}
 }
 if(-not $jdkDirs){throw "JDK 25 installation directory not found under C:\Program Files\Eclipse Adoptium."}
 $jdk=$jdkDirs | Sort-Object LastWriteTime -Descending | Select-Object -First 1
 $java=Join-Path $jdk.FullName "bin\java.exe"
 if(-not(Test-Path $java)){throw "JDK 25 java.exe missing."}
 $env:JAVA_HOME=$jdk.FullName
 $env:Path=(Join-Path $jdk.FullName "bin")+";"+$env:Path
 $javaVersion=(& $java -version 2>&1 | Out-String)
 if($javaVersion -notmatch 'version "25\.'){throw "Selected Java runtime is not JDK 25: $javaVersion"}
 New-Item -ItemType Directory -Force -Path $InstallRoot,(Split-Path $ArchivePath -Parent) | Out-Null
 if(-not(Test-Path -LiteralPath $ArchivePath)){
  Write-Host "Downloading official Ghidra 12.2 archive (approximately 570 MB)..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $ArchivePath -UseBasicParsing
 }
 $actual=(Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
 if($actual -ne $expected){throw "Ghidra archive SHA-256 mismatch. Expected $expected; received $actual. Archive preserved for investigation; do not extract."}
 if(-not(Test-Path (Join-Path $ghidraRoot "support\analyzeHeadless.bat"))){
  if(Test-Path $ghidraRoot){throw "Ghidra target directory exists but is incomplete; refusing to overwrite."}
  Expand-Archive -LiteralPath $ArchivePath -DestinationPath $InstallRoot
 }
 $headless=Join-Path $ghidraRoot "support\analyzeHeadless.bat"
 if(-not(Test-Path $headless)){throw "Ghidra extraction completed but analyzeHeadless.bat was not found at $headless"}
 $reportDir=Join-Path (Split-Path $PSScriptRoot -Parent) "reports"
 New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
 $report=Join-Path $reportDir ("ghidra-install-"+(Get-Date -Format "yyyyMMdd-HHmmss")+".json")
 [ordered]@{document="FUN_INDUSTRIAL_GHIDRA_INSTALL_V1";started_at=$started;finished_at=(Get-Date).ToString("o");jdk_home=$jdk.FullName;java_version=$javaVersion.Trim();ghidra_version="12.2";ghidra_root=$ghidraRoot;archive_path=$ArchivePath;archive_sha256=$actual;archive_integrity="PASS";sample_downloaded=$false;sample_executed=$false;final_state="PASS"} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $report
 $repoRoot=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
 $manifestPath=Join-Path $repoRoot ".runtime\install-manifest.json"
 $manifest=[ordered]@{}
 if(Test-Path $manifestPath){$prior=Get-Content $manifestPath -Raw|ConvertFrom-Json;foreach($property in $prior.PSObject.Properties){$manifest[$property.Name]=$property.Value}}
 $manifest["jdk_installed_by_funindustrial"]=$jdkInstalledByFunIndustrial
 $manifest["ghidra_installed_by_funindustrial"]=$true
 $manifest["ghidra_version"]="12.2"
 $manifest["ghidra_archive_sha256"]=$actual
 New-Item -ItemType Directory -Force -Path (Split-Path $manifestPath -Parent) | Out-Null
 $manifest|ConvertTo-Json -Depth 6|Set-Content -Encoding UTF8 $manifestPath
 Write-Host "JDK25=PASS"
 Write-Host "GHIDRA_ARCHIVE_SHA256=PASS"
 Write-Host "GHIDRA_HEADLESS=PASS"
 Write-Host "GHIDRA_ROOT=$ghidraRoot"
 Write-Host "INSTALL_EVIDENCE=$report"
 $global:LASTEXITCODE=0
}catch{
 Write-Host $_.Exception.Message -ForegroundColor Red
 Write-Host "GHIDRA_INSTALL=FAILED"
 $global:LASTEXITCODE=1
 return
}
