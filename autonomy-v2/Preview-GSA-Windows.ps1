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
 $response=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 45 -Headers @{Accept='application/json'} -MaximumRedirection 0 -ErrorAction Stop
 if([int]$response.StatusCode -ne 200){throw "GSA_HTTP_$($response.StatusCode)"}
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
