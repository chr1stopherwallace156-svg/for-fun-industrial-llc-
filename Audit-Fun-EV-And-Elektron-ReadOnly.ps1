# Read-only Fun EV source checks and Elektron runtime visibility.
# No elevated operations, task changes, process starts/stops, installs, ports opened,
# or changes to Elektron's software and state.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$testPath=Join-Path $root 'test\ev-engineering-v1.test.mjs'
$ev=Join-Path $root 'Run-Fun-EV-Engineering-V1.ps1'
if(!(Test-Path -LiteralPath $testPath -PathType Leaf) -or !(Test-Path -LiteralPath $ev -PathType Leaf)){throw 'FUN_EV_AUDIT_SOURCE_MISSING'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){$node=Get-Command node -ErrorAction SilentlyContinue}
if(-not $node){throw 'NODE_NOT_FOUND_FOR_EV_TESTS'}
$ok=$true
Push-Location $root
try{
 & $node.Source --test 'test/ev-engineering-v1.test.mjs'
 if($LASTEXITCODE -ne 0){$ok=$false;Write-Output 'FUN_EV_OFFLINE_TESTS=FAIL'}
 else{Write-Output 'FUN_EV_OFFLINE_TESTS=PASS'}
 & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $ev -Action status
 if($LASTEXITCODE -ne 0){$ok=$false;Write-Output 'FUN_EV_STATUS=HOLD'}
}catch{
 $ok=$false
 Write-Output ('FUN_EV_AUDIT_HOLD='+$_.Exception.GetType().Name)
}finally{Pop-Location}
try{
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 foreach($service in @(@('OLLAMA','11434'),@('WORK','8766'),@('CHATWORK','8767'))){
  $name=[string]$service[0];$port=[int]$service[1]
  $found=@($listeners|Where-Object{$_.LocalPort -eq $port})
  if($found.Count -eq 0){Write-Output ("ELEKTRON_${name}_${port}=NOT_LISTENING");continue}
  $ids=@($found|Select-Object -ExpandProperty OwningProcess -Unique)
  Write-Output ("ELEKTRON_${name}_${port}=LISTENING PID="+($ids -join ','))
 }
}catch{
 Write-Output 'ELEKTRON_PORT_AUDIT=UNAVAILABLE'
}
try{
 $tasks=@(Get-ScheduledTask -ErrorAction Stop|Where-Object{
  ($_.TaskName -match '(?i)elektron|eur001|g4|chatwork|continuity|self.?heal') -or
  ($_.TaskPath -match '(?i)elektron')
 }|Sort-Object TaskPath,TaskName)
 Write-Output ('ELEKTRON_RELEVANT_TASKS_VISIBLE='+$tasks.Count)
 foreach($t in $tasks){Write-Output ('ELEKTRON_TASK='+$t.TaskPath+$t.TaskName+' STATE='+$t.State)}
}catch{Write-Output 'ELEKTRON_SCHEDULER_AUDIT=UNAVAILABLE'}
Write-Output 'ELEKTRON_G4_RELEASE=NOT_PROVEN_BY_THIS_AUDIT'
Write-Output 'ELEKTRON_CONVERSION_SAFETY_RELEASE=NOT_PROVEN_BY_THIS_AUDIT'
if(-not $ok){exit 1}
