# Fun Industrial: native Windows-verified, official LA City permit CSV downloader.
# No certificate bypass, no arbitrary URL, no redirect to another host.
# Run only by the explicitly operator-requested real-data launch script.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)]
 [ValidateSet('la_permits_pre2010','la_permits_2010_2019','la_permits_2020_present')]
 [string]$Source
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if(-not $env:LOCALAPPDATA){throw 'FUN_LACITY_DOWNLOAD_LOCALAPPDATA_REQUIRED'}
$sourceUrls=@{
 la_permits_pre2010='https://data.lacity.org/api/v3/views/e67z-kt2n/export.csv'
 la_permits_2010_2019='https://data.lacity.org/api/v3/views/dyxf-7hc4/export.csv'
 la_permits_2020_present='https://data.lacity.org/api/v3/views/pi9x-tg5x/export.csv'
}
$remote=[Uri]($sourceUrls[$Source])
if($remote.Scheme -cne 'https' -or $remote.Host -cne 'data.lacity.org'){
 throw 'FUN_LACITY_FIXED_OFFICIAL_HTTPS_SOURCE_HOLD'
}
$directory=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RoofingBulkV2\official_downloads'
[void][IO.Directory]::CreateDirectory($directory)
$destination=Join-Path $directory ($Source+'.csv')
if(Test-Path -LiteralPath $destination -PathType Leaf){
 $cached=Get-Item -LiteralPath $destination -ErrorAction Stop
 if($cached.Length -lt 32){throw 'FUN_LACITY_EXISTING_CSV_TOO_SMALL_HOLD'}
 Write-Host ('FUN_LACITY_CACHED_CSV_RETAINED_BYTES='+$cached.Length)
 Write-Host 'FUN_LACITY_NO_NETWORK_REQUEST=TRUE'
 exit 0
}
# .NET Framework HttpClient uses Windows' OS-managed certificate validation,
# unlike the previously failing CPython OpenSSL chain. Never relax TLS checking.
Add-Type -AssemblyName System.Net.Http
$handler=[System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect=$false
$handler.AutomaticDecompression=[System.Net.DecompressionMethods]::None
$client=[System.Net.Http.HttpClient]::new($handler)
$client.Timeout=[TimeSpan]::FromMinutes(60)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('FunIndustrial-Roofing-PublicData/3.0')
$client.DefaultRequestHeaders.Accept.ParseAdd('text/csv')
$maxBytes=[long](8GB)
$tempPath=Join-Path $directory ($Source+'.windows-verified-'+[guid]::NewGuid().ToString('N')+'.incomplete')
$response=$null
$stream=$null
$file=$null
$sha=[Security.Cryptography.SHA256]::Create()
$success=$false
$size=[long]0
try{
 $url=$remote
 for($redirectCount=0;$redirectCount -le 5;$redirectCount++){
  $response=$client.GetAsync($url,[System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  $status=[int]$response.StatusCode
  if($status -in @(301,302,303,307,308)){
   if($redirectCount -eq 5){throw 'FUN_LACITY_TOO_MANY_REDIRECTS'}
   $location=$response.Headers.Location
   if($null -eq $location){throw 'FUN_LACITY_REDIRECT_MISSING_LOCATION'}
   $next=[Uri]::new($url,$location)
   if($next.Scheme -cne 'https' -or $next.Host -cne 'data.lacity.org'){
    throw 'FUN_LACITY_REDIRECT_OUTSIDE_APPROVED_HTTPS_ORIGIN'
   }
   $response.Dispose();$response=$null
   $url=$next
   continue
  }
  if($status -ne 200){throw ('FUN_LACITY_OFFICIAL_SOURCE_HTTP_'+$status)}
  break
 }
 if($null -eq $response -or [int]$response.StatusCode -ne 200){
  throw 'FUN_LACITY_NO_VERIFIED_SUCCESS_RESPONSE'
 }
 $media=''
 if($null -ne $response.Content.Headers.ContentType){
  $media=[string]$response.Content.Headers.ContentType.MediaType
 }
 if($media -and $media -notin @('text/csv','text/plain','application/csv',
                                'application/octet-stream','application/vnd.ms-excel')){
  throw ('FUN_LACITY_RESPONSE_NOT_CSV_MEDIA='+$media)
 }
 $expected=$response.Content.Headers.ContentLength
 if($null -ne $expected -and [long]$expected -gt $maxBytes){
  throw 'FUN_LACITY_CSV_ABOVE_8GB_BOUND'
 }
 $stream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
 $file=[IO.FileStream]::new($tempPath,
  [IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 $buffer=New-Object byte[] (1024*1024)
 $first=$true
 while($true){
  $read=$stream.Read($buffer,0,$buffer.Length)
  if($read -eq 0){break}
  $size += [long]$read
  if($size -gt $maxBytes){throw 'FUN_LACITY_CSV_ABOVE_8GB_BOUND'}
  if($first){
   $first=$false
   $start=[Text.Encoding]::UTF8.GetString($buffer,0,[Math]::Min($read,256)).TrimStart([char[]]@([char]0xFEFF,[char]32,[char]9,[char]10,[char]13))
   if($start.StartsWith('<') -or $start.StartsWith('{') -or $start.StartsWith('[')){
    throw 'FUN_LACITY_SOURCE_RETURNED_NON_CSV_BODY'
   }
  }
  $file.Write($buffer,0,$read)
  [void]$sha.TransformBlock($buffer,0,$read,$buffer,0)
 }
 if($size -lt 32){throw 'FUN_LACITY_CSV_EMPTY_OR_TRUNCATED'}
 if($null -ne $expected -and $size -ne [long]$expected){
  throw 'FUN_LACITY_CSV_LENGTH_MISMATCH'
 }
 [void]$sha.TransformFinalBlock([byte[]]@(),0,0)
 $file.Flush();$file.Dispose();$file=$null
 $digest=[BitConverter]::ToString($sha.Hash).Replace('-','').ToLowerInvariant()
 if(Test-Path -LiteralPath $destination){throw 'FUN_LACITY_OUTPUT_ALREADY_EXISTS_CONCURRENT_HOLD'}
 [IO.File]::Move($tempPath,$destination)
 $success=$true
 Write-Host ('FUN_LACITY_NATIVE_CERTIFICATE_VALIDATION=PASS')
 Write-Host ('FUN_LACITY_VERIFIED_OFFICIAL_CSV='+$Source)
 Write-Host ('FUN_LACITY_CSV_BYTES='+$size)
 Write-Host ('FUN_LACITY_CSV_SHA256='+$digest)
 Write-Host 'FUN_LACITY_CSV_CONTENT_IMPORT=NOT_YET_VERIFIED'
}catch{
 $why=[string]$_.Exception.GetBaseException().Message
 if($why.Length -gt 220){$why=$why.Substring(0,220)}
 throw ('FUN_LACITY_NATIVE_HTTPS_HOLD='+$why)
}finally{
 if($null -ne $file){$file.Dispose()}
 if($null -ne $stream){$stream.Dispose()}
 if($null -ne $response){$response.Dispose()}
 $sha.Dispose()
 $client.Dispose()
 $handler.Dispose()
 if(-not $success -and (Test-Path -LiteralPath $tempPath)){
  Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
 }
}
