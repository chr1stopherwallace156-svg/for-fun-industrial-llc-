# Deploy the GitHub iPhone-first UI into the existing Fun Industrial working checkout.
# Scope: public/index.html only; never changes .env, REA allowlist, or other source files.
[CmdletBinding()]
param(
    [string]$Root = 'C:\Users\alxar\FunIndustrial-REA-MCP-Activation',
    [int]$DashboardPort = 8789
)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root)
$source = Join-Path $PSScriptRoot '..\public\iphone-control-center.html'
$target = Join-Path $Root 'public\index.html'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "MOBILE_UI_SOURCE_MISSING: $source" }
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "CURRENT_UI_MISSING: $target" }
if (-not (Test-Path -LiteralPath (Join-Path $Root 'package.json') -PathType Leaf)) { throw "PROJECT_NOT_FOUND: $Root" }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$sourceText = [IO.File]::ReadAllText($source)
foreach ($signature in @('id="bottomNav"', 'id="chatInput"', '/api/ai/chat', '/api/rea/catalog', 'fi_web_search')) {
    if (-not $sourceText.Contains($signature)) { throw "MOBILE_UI_SIGNATURE_MISSING: $signature" }
}
$scriptMatch = [regex]::Match($sourceText, '(?is)<script(?:\s[^>]*)?>(.*?)</script>')
if (-not $scriptMatch.Success) { throw 'MOBILE_UI_INLINE_JS_NOT_FOUND' }
$check = Join-Path $env:TEMP ('fi-mobile-check-' + [guid]::NewGuid().ToString('N') + '.mjs')
try {
    [IO.File]::WriteAllText($check, $scriptMatch.Groups[1].Value, [Text.UTF8Encoding]::new($false))
    & $node --check $check
    if ($LASTEXITCODE -ne 0) { throw 'MOBILE_UI_JAVASCRIPT_INVALID' }
} finally { Remove-Item $check -Force -ErrorAction SilentlyContinue }
$listener = Get-NetTCPConnection -LocalPort $DashboardPort -State Listen -ErrorAction Stop | Select-Object -First 1
if (-not $listener -or $listener.LocalAddress -notin @('127.0.0.1', '::1')) { throw 'LOOPBACK_DASHBOARD_LISTENER_NOT_FOUND' }
$old = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
if (-not $old -or $old.Name -ne 'node.exe' -or $old.CommandLine -notmatch 'src[/\\]server\.mjs') { throw 'DASHBOARD_PROCESS_IDENTITY_MISMATCH' }
$backupRoot = Join-Path $env:LOCALAPPDATA 'FunIndustrial\UIBackups'
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$backup = Join-Path $backupRoot ('index-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '.html')
Copy-Item -LiteralPath $target -Destination $backup -ErrorAction Stop
try {
    Copy-Item -LiteralPath $source -Destination $target -Force -ErrorAction Stop
    Push-Location $Root
    try {
        & $npm test
        if ($LASTEXITCODE -ne 0) { throw 'REGRESSION_TESTS_FAILED' }
    } finally { Pop-Location }
} catch {
    Copy-Item -LiteralPath $backup -Destination $target -Force
    throw "UI_VALIDATION_FAILED_RESTORED_BACKUP: $($_.Exception.Message)"
}
Write-Host "UI_FILE_VALIDATED BACKUP=$backup" -ForegroundColor Green
# Read only the existing local allowlist to retain all 229 authorized REA tool names.
$envFile = Join-Path $Root '.env'
if (Test-Path $envFile) {
    $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^REA_ALLOWED_TOOLS=' } | Select-Object -First 1
    if ($line) { $env:REA_ALLOWED_TOOLS = $line.Substring('REA_ALLOWED_TOOLS='.Length) }
}
$env:HOST = '127.0.0.1'
$env:PORT = [string]$DashboardPort
$logRoot = Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Write-Host "RESTARTING_DASHBOARD_ONLY PID=$($old.ProcessId)"
Stop-Process -Id $old.ProcessId -ErrorAction Stop
for ($i=0; $i -lt 30; $i++) {
    if (-not (Get-NetTCPConnection -LocalPort $DashboardPort -State Listen -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
}
if (Get-NetTCPConnection -LocalPort $DashboardPort -State Listen -ErrorAction SilentlyContinue) { throw 'DASHBOARD_PORT_STILL_OCCUPIED' }
$new = Start-Process -FilePath $node -ArgumentList @('src/server.mjs') -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logRoot "mobile-ui-$stamp.stdout.log") -RedirectStandardError (Join-Path $logRoot "mobile-ui-$stamp.stderr.log")
$base = "http://127.0.0.1:$DashboardPort"
$ready = $false
for ($i=0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    if ($new.HasExited) { throw "DASHBOARD_RESTART_EXITED_CODE=$($new.ExitCode)" }
    try {
        $s = Invoke-RestMethod "$base/api/status" -TimeoutSec 2
        if ($s.application -eq 'Fun Industrial Platform') { $ready = $true; break }
    } catch {}
}
if (-not $ready) { throw "DASHBOARD_RESTART_NOT_READY LOGS=$logRoot" }
$page = (Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15).Content
if (-not $page.Contains('id="bottomNav"')) { throw 'NEW_MOBILE_UI_NOT_SERVED' }
try {
    $rea = Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120
    $catalog = @((Invoke-RestMethod "$base/api/rea/catalog" -TimeoutSec 30).tools)
    $enabled = @((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 30).tools)
    Write-Host "REA_STATE=$($rea.state) DISCOVERED=$($catalog.Count) ENABLED=$($enabled.Count)"
    if ($rea.state -ne 'ready' -or $catalog.Count -ne 229 -or $enabled.Count -ne 229) { Write-Warning 'REA counts differ from the last verified 229. Inspect configuration; no allowlist was changed.' }
} catch { Write-Warning "REA_RECONNECT_CHECK_FAILED: $($_.Exception.Message)" }
Write-Host "IPHONE_UI_DEPLOYED=PASS DASHBOARD_PID=$($new.Id) BACKUP=$backup" -ForegroundColor Green
Write-Host "LOCAL_URL=$base/"
Write-Host 'Open your existing PRIVATE local-forwarded URL on iPhone, then refresh the page.'
Write-Warning 'The approved:true flag is not authentication; keep forwarding private and access-controlled.'
