[CmdletBinding(SupportsShouldProcess=$true)]
param([switch]$DeleteRepository,[switch]$RemoveGhidra)
$ErrorActionPreference="Stop"
$RepoRoot=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$port=8787
if($PSCmdlet.ShouldProcess("http://127.0.0.1:$port","Stop Fun Industrial services and local controller")){
 try{
  $response=Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/shutdown" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 8
  Write-Host "PLATFORM_SHUTDOWN=PASS"
 }catch{
  $listeners=Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  foreach($listener in $listeners){
   $process=Get-CimInstance Win32_Process -Filter ("ProcessId="+$listener.OwningProcess) -ErrorAction SilentlyContinue
   if($process -and $process.CommandLine -like "*$RepoRoot*src\server.mjs*"){
    if($PSCmdlet.ShouldProcess("Fun Industrial server PID $($process.ProcessId)","Stop exact repository-owned process")){Stop-Process -Id $process.ProcessId -Force}
   }else{throw "Port $port is occupied by a process not proven to belong to this repository. Refusing to stop it."}
  }
 } 
}
Start-Sleep -Seconds 2
$venvPrefix=(Join-Path $RepoRoot ".venv").TrimEnd("\")+"\" 
$runtimePrefix=(Join-Path $RepoRoot ".runtime").TrimEnd("\")+"\" 
$owned=Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
 ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($venvPrefix,[System.StringComparison]::OrdinalIgnoreCase) -and $_.CommandLine.Contains("compute_service.app:app")) -or
 ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($runtimePrefix,[System.StringComparison]::OrdinalIgnoreCase))
}
foreach($process in $owned){if($PSCmdlet.ShouldProcess("Fun Industrial owned runtime PID $($process.ProcessId)","Stop exact repository-private process")){Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue}}
$targets=@((Join-Path $RepoRoot ".venv"),(Join-Path $RepoRoot ".runtime"),(Join-Path $RepoRoot "node_modules"),(Join-Path $RepoRoot "reports"),(Join-Path $RepoRoot ".pytest_cache"))
foreach($target in $targets){if(Test-Path -LiteralPath $target){if($PSCmdlet.ShouldProcess($target,"Remove Fun Industrial private runtime data")){Remove-Item -LiteralPath $target -Recurse -Force}}}
$envFile=Join-Path $RepoRoot ".env"
if(Test-Path $envFile){if($PSCmdlet.ShouldProcess($envFile,"Remove Fun Industrial local configuration and model paths")){Remove-Item -LiteralPath $envFile -Force}}
Get-ChildItem -LiteralPath $RepoRoot -Directory -Recurse -Filter "__pycache__" -ErrorAction SilentlyContinue | ForEach-Object {if($PSCmdlet.ShouldProcess($_.FullName,"Remove Python cache")){Remove-Item -LiteralPath $_.FullName -Recurse -Force}}
if($RemoveGhidra){
 $ghidra=Join-Path $env:LOCALAPPDATA "FunIndustrial\tools"
 if(Test-Path $ghidra){if($PSCmdlet.ShouldProcess($ghidra,"Remove Fun Industrial Ghidra installation")){Remove-Item -LiteralPath $ghidra -Recurse -Force}}
}
Write-Host "FUN_INDUSTRIAL_PRIVATE_RUNTIME_REMOVAL=PASS"
Write-Host "NetBird, Node.js, Python, JDK and system-wide installations were not uninstalled."
Write-Host "No Elektron files, processes, services, or configuration were accessed."
if($DeleteRepository){if($PSCmdlet.ShouldProcess($RepoRoot,"Delete entire Fun Industrial repository clone")){Remove-Item -LiteralPath $RepoRoot -Recurse -Force;Write-Host "FUN_INDUSTRIAL_REPOSITORY_DELETED=PASS"}}
else{Write-Host "Repository source retained at $RepoRoot. Use -DeleteRepository to remove the entire clone."}
