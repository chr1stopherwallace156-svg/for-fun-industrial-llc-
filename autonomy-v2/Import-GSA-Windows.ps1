# GSA official auction import via Windows HTTPS and an offline tested parser.
# One-off data import to existing Autonomy dashboard. No bids, purchases, account operations or service restarts.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$installed=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github'
$parser=Join-Path $installed 'GSA-Import-From-File.mjs'
if(-not(Test-Path -LiteralPath $parser -PathType Leaf)){throw 'GSA_IMPORT_BRIDGE_NOT_INSTALLED'}
$worker=Invoke-RestMethod 'http://127.0.0.1:8792/api/status' -TimeoutSec 15
$platform=Invoke-RestMethod 'http://127.0.0.1:8789/api/status' -TimeoutSec 15
if($worker.application -ne 'Fun Industrial Autonomous Workers' -or $worker.state -ne 'running'){throw 'AUTONOMY_WORKER_NOT_RUNNING'}
if($platform.application -ne 'Fun Industrial Platform'){throw 'DASHBOARD_8789_NOT_RUNNING'}
$temp=Join-Path ([IO.Path]::GetTempPath()) ('fi-gsa-official-'+[guid]::NewGuid().ToString('N')+'.json')
$key=if([string]::IsNullOrWhiteSpace($env:GSA_API_KEY)){'DEMO_KEY'}else{$env:GSA_API_KEY}
$auth=if($key -eq 'DEMO_KEY'){'DEMO_ONLY'}else{'PERSONAL_KEY'}
try {
 $u='https://api.gsa.gov/assets/gsaauctions/v2/auctions?format=JSON&api_key='+[uri]::EscapeDataString($key)
 $policy=Join-Path $PSScriptRoot 'GSA-RedirectPolicy.ps1'
 if(-not(Test-Path -LiteralPath $policy -PathType Leaf)){throw 'GSA_REDIRECT_POLICY_MISSING'}
 . $policy
 $origin=[uri]$u
 $response=$null
 $destination=$null
 try {
  $response=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 45 -Headers @{Accept='application/json'} -MaximumRedirection 0 -ErrorAction Stop
 } catch {
  $ex=$_.Exception
  if($null -eq $ex.Response){throw 'GSA_INITIAL_REQUEST_FAILED_NO_HTTP_RESPONSE'}
  $status=[int]$ex.Response.StatusCode
  if($status -ne 303){throw "GSA_HTTP_$status"}
  $location=[string]$ex.Response.Headers['Location']
  if([string]::IsNullOrWhiteSpace($location)){throw 'GSA_REDIRECT_LOCATION_MISSING'}
  $destination=[uri]::new($origin,$location)
 }
 if($null -ne $response -and [int]$response.StatusCode -eq 303){
  $location=[string]$response.Headers['Location']
  if([string]::IsNullOrWhiteSpace($location)){throw 'GSA_REDIRECT_LOCATION_MISSING'}
  $destination=[uri]::new($origin,$location)
 }
 if($null -ne $destination){
  if(-not(Test-FIApprovedGsaRedirect -From $origin -Location $destination.AbsoluteUri)){
   Write-Host ("GSA_REDIRECT_REVIEW_NEEDED HOST="+$destination.Host+" PATH="+$destination.AbsolutePath) -ForegroundColor Yellow
   throw 'GSA_REDIRECT_TARGET_NOT_APPROVED'
  }
  Write-Host 'GSA_REDIRECT_APPROVED=TRUE SIGNED_URL_REDACTED=TRUE'
  try {
   $response=Invoke-WebRequest -Uri $destination.AbsoluteUri -UseBasicParsing -TimeoutSec 45 -Headers @{Accept='application/json'} -MaximumRedirection 0 -ErrorAction Stop
  } catch {
   $status=if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{0}
   throw "GSA_SIGNED_DOWNLOAD_FAILED_HTTP_$status"
  }
 }
 if($null -eq $response -or [int]$response.StatusCode -ne 200){throw 'GSA_FINAL_RESPONSE_NOT_200'}
 $body=[string]$response.Content
 $byteCount=[Text.Encoding]::UTF8.GetByteCount($body)
 if($byteCount -lt 2 -or $byteCount -gt 25000000){throw "GSA_RESPONSE_SIZE_INVALID=$byteCount"}
 if(-not($body.TrimStart().StartsWith('{') -or $body.TrimStart().StartsWith('['))){throw 'GSA_RESPONSE_NOT_JSON'}
 [IO.File]::WriteAllText($temp,$body,[Text.UTF8Encoding]::new($false))
 Write-Host "GSA_WINDOWS_REQUEST=PASS HTTP=$($response.StatusCode) AUTH=$auth BYTES=$byteCount"
 & $node $parser $temp
 if($LASTEXITCODE -ne 0){throw 'GSA_SNAPSHOT_IMPORT_FAILED'}
 $view=Invoke-RestMethod 'http://127.0.0.1:8789/api/autonomy/opportunities' -TimeoutSec 30
 if($view.gsaSnapshot.state -ne 'active' -or $view.gsaSnapshot.importedLots -lt 1){throw 'GSA_DASHBOARD_SNAPSHOT_NOT_VISIBLE'}
 Write-Host "GSA_8789_DASHBOARD=PASS IMPORTED=$($view.gsaSnapshot.importedLots) EXPIRES=$($view.gsaSnapshot.expiresAt)"
 Write-Host 'GSA_OFFICIAL_IMPORT=PASS WORKER_UNCHANGED=TRUE BIDS=0 REA_CALLS=0'
} catch {
 $message=[string]$_.Exception.Message
 if($key -ne 'DEMO_KEY'){$message=$message.Replace($key,'[REDACTED]').Replace([uri]::EscapeDataString($key),'[REDACTED]')}
 $message=$message -replace 'api_key=[^&\s]+','api_key=[REDACTED]'
 Write-Host ("GSA_OFFICIAL_IMPORT=FAILED REASON="+$message.Substring(0,[Math]::Min($message.Length,270))) -ForegroundColor Yellow
 throw 'GSA_WINDOWS_IMPORT_FAILED'
} finally {
 Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
}
