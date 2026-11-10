# FI_PHASE22_DEMO_V1 — create a synthetic request; ask local Qwen to select.
# No optimizer execution or REA tools. Prints the proposal ID and exact SHA to review.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Cli=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation\src\workflows\phase22-cli.mjs'
if(-not(Test-Path -LiteralPath $Cli -PathType Leaf)){throw 'FUN_PHASE22_PILOT_INSTALL_REQUIRED'}
$node=(Get-Command node.exe -ErrorAction Stop).Source
$folder=Join-Path $env:LOCALAPPDATA 'FunIndustrial\WorkflowRuntime\samples'
New-Item -ItemType Directory -Path $folder -Force -ErrorAction Stop|Out-Null
$sample=Join-Path $folder ('phase22-synthetic-'+[guid]::NewGuid().ToString('N')+'.json')
$request=[ordered]@{
 goal='DEMO ONLY: Choose the candidate that minimizes stock holding and shortage costs for the given demand samples. No real business changes.'
 candidates=@(
  [ordered]@{action='inventory';problem=[ordered]@{
   demand_samples=@(3,4,3,6,7,4,5,8,5,4);min_stock=0;max_stock=12
   holding_cost=1;shortage_cost=3;trials=48
  }},
  [ordered]@{action='allocation';problem=[ordered]@{
   budget=20;labor_capacity=12;projects=@(
    [ordered]@{id='repair';cost=6;labor=4;value=15;max_units=2},
    [ordered]@{id='inspection';cost=4;labor=2;value=8;max_units=3}
   )
  }},
  [ordered]@{action='route';problem=[ordered]@{
   depot=0;cost_matrix=@(@(0,4,7,5),@(4,0,2,9),@(7,2,0,3),@(5,9,3,0))
  }}
 )
}
try{
 [IO.File]::WriteAllText($sample,($request|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
 & $node $Cli draft $sample
 if($LASTEXITCODE -ne 0){throw 'FUN_PHASE22_DRAFT_HOLD'}
 Write-Host 'FUN_PHASE22_PILOT=DRAFT_ONLY OPERATOR_RUN=NOT_AUTHORIZED'
}finally{
 Remove-Item -LiteralPath $sample -Force -ErrorAction SilentlyContinue
}
