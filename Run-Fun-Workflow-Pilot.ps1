# FI_WORKFLOW_DEMO_V1 — synthetic metrics; stats only, no model call or external action.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$cli=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation\src\workflows\cli.mjs'
if(-not(Test-Path -LiteralPath $cli -PathType Leaf)){throw 'FUN_WORKFLOW_DEMO_INSTALL_REQUIRED'}
$node=(Get-Command node.exe -ErrorAction Stop).Source
$folder=Join-Path $env:LOCALAPPDATA 'FunIndustrial\WorkflowRuntime\samples'
New-Item -ItemType Directory -Path $folder -Force|Out-Null
$file=Join-Path $folder ('synthetic-inventory-'+[guid]::NewGuid().ToString('N')+'.json')
$spec=[ordered]@{
 goal='DEMO ONLY: explain three synthetic inventory measurements. No actual inventory system changes.'
 steps=@(
  [ordered]@{id='measure';kind='stats';values=@(4,10,6)},
  [ordered]@{id='summarize';kind='model_summary';from='measure';max_tokens=128},
  [ordered]@{id='operator_review';kind='review'}
 )
 output_token_budget=256
}
try{
 [IO.File]::WriteAllText($file,($spec|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 $first=(& $node $cli create $file)
 if($LASTEXITCODE -ne 0){throw 'WORKFLOW_CREATE_HOLD'}
 $created=$first|ConvertFrom-Json
 if($created.event -ne 'FUN_WORKFLOW_CLI_RESULT' -or $created.state -ne 'ready'){throw 'WORKFLOW_CREATE_RESULT_INVALID'}
 $second=(& $node $cli step $created.id)
 if($LASTEXITCODE -ne 0){throw 'WORKFLOW_STATS_HOLD'}
 $advanced=$second|ConvertFrom-Json
 if($advanced.state -ne 'ready' -or [int]$advanced.cursor -ne 1 -or
    [int]$advanced.results.measure.output.sum -ne 20 -or
    [int]$advanced.used_completion_tokens -ne 0){throw 'WORKFLOW_STATS_VALIDATION_HOLD'}
 Write-Host ('FUN_WORKFLOW_PILOT=PASS ID='+$created.id+' DETERMINISTIC_STEP=COMPLETED MODEL_CALLS=0 NEXT=model_summary')
 Write-Host ('FUN_WORKFLOW_NEXT_COMMAND=node "'+$cli+'" step '+$created.id)
 Write-Host ('FUN_WORKFLOW_REVIEW_COMMAND=node "'+$cli+'" step '+$created.id+' ; node "'+$cli+'" review '+$created.id+' approve')
}finally{
 Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
}
