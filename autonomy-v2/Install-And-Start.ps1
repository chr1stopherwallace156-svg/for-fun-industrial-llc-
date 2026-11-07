$ErrorActionPreference='Stop'
$source=Split-Path -Parent $MyInvocation.MyCommand.Path
$lab=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab'
$dest=Join-Path $lab 'autonomy-v2-github'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source
if(Test-Path $dest){throw "ALREADY_STAGED=$dest (use the staged Start.ps1 instead; refusing to overwrite)"}
if(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue){throw 'PORT_8792_ALREADY_IN_USE; leave existing service untouched'}
foreach($f in @('src\core.mjs','src\http.mjs','src\jobs.mjs','src\service.mjs')){& $node --check (Join-Path $source $f);if($LASTEXITCODE -ne 0){throw "SYNTAX_FAILED=$f"}}
& $node --test (Join-Path $source 'test\core.test.mjs')
if($LASTEXITCODE -ne 0){throw 'CORE_TESTS_FAILED'}
New-Item -ItemType Directory -Path $lab -Force|Out-Null
if(-not(Test-Path (Join-Path $lab 'node_modules\sidequest')) -or -not(Test-Path (Join-Path $lab 'node_modules\@sidequest\sqlite-backend'))){
 & $npm install --prefix $lab --no-audit --no-fund --save-exact sidequest '@sidequest/sqlite-backend'
 if($LASTEXITCODE -ne 0){throw 'SIDEQUEST_DEPENDENCY_INSTALL_FAILED'}
}
New-Item -ItemType Directory -Path $dest -ErrorAction Stop|Out-Null
foreach($folder in @('src','test','data')){Copy-Item -LiteralPath (Join-Path $source $folder) -Destination $dest -Recurse -ErrorAction Stop}
foreach($file in @('dashboard.html','Start.ps1','Status.ps1','Stop.ps1','Disable-AutoStart.ps1')){Copy-Item -LiteralPath (Join-Path $source $file) -Destination $dest -ErrorAction Stop}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'Start.ps1')
if($LASTEXITCODE -ne 0){throw 'AUTONOMY_START_FAILED'}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'Status.ps1')
if($LASTEXITCODE -ne 0){throw 'AUTONOMY_STATUS_FAILED'}
$registry='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$ps=(Get-Command powershell.exe -ErrorAction Stop).Source
$cmd='"'+$ps+'" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+(Join-Path $dest 'Start.ps1')+'"'
New-Item -Path $registry -Force|Out-Null
New-ItemProperty -Path $registry -Name 'FunIndustrialAutonomyV2GitHub' -Value $cmd -PropertyType String -Force|Out-Null
Write-Host "INSTALLED_PATH=$dest"
Write-Host 'AUTO_START_AT_LOGIN=PASS'
Write-Host 'FIVE_MILESTONE_INSTALL=PASS'
Write-Host 'EXISTING_SERVICES_UNCHANGED=TRUE'
Write-Host 'DASHBOARD=http://127.0.0.1:8792/'
