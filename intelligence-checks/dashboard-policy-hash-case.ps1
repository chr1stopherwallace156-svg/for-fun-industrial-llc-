# Dynamic unit test for isolated HashText function in Phase 5.
# The reconciliation script itself is never run; no host process/ports/policy touched.
$ErrorActionPreference="Stop"
$path=Join-Path $PSScriptRoot '..\Reconcile-Fun-Dashboard8789-Policy.ps1'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Resolve-Path -LiteralPath $path).Path,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'HASH_TEST_RECONCILER_POWERSHELL_PARSE_HOLD'}
$defs=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'HashText'},$true))
if($defs.Count -ne 1){throw 'HASH_TEST_EXACT_FUNCTION_MISSING'}
$functionSource=$defs[0].Extent.Text
if($functionSource -notmatch 'FUN_POLICY_DIGEST_EMPTY_INPUT_DENIED'){throw 'HASH_TEST_EMPTY_GUARD_MISSING'}
# Execute ONLY this 14-line pure hash function, never the reconciliation script.
. ([scriptblock]::Create($functionSource))
$expected="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
$abc=HashText "abc"
if($abc -cne $expected){throw "HASH_TEST_KNOWN_ANSWER_HOLD=$abc"}
if((HashText "Fun Industrial policy review") -ceq $abc){throw 'HASH_TEST_CONTENT_VARIATION_HOLD'}
$denied=$false
try{HashText "" | Out-Null}catch{$denied=$_.Exception.Message -match 'FUN_POLICY_DIGEST_EMPTY_INPUT_DENIED'}
if(-not $denied){throw 'HASH_TEST_EMPTY_INPUT_NOT_REJECTED'}
$payload='{"serverSha256":"dfe655fdb384","originalPolicySha256":"2481320d605a","reaApprovedNamesHash":"a77129d8e7a3"}'
$real=HashText $payload
if($real -eq "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"){throw 'HASH_TEST_REVIEW_DATA_HASHED_TO_EMPTY'}
if($real -notmatch '^[0-9a-f]{64}$'){throw 'HASH_TEST_HEX_INVALID'}
Write-Host 'FUN_POLICY_DIGEST_HASH_TEST=PASS KNOWN_ANSWER=PASS EMPTY_REJECTED=PASS NONEMPTY_REVIEW=PASS'
