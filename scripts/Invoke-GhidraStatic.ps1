[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$GhidraRoot,
 [Parameter(Mandatory=$true)][string]$SamplePath,
 [Parameter(Mandatory=$true)][string]$OutputDir
)
$ErrorActionPreference = "Stop"
$root=(Resolve-Path -LiteralPath $GhidraRoot).Path
$sample=(Resolve-Path -LiteralPath $SamplePath).Path
$out=[System.IO.Path]::GetFullPath($OutputDir)
$headless=Join-Path $root "support\analyzeHeadless.bat"
$exporter=Join-Path (Split-Path $PSScriptRoot -Parent) "malware_analysis\ghidra_scripts"
if(-not(Test-Path -LiteralPath $headless -PathType Leaf)){throw "Ghidra analyzeHeadless.bat not found."}
if(-not(Test-Path -LiteralPath $sample -PathType Leaf)){throw "Sample is not a file."}
if(-not(Test-Path -LiteralPath $exporter -PathType Container)){throw "Ghidra script directory missing."}
New-Item -ItemType Directory -Force -Path $out | Out-Null
$projectRoot=Join-Path $out "ghidra-project"
New-Item -ItemType Directory -Force -Path $projectRoot | Out-Null
$projectName="FI_Static_"+[guid]::NewGuid().ToString("N")
$exportPath=Join-Path $out "decompilation.txt"
$logPath=Join-Path $out "ghidra-analysis.log"
$argList=@($projectRoot,$projectName,"-import",$sample,"-scriptPath",$exporter,"-postScript","ExportDecompilation.java",$exportPath,"-analysisTimeoutPerFile","900","-log",$logPath,"-deleteProject")
$p=Start-Process -FilePath $headless -ArgumentList $argList -Wait -PassThru -NoNewWindow
if($p.ExitCode -ne 0){throw "Ghidra headless analysis failed with exit code $($p.ExitCode). Review $logPath"}
if(-not(Test-Path -LiteralPath $exportPath -PathType Leaf)){throw "Ghidra did not produce the expected decompilation report."}
Write-Output "GHIDRA_STATIC_ANALYSIS=PASS"
Write-Output "DECOMPILATION_REPORT=$exportPath"
Write-Output "GHIDRA_LOG=$logPath"
