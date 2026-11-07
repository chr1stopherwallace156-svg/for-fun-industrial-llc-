# Approved redirect target for the official GSA Auctions GET API.
# Never log the signed URL: its query string contains temporary AWS credentials.
function Test-FIApprovedGsaRedirect {
 [CmdletBinding()]
 param([Parameter(Mandatory=$true)][uri]$From,[Parameter(Mandatory=$true)][string]$Location)
 try { $to=[uri]::new($From,$Location) } catch { return $false }
 if($From.Scheme -cne 'https' -or $From.Host -cne 'api.gsa.gov' -or $From.AbsolutePath -cne '/assets/gsaauctions/v2/auctions'){return $false}
 if($to.Scheme -cne 'https' -or $to.Host -cne 'gsa-prod-ppms-attachments-prod.s3.amazonaws.com'){return $false}
 if($to.AbsolutePath -cne '/auctions/active-auctions.json' -or -not $to.IsDefaultPort -or $to.UserInfo -or $to.Fragment){return $false}
 $q=$to.Query
 if($q -notmatch '(?i)(?:^\?|&)X-Amz-Algorithm=AWS4-HMAC-SHA256(?:&|$)'){return $false}
 if($q -notmatch '(?i)(?:^\?|&)X-Amz-Signature=[0-9a-f]{16,}(?:&|$)'){return $false}
 if($q -notmatch '(?i)(?:^\?|&)X-Amz-Credential=[^&]+(?:&|$)'){return $false}
 if($q -match '(?i)(?:^\?|&)api_key='){return $false}
 return $true
}
