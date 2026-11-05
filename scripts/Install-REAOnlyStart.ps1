[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$TargetPath
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path -LiteralPath $TargetPath).Path
$required = @("src/platform.mjs","src/server.mjs","src/platform.test.mjs")
foreach ($relative in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $relative) -PathType Leaf)) {
    throw "TARGET_FILE_MISSING: $relative under $root"
  }
}
$platformPath = Join-Path $root "src/platform.mjs"
$serverPath = Join-Path $root "src/server.mjs"
$testPath = Join-Path $root "src/platform.test.mjs"
$platform = [IO.File]::ReadAllText($platformPath)
$server = [IO.File]::ReadAllText($serverPath)
$tests = [IO.File]::ReadAllText($testPath)
$platformMarker = '  async startRea(){'
$routeMarker = '  if(req.method==="POST"&&req.url==="/api/rea/start")'
$testMarker = 'test("REA-only startup starts REA without starting AI, compute, or VPN",async()=>{'
if ($platform.Contains($platformMarker) -or $server.Contains($routeMarker) -or $tests.Contains($testMarker)) {
  throw "PATCH_MARKER_ALREADY_PRESENT: inspect current source; no files changed."
}
$platformAnchor = '  async reaCatalog(){'
$serverAnchor = '  if(req.method==="GET"&&req.url==="/api/rea/catalog"){'
$testAnchor = 'test("compute-only startup starts compute without starting AI or REA",async()=>{'
if (([regex]::Matches($platform,[regex]::Escape($platformAnchor))).Count -ne 1) { throw "PLATFORM_INSERTION_POINT_MISMATCH" }
if (([regex]::Matches($server,[regex]::Escape($serverAnchor))).Count -ne 1) { throw "SERVER_INSERTION_POINT_MISMATCH" }
if (([regex]::Matches($tests,[regex]::Escape($testAnchor))).Count -ne 1) { throw "TEST_INSERTION_POINT_MISMATCH" }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $root ".runtime\backups\pre-rea-only-start-$stamp"
foreach ($relative in $required) {
  $destination = Join-Path $backup $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $destination
}
$platformInsert = @'
  async startRea(){
   if(!config.rea.enabled)return {state:"disabled",detail:"REA disabled in local configuration."};
   if(config.vpnRequired&&!await vpnConnected())return {state:"blocked",detail:gateDetail||"NetBird peer is not connected; REA startup is blocked."};
   lastAction="rea-start";
   return {result:await rea.start()};
  },
'@
$serverInsert = '  if(req.method==="POST"&&req.url==="/api/rea/start"){if(!localRequest(req,res))return;return json(res,200,await platform.startRea());}' + [Environment]::NewLine
$testInsert = @'
test("REA-only startup starts REA without starting AI, compute, or VPN",async()=>{
 const f=fixtures();const result=await f.platform.startRea();const counts=f.counts();assert.equal(result.result.state,"ready");assert.deepEqual(counts,{computeStarted:0,computeStopped:0,aiStarted:0,aiStopped:0,reaStarted:1,reaStopped:0,calls:0});
});
test("REA-only startup is blocked when the NetBird peer is disconnected",async()=>{
 const f=fixtures();f.setConnected(false);const result=await f.platform.startRea();const counts=f.counts();assert.equal(result.state,"blocked");assert.equal(counts.reaStarted,0);assert.equal(counts.aiStarted,0);assert.equal(counts.computeStarted,0);
});
'@
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($platformPath,$platform.Replace($platformAnchor,$platformInsert+[Environment]::NewLine+$platformAnchor),$utf8)
[IO.File]::WriteAllText($serverPath,$server.Replace($serverAnchor,$serverInsert+$serverAnchor),$utf8)
[IO.File]::WriteAllText($testPath,$tests.Replace($testAnchor,$testInsert+$testAnchor),$utf8)
Write-Output "PATCH=APPLIED"
Write-Output "BACKUP=$backup"
Write-Output "FILES_CHANGED=src/platform.mjs,src/server.mjs,src/platform.test.mjs"
Write-Output "PROCESS_ACTIONS=NONE"
Write-Output "VPN_AI_COMPUTE_ACTIONS=NONE"
Write-Output "TOOL_ALLOWLIST_CHANGED=NO"
Push-Location $root
try {
  & node --check src/platform.mjs
  if ($LASTEXITCODE -ne 0) { throw "PLATFORM_SYNTAX_FAILED" }
  & node --check src/server.mjs
  if ($LASTEXITCODE -ne 0) { throw "SERVER_SYNTAX_FAILED" }
  & node --test src/platform.test.mjs
  if ($LASTEXITCODE -ne 0) { throw "PLATFORM_TESTS_FAILED" }
  & git diff --check -- src/platform.mjs src/server.mjs src/platform.test.mjs
  if ($LASTEXITCODE -ne 0) { throw "DIFF_CHECK_FAILED" }
  Write-Output "REA_ONLY_ENDPOINT_VALIDATION=PASS"
} finally {
  Pop-Location
}
