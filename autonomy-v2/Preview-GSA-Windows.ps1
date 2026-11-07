# GSA official auction preview via Windows PowerShell HTTPS (not Node fetch).
# One-off, read-only. Never changes environment, saves secrets, schedules jobs or places bids.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$parser=Join-Path $PSScriptRoot 'GSA-Preview-From-File.mjs'
if(-not(Test-Path -LiteralPath $parser -PathType Leaf)){throw 'GSA_LOCAL_PARSER_NOT_FOUND'}
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
 if($LASTEXITCODE -ne 0){throw 'GSA_LOCAL_PARSER_FAILED'}
 Write-Host 'GSA_PREVIEW_PIPELINE=PASS WORKER_UNCHANGED=TRUE REA_CALLS=0'
} catch {
 $message=[string]$_.Exception.Message
 if($key -ne 'DEMO_KEY'){$message=$message.Replace($key,'[REDACTED]').Replace([uri]::EscapeDataString($key),'[REDACTED]')}
 $message=$message -replace 'api_key=[^&\s]+','api_key=[REDACTED]'
 Write-Host ("GSA_PREVIEW_PIPELINE=FAILED REASON="+$message.Substring(0,[Math]::Min($message.Length,270))) -ForegroundColor Yellow
 throw 'GSA_WINDOWS_PREVIEW_FAILED'
} finally {
 Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
}
