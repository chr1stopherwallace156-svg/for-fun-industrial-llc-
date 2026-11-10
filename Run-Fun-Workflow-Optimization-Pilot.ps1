# FI_WORKFLOW_OPTIMIZATION_PILOT_V1 — synthetic allocation solved without Qwen.
# Operator-invoked, no business action, no REA, no dashboard or server changes.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Cli=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation\src\workflows\cli.mjs'
$Runner=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation\src\optimization\runner.mjs'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
if(-not(Test-Path -LiteralPath $Cli -PathType Leaf) -or
   -not(Test-Path -LiteralPath $Runner -PathType Leaf)){throw 'FUN_WORKFLOW_OPTIMIZATION_INSTALL_REQUIRED'}
$Folder=Join-Path $env:LOCALAPPDATA 'FunIndustrial\WorkflowRuntime\samples'
New-Item -ItemType Directory -Path $Folder -Force|Out-Null
$specFile=Join-Path $Folder ('synthetic-allocation-'+[guid]::NewGuid().ToString('N')+'.json')
$spec=[ordered]@{
 goal='DEMO ONLY: maximize synthetic project value using supplied budget and labor constraints. Never buy, schedule or dispatch anything.'
 output_token_budget=256
 steps=@(
  [ordered]@{id='solve';kind='optimization';action='allocation';problem=[ordered]@{
   budget=20;labor_capacity=12;projects=@(
    [ordered]@{id='repair';cost=6;labor=4;value=15;max_units=2},
    [ordered]@{id='inspection';cost=4;labor=2;value=8;max_units=3},
    [ordered]@{id='upgrade';cost=10;labor=6;value=22;max_units=1}
   )
  }},
  [ordered]@{id='summary';kind='model_summary';from='solve';max_tokens=128},
  [ordered]@{id='review';kind='review'}
 )
}
try{
 [IO.File]::WriteAllText($specFile,($spec|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
 $created=& $Node $Cli create $specFile
 if($LASTEXITCODE -ne 0){throw 'WORKFLOW_OPTIMIZATION_CREATE_HOLD'}
 $wf=$created|ConvertFrom-Json
 if($wf.state -ne 'ready' -or $wf.cursor -ne 0){throw 'WORKFLOW_OPTIMIZATION_CREATE_STATE_INVALID'}
 $performed=& $Node $Cli step $wf.id
 if($LASTEXITCODE -ne 0){throw 'WORKFLOW_OPTIMIZATION_STEP_HOLD'}
 $r=$performed|ConvertFrom-Json
 if($r.state -ne 'ready' -or $r.cursor -ne 1){
  Write-Host ('FUN_WORKFLOW_OPTIMIZATION_PILOT_HOLD ID='+$wf.id+' STATE='+$r.state+' REASON='+$r.hold_reason)
  throw 'WORKFLOW_OPTIMIZATION_SOLVER_HOLD'
 }
 $out=$r.results.solve.output
 if($out.engine -ne 'google-or-tools-cp-sat' -or
    $out.decision_support_only -ne $true -or $out.external_actions_executed -ne 0 -or
    $out.rea_tools_executed -ne 0 -or $out.result.solution_found -ne $true -or
    $out.result.budget_used -gt 20 -or $out.result.labor_used -gt 12 -or
    $r.used_completion_tokens -ne 0){throw 'WORKFLOW_OPTIMIZATION_RESULT_CHECK_HOLD'}
 Write-Host ('FUN_WORKFLOW_OPTIMIZATION_PILOT=PASS ID='+$wf.id+' ENGINE=GOOGLE_OR_TOOLS MODEL_CALLS=0 COMPLETION_TOKENS=0')
 Write-Host ('SYNTHETIC_RESULT='+($out.result|ConvertTo-Json -Compress -Depth 8))
 Write-Host ('NEXT_MODEL_COMMAND=node "'+$Cli+'" step '+$wf.id)
 Write-Host 'OPERATOR_REVIEW=NOT_GRANTED'
}finally{Remove-Item -LiteralPath $specFile -Force -ErrorAction SilentlyContinue}
