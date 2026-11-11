# Execute ONLY the isolated AST validator, not the supervisor or diagnostic.
# Ensures comment text is ignored and real executable mutations are refused.
$ErrorActionPreference='Stop'
$path=Join-Path $PSScriptRoot '..\Diagnose-Fun-Dashboard8789-Supervisor.ps1'
$watch=Join-Path $PSScriptRoot '..\Watch-Fun-Dashboard-8789.ps1'
foreach($p in @($path,$watch)){if(-not(Test-Path -LiteralPath $p -PathType Leaf)){throw 'AST_TEST_SOURCE_MISSING'}}
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Resolve-Path -LiteralPath $path).Path,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'AST_TEST_DIAGNOSTIC_PARSE_HOLD'}
$defs=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Assert-ReadOnlyFunctionAst'},$true))
if($defs.Count -ne 1){throw 'AST_VALIDATOR_MISSING'}
function Hold([string]$why){throw ("FUN_AST_TEST_HOLD="+$why)}
. ([scriptblock]::Create($defs[0].Extent.Text))
function Get-Function([string]$source,[string]$name){
 $tokens2=$null;$errors2=$null
 $ast2=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens2,[ref]$errors2)
 if($errors2.Count){throw 'AST_TEST_FIXTURE_PARSE_HOLD'}
 $found=@($ast2.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true))
 if($found.Count -ne 1){throw 'AST_TEST_FIXTURE_FUNCTION_MISSING'}
 return $found[0]
}
$watchTokens=$null;$watchErrors=$null
$watchAst=[Management.Automation.Language.Parser]::ParseFile((Resolve-Path -LiteralPath $watch).Path,[ref]$watchTokens,[ref]$watchErrors)
if($watchErrors.Count){throw 'AST_TEST_SUPERVISOR_PARSE_HOLD'}
foreach($name in @('Confirm-Owner','Policy-Ready','Endpoint-Ready')){
 $fn=@($watchAst.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true))
 if($fn.Count -ne 1){throw 'AST_TEST_CANONICAL_FUNCTION_MISSING'}
 Assert-ReadOnlyFunctionAst $fn[0] $name
}
$comment=Get-Function 'function Safe { # Start-Process; Stop-ScheduledTask
 Get-Process -Id 1 }' 'Safe'
Assert-ReadOnlyFunctionAst $comment 'Safe'
$badCases=@(
 @{code='function BadStart { Start-Process -FilePath bad.exe }'; name='BadStart'; prefix='UNEXPECTED_EXECUTABLE_COMMAND_IN_FUNCTION_'},
 @{code='function BadWrite { [IO.File]::WriteAllText("C:\not-real.txt","bad") }'; name='BadWrite'; prefix='UNEXPECTED_EXECUTABLE_METHOD_IN_FUNCTION_'},
 @{code='function BadDynamic { & $untrustedCommand }'; name='BadDynamic'; prefix='UNEXPECTED_EXECUTABLE_COMMAND_IN_FUNCTION_'},
 @{code='function BadStatus { Write-Status "running" "fake" }'; name='BadStatus'; prefix='UNEXPECTED_EXECUTABLE_COMMAND_IN_FUNCTION_'}
)
foreach($fixture in $badCases){
 $fail=$false
 $func=Get-Function $fixture.code $fixture.name
 try{Assert-ReadOnlyFunctionAst $func $fixture.name}catch{$fail=[string]$_.Exception.Message -like ('*'+$fixture.prefix+$fixture.name+'*')}
 if(-not $fail){throw ('AST_TEST_MUTATION_NOT_REJECTED_'+$fixture.name)}
}
Write-Host 'FUN_SUPERVISOR_AST_VALIDATION=PASS CANONICAL_READ_ONLY=PASS COMMENTS_IGNORED=PASS EXECUTABLE_MUTATIONS_DENIED=PASS'
