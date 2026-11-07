# Offline qualification of the exact GSA signed S3 redirect policy.
# Does not make a network request, read credentials or modify running services.
$ErrorActionPreference="Stop"
$policy=Join-Path (Split-Path -Parent $PSScriptRoot) "GSA-RedirectPolicy.ps1"
if(-not(Test-Path -LiteralPath $policy -PathType Leaf)){throw "GSA_POLICY_MISSING"}
. $policy
$origin=[uri]"https://api.gsa.gov/assets/gsaauctions/v2/auctions?format=JSON&api_key=DEMO_KEY"
$sig=("a"*64)
$approved="https://gsa-prod-ppms-attachments-prod.s3.amazonaws.com/auctions/active-auctions.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=EXAMPLE%2F20261107%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature="+$sig
$cases=@(
 @{label="expected_https_signed_json";url=$approved;allow=$true},
 @{label="unrelated_host";url=$approved.Replace("gsa-prod-ppms-attachments-prod.s3.amazonaws.com","example.org");allow=$false},
 @{label="http_rejected";url=$approved.Replace("https://","http://");allow=$false},
 @{label="wrong_path";url=$approved.Replace("active-auctions.json","unrelated.json");allow=$false},
 @{label="unsigned_url";url="https://gsa-prod-ppms-attachments-prod.s3.amazonaws.com/auctions/active-auctions.json";allow=$false},
 @{label="api_key_query_rejected";url=$approved+"&api_key=TEST";allow=$false},
 @{label="embedded_username";url=$approved.Replace("https://","https://foo@");allow=$false},
 @{label="wrong_bucket_subdomain";url=$approved.Replace("gsa-prod-ppms-attachments-prod.s3.amazonaws.com","gsa-prod-ppms-attachments-prod.s3.amazonaws.com.evil.example");allow=$false}
)
foreach($case in $cases){
 $got=[bool](Test-FIApprovedGsaRedirect -From $origin -Location ([string]$case.url))
 if($got -ne $case.allow){throw "GSA_REDIRECT_POLICY_FAIL=$($case.label)"}
 Write-Host "PASS=$($case.label)"
}
$badOrigin=[uri]"https://example.com/assets/gsaauctions/v2/auctions"
if(Test-FIApprovedGsaRedirect -From $badOrigin -Location $approved){throw "GSA_REDIRECT_POLICY_BAD_ORIGIN_ACCEPTED"}
Write-Host "GSA_REDIRECT_POLICY=PASS CASES=$($cases.Count+1)"
