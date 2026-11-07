# Offline tests of GSA redirect approval — no network and no secrets.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'GSA-RedirectPolicy.ps1')
$from=[uri]'https://api.gsa.gov/assets/gsaauctions/v2/auctions?api_key=DEMO_KEY&format=JSON'
$sign='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
$approved='https://gsa-prod-ppms-attachments-prod.s3.amazonaws.com/auctions/active-auctions.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=TEST&X-Amz-Signature='+$sign
$cases=@(
 @{label='official_signed_auction_file';url=$approved;expected=$true},
 @{label='untrusted_http';url=$approved.Replace('https://','http://');expected=$false},
 @{label='unknown_s3_bucket';url=$approved.Replace('gsa-prod-ppms-attachments-prod.s3.amazonaws.com','attacker.s3.amazonaws.com');expected=$false},
 @{label='wrong_file';url=$approved.Replace('active-auctions.json','secret.json');expected=$false},
 @{label='unsigned_url';url='https://gsa-prod-ppms-attachments-prod.s3.amazonaws.com/auctions/active-auctions.json';expected=$false},
 @{label='credential_forwarding';url=$approved+'&api_key=TEST';expected=$false},
 @{label='untrusted_port';url=$approved.Replace('s3.amazonaws.com/','s3.amazonaws.com:8443/');expected=$false},
 @{label='unexpected_source';url=$approved;expected=$false;source=[uri]'https://untrusted.example.com/redirect'}
)
$pass=0
foreach($case in $cases){
 $source=if($case.source){$case.source}else{$from}
 $actual=Test-FIApprovedGsaRedirect -From $source -Location $case.url
 if($actual -ne $case.expected){throw "REDIRECT_POLICY_TEST_FAILED=$($case.label)"}
 $pass++
}
Write-Host "GSA_REDIRECT_POLICY_TESTS=PASS COUNT=$pass NO_NETWORK=TRUE"
