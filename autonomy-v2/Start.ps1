$ErrorActionPreference='Stop'
$homeDir=Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile=Join-Path $homeDir 'data\service.pid'
$entry=Join-Path $homeDir 'src\service.mjs'
if(-not(Test-Path $entry)){throw 'SERVICE_FILE_NOT_FOUND'}
$node=(Get-Command node.exe -ErrorAction Stop).Source
if(Test-Path $pidFile){
 $old=[int](Get-Content $pidFile -Raw)
 $existing=Get-CimInstance Win32_Process -Filter "ProcessId=$old" -ErrorAction SilentlyContinue
 if($existing -and $existing.CommandLine -like '*autonomy-v2-github*service.mjs*'){
  $s=Invoke-RestMethod 'http://127.0.0.1:8792/api/status' -TimeoutSec 8
  if($s.pid -eq $old -and $s.state -eq 'running'){Write-Host "AUTONOMY_V2=RUNNING PID=$old";return}
  throw 'SERVICE_PID_MISMATCH'
 }
}
if(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue){throw 'PORT_8792_ALREADY_USED'}
$logs=Join-Path $homeDir 'logs';New-Item -ItemType Directory -Path $logs -Force|Out-Null
$out=Join-Path $logs 'stdout.log';$err=Join-Path $logs 'stderr.log'
$p=Start-Process -FilePath $node -ArgumentList ('"'+$entry+'"') -WorkingDirectory $homeDir -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden
$p.Id|Set-Content -LiteralPath $pidFile -Encoding ASCII
$ok=$false
for($i=0;$i -lt 16;$i++){
 Start-Sleep -Milliseconds 800;$p.Refresh();if($p.HasExited){break}
 try{$s=Invoke-RestMethod 'http://127.0.0.1:8792/api/status' -TimeoutSec 4;if($s.state -eq 'running' -and $s.pid -eq $p.Id){$ok=$true;break}}catch{}
}
if(-not $ok){Get-Content $err -Tail 30 -ErrorAction SilentlyContinue;throw "AUTONOMY_V2_START_NOT_VERIFIED_PID=$($p.Id)"}
Write-Host "AUTONOMY_V2=RUNNING PID=$($p.Id)"
Write-Host 'DASHBOARD=http://127.0.0.1:8792/'
Write-Host 'REA_TOOLS_EXECUTED=0'
