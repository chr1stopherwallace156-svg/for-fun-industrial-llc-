# One-command, start-only, loopback-only Spatial System V3 preview.
# Does not stop, restart, reconfigure, or proxy any existing services.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$ExpectedBranch='feature/spatial-system-v31-immersive-iphone-20261115'
$ExpectedOrigin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Runner=Join-Path $Root 'src\spatial-v3\server.mjs'
$Test=Join-Path $Root 'intelligence-checks\spatial-system-v3-preview-case.mjs'
$Runtime=Join-Path $env:LOCALAPPDATA 'FunIndustrial\SpatialV31Immersive'
$Log=Join-Path $Runtime ('logs\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
$Url='http://127.0.0.1:8808'
function Hold([string]$reason){throw ('FUN_SPATIAL_V31_IMMERSIVE_HOLD='+$reason)}
function RequireFile([string]$f){
 if(!(Test-Path -LiteralPath $f -PathType Leaf)){Hold ('SOURCE_MISSING='+$f)}
 if(((Get-Item -LiteralPath $f).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold ('SYMLINK_FILE_REFUSED='+$f)}
}
$Origin=(& git.exe -C $Root remote get-url origin|Out-String).Trim()
$Branch=(& git.exe -C $Root branch --show-current|Out-String).Trim()
$Dirty=@(& git.exe -C $Root status --porcelain=v1 --untracked-files=all)
if($LASTEXITCODE -ne 0 -or $Origin -cne $ExpectedOrigin -or $Branch -cne $ExpectedBranch -or $Dirty.Count){
 Hold 'UNREVIEWED_REPO_OR_DIRTY_SOURCE'
}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
RequireFile $Node
foreach($file in @(
 $Runner,$Test,
 (Join-Path $Root 'src\spatial-v3\graph.mjs'),
 (Join-Path $Root 'src\spatial-v3\observer.mjs'),
 (Join-Path $Root 'src\spatial-v3\spatial-v3.js'),
 (Join-Path $Root 'src\spatial-v3\index.html'),
 (Join-Path $Root 'src\spatial-v3\spatial-v3.css')
)){RequireFile $file}
foreach($f in @($Runner,$Test,
 (Join-Path $Root 'src\spatial-v3\graph.mjs'),
 (Join-Path $Root 'src\spatial-v3\observer.mjs'),
 (Join-Path $Root 'src\spatial-v3\spatial-v3.js'))){
 & $Node --check $f
 if($LASTEXITCODE -ne 0){Hold ('NODE_SYNTAX_INVALID='+$f)}
}
& $Node --test $Test
if($LASTEXITCODE -ne 0){Hold 'PREVIEW_TESTS_FAILED'}
Write-Host 'FUN_SPATIAL_V31_SOURCE_TESTS=PASS'
$Current=@(Get-NetTCPConnection -LocalPort 8808 -State Listen -ErrorAction SilentlyContinue)
if($Current.Count){
 if($Current.Count -ne 1 -or $Current[0].LocalAddress -cne '127.0.0.1'){Hold '8808_UNKNOWN_BIND_NO_RESTART'}
 $PidOwner=[int]$Current[0].OwningProcess
 $ProcessOwner=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PidOwner) -ErrorAction Stop
 if(!$ProcessOwner -or $ProcessOwner.Name -cne 'node.exe' -or
  ([string]$ProcessOwner.CommandLine).IndexOf('spatial-v3\server.mjs',[StringComparison]::OrdinalIgnoreCase) -lt 0){
  Hold '8808_OWNER_NOT_REVIEWED_NO_RESTART'
 }
 try{
  $status=Invoke-RestMethod ($Url+'/api/spatial-v3/topology') -TimeoutSec 6 -ErrorAction Stop
  if($status.version -cne 'fun-industrial-spatial-system-v3-preview-1' -or
   $status.read_only -ne $true -or $status.external_actions -ne 0){Hold '8808_EXISTING_IDENTITY_INVALID'}
 }catch{Hold '8808_EXISTING_STATUS_UNAVAILABLE'}
 Write-Host ('FUN_SPATIAL_V31_IMMERSIVE=ALREADY_RUNNING PID='+$PidOwner)
 Write-Host ('FUN_SPATIAL_V31_URL='+$Url+'/')
 return
}
if($CheckOnly){
 Write-Host 'FUN_SPATIAL_V31_PREFLIGHT=PASS NO_START=TRUE EXISTING_SERVICES=UNTOUCHED'
 return
}
# Canvas2D uses only the browser's native renderer. No npm install or CDN.
Write-Host 'FUN_SPATIAL_V31_RENDERER=LOCAL_CANVAS_2D_NO_VENDOR_OR_WEBGL_REQUIRED'
New-Item -ItemType Directory -Path $Log -Force|Out-Null
$Child=Start-Process -FilePath $Node -ArgumentList ('"'+$Runner+'" --serve') -WorkingDirectory $Root -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $Log '8808.stdout.log') -RedirectStandardError (Join-Path $Log '8808.stderr.log')
$ready=$false
for($i=0;$i -lt 60;$i++){
 Start-Sleep -Milliseconds 250
 $l=@(Get-NetTCPConnection -LocalPort 8808 -State Listen -ErrorAction SilentlyContinue)
 if($l.Count -ne 1 -or $l[0].LocalAddress -cne '127.0.0.1' -or
  [int]$l[0].OwningProcess -ne [int]$Child.Id){continue}
 try{
  $health=Invoke-WebRequest ($Url+'/') -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
  $top=Invoke-RestMethod ($Url+'/api/spatial-v3/topology') -TimeoutSec 3 -ErrorAction Stop
  if($health.StatusCode -eq 200 -and
   $health.Headers['x-fi-spatial-v3'] -ceq 'fun-industrial-spatial-system-v3-preview-1' -and
   $top.read_only -eq $true -and $top.external_actions -eq 0){
   $ready=$true;break
  }
 }catch{}
}
if(!$ready){
 Write-Host ('FUN_SPATIAL_V31_LOGS='+$Log)
 $ErrFile=Join-Path $Log '8808.stderr.log'
 if(Test-Path -LiteralPath $ErrFile -PathType Leaf){
  Get-Content -LiteralPath $ErrFile -Tail 12 | ForEach-Object{Write-Warning $_}
 }
 Hold '8808_BROWSER_OR_VENDOR_NOT_READY'
}
Write-Host ('FUN_SPATIAL_V31_IMMERSIVE=PASS PID='+$Child.Id)
Write-Host ('FUN_SPATIAL_V31_URL='+$Url+'/')
Write-Host 'FUN_SPATIAL_V31_IPHONE_TUNNEL=LOCAL_18808_TO_PC_127.0.0.1_8808'
Write-Host 'FUN_SPATIAL_V31_V2_8802=UNTOUCHED PRIVATE_GATEWAY_8443=UNTOUCHED'
Write-Host 'FUN_SPATIAL_V31_NO_AUTONOMOUS_TOOL_ACTIONS=TRUE'
Write-Host 'FUN_SPATIAL_V31_IPHONE_TOUCH=CANVAS_2D_ROTATE_PINCH_SELECT'
Write-Host ('FUN_SPATIAL_V31_LOGS='+$Log)
