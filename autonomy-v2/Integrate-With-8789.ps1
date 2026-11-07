# Integrate Autonomy status into Fun Industrial's existing 8789 unified dashboard.
# Default: guarded source-only patch; DOES NOT restart 8789, REA, Qwen, or Aider.
# After deliberate operator maintenance restart of dashboard, the integrated view becomes available.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation')
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$server=Join-Path $Root 'src\server.mjs'
$ui=Join-Path $Root 'public\index.html'
if(-not(Test-Path -LiteralPath $server -PathType Leaf) -or -not(Test-Path -LiteralPath $ui -PathType Leaf)){throw 'LIVE_DASHBOARD_SOURCE_NOT_FOUND'}
$backend=Invoke-RestMethod 'http://127.0.0.1:8792/api/status' -TimeoutSec 10
if($backend.state -ne 'running'){throw 'AUTONOMY_BACKEND_NOT_RUNNING'}
$port=8789
$live=Invoke-WebRequest "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 10
if($live.StatusCode -ne 200 -or $live.Content -notmatch 'id="bottomNav"'){throw 'UNIFIED_DASHBOARD_NOT_DETECTED'}
$oldServer=[IO.File]::ReadAllText($server)
$oldUi=[IO.File]::ReadAllText($ui)
if($oldServer.Contains('FI_AUTONOMY_8789_PROXY_V1') -or $oldUi.Contains('FI_AUTONOMY_8789_VIEW_V1')){throw 'AUTONOMY_INTEGRATION_ALREADY_PRESENT'}
$anchor='const server=http.createServer(async(req,res)=>{try{'
if(([regex]::Matches($oldServer,[regex]::Escape($anchor))).Count -ne 1){throw 'SERVER_ROUTE_ANCHOR_NOT_UNIQUE'}
$nav="['settings','System','⚙']"
if(-not $oldUi.Contains($nav)){throw 'UNIFIED_NAV_ANCHOR_MISSING'}
$viewAnchor='</main>'
if(([regex]::Matches($oldUi,[regex]::Escape($viewAnchor))).Count -ne 1){throw 'UNIFIED_VIEW_ANCHOR_NOT_UNIQUE'}
$goAnchor="if(id==='rea')renderRea();"
if(-not $oldUi.Contains($goAnchor)){throw 'UNIFIED_NAV_HANDLER_ANCHOR_MISSING'}
$jsAnchor='function bindEvents(){'
if(-not $oldUi.Contains($jsAnchor)){throw 'UNIFIED_JS_ANCHOR_MISSING'}
$iconAnchor="settings:'<path"
if(-not $oldUi.Contains($iconAnchor)){throw 'UNIFIED_ICON_ANCHOR_MISSING'}

$proxy=@'
 // FI_AUTONOMY_8789_PROXY_V1: read-only same-origin routing; backend stays on loopback 8792.
 const autonomyPaths={"/api/autonomy/status":"/api/status","/api/autonomy/tasks":"/api/tasks","/api/autonomy/events":"/api/events","/api/autonomy/research":"/api/research","/api/autonomy/rea":"/api/rea"};
 if(req.method==="GET"&&Object.prototype.hasOwnProperty.call(autonomyPaths,req.url)){
   if(!localRequest(req,res))return;
   try{
     const r=await fetch("http://127.0.0.1:8792"+autonomyPaths[req.url],{signal:AbortSignal.timeout(6500),redirect:"error"});
     const raw=await r.text();
     if(raw.length>900000)throw Error("AUTONOMY_RESPONSE_TOO_LARGE");
     return json(res,r.status,JSON.parse(raw));
   }catch(error){return json(res,503,{error:"AUTONOMY_BACKEND_UNAVAILABLE",detail:String(error.message).slice(0,140)});}
 }
'@
$view=@'
<!-- FI_AUTONOMY_8789_VIEW_V1: embedded monitoring; no iframe/cross-origin requests -->
<section class="view" id="view-autonomy" aria-label="Autonomous workers">
<div class="page-head"><div class="eyebrow">Workspace / Autonomy</div><h1>Autonomous workers.</h1><p>Research, verification, REA inventory and queued reviews. All actions remain permission controlled.</p></div>
<div class="stack">
<div class="grid2">
<div class="card metric"><div class="metric-label">Background coordinator</div><div class="metric-value small" id="fiAutonomyState">Checking</div></div>
<div class="card metric"><div class="metric-label">REA tools inventoried</div><div class="metric-value" id="fiAutonomyRea">—</div></div>
<div class="card metric"><div class="metric-label">Pending reviews</div><div class="metric-value" id="fiAutonomyPending">—</div></div>
<div class="card metric"><div class="metric-label">Worker jobs</div><div class="metric-value small" id="fiAutonomyJobs">Checking</div></div>
</div>
<div class="card"><div class="heading-row"><h2 class="section-title">Worker activity</h2><button class="btn secondary small" id="fiAutonomyRefresh">Refresh</button></div><div class="subtle" id="fiAutonomyActivity">Loading…</div></div>
<div class="card"><h2 class="section-title">Research updates</h2><div class="subtle" id="fiAutonomyResearch">Loading…</div></div>
<div class="card"><h2 class="section-title">Operator review queue</h2><div class="subtle" id="fiAutonomyTasks">Loading…</div></div>
</div></section>
'@
$js=@'
/* FI_AUTONOMY_8789_UI_V1 — read-only same-origin status */
async function refreshAutonomy(){
 const activity=$('fiAutonomyActivity'),tasks=$('fiAutonomyTasks'),research=$('fiAutonomyResearch');
 try {
  const [s,t,e,r]=await Promise.all([api('/api/autonomy/status',undefined,10000),api('/api/autonomy/tasks',undefined,10000),api('/api/autonomy/events',undefined,10000),api('/api/autonomy/research',undefined,10000)]);
  $('fiAutonomyState').textContent=s.state||'unknown';
  $('fiAutonomyRea').textContent=String(s.registry?.count??'Pending');
  $('fiAutonomyPending').textContent=String((t.tasks||[]).length);
  $('fiAutonomyJobs').textContent=String(s.jobs??'Active');
  function show(el,arr,format){el.replaceChildren();for(const value of arr.slice(0,18)){const p=document.createElement('p');p.textContent=format(value);el.appendChild(p)}if(!arr.length)el.textContent='No records yet';}
  show(activity,e.events||[],x=>(x.at||'')+' · '+(x.stage||'')+' · '+(x.title||''));
  show(tasks,t.tasks||[],x=>(x.title||'')+': '+(x.detail||''));
  show(research,r.research?.results||[],x=>(x.name||'')+' · '+(x.tag||x.error||'pending'));
 }catch(err){$('fiAutonomyState').textContent='Unavailable';activity.textContent='Worker backend unavailable: '+err.message;tasks.textContent='No data';research.textContent='No data'}
}
'@
$patchedServer=$oldServer.Replace($anchor,$anchor+[Environment]::NewLine+$proxy)
$patchedUi=$oldUi.Replace($nav,"['autonomy','Autonomy','◇'],"+$nav).Replace($viewAnchor,$view+[Environment]::NewLine+$viewAnchor).Replace($goAnchor,$goAnchor+"if(id==='autonomy')void refreshAutonomy();").Replace($iconAnchor,"autonomy:'<path d=" + [char]34 + "M12 2v5m0 10v5M2 12h5m10 0h5M5 5l3 3m8 8 3 3m0-14-3 3M8 16l-3 3" + [char]34 + "/>',"+$iconAnchor).Replace($jsAnchor,$js+[Environment]::NewLine+$jsAnchor)
$patchedUi=$patchedUi.Replace("function bindEvents(){","function bindEvents(){$('fiAutonomyRefresh').addEventListener('click',refreshAutonomy);")
if(-not $patchedUi.Contains('FI_AUTONOMY_8789_VIEW_V1') -or -not $patchedServer.Contains('FI_AUTONOMY_8789_PROXY_V1')){throw 'PATCH_FAILED_TO_INSERT'}
$node=(Get-Command node.exe -ErrorAction Stop).Source
$tmp=Join-Path $env:TEMP ('funindustrial-autonomy-'+[guid]::NewGuid().ToString('N')+'.mjs')
$tmpUi=Join-Path $env:TEMP ('funindustrial-autonomy-ui-'+[guid]::NewGuid().ToString('N')+'.mjs')
try{
 [IO.File]::WriteAllText($tmp,$patchedServer,[Text.UTF8Encoding]::new($false))
 & $node --check $tmp
 if($LASTEXITCODE -ne 0){throw 'SERVER_SYNTAX_FAILED'}
 $match=[regex]::Match($patchedUi,'(?is)<script(?:\s[^>]*)?>(.*?)</script>')
 if(-not $match.Success){throw 'UI_SCRIPT_MISSING'}
 [IO.File]::WriteAllText($tmpUi,$match.Groups[1].Value,[Text.UTF8Encoding]::new($false))
 & $node --check $tmpUi
 if($LASTEXITCODE -ne 0){throw 'UI_SYNTAX_FAILED'}
}finally{Remove-Item $tmp,$tmpUi -ErrorAction SilentlyContinue -Force}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\8789Backups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Force -Path $backup|Out-Null
Copy-Item -LiteralPath $server -Destination (Join-Path $backup 'server.mjs') -ErrorAction Stop
Copy-Item -LiteralPath $ui -Destination (Join-Path $backup 'index.html') -ErrorAction Stop
try{
 [IO.File]::WriteAllText($server,$patchedServer,[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText($ui,$patchedUi,[Text.UTF8Encoding]::new($false))
 Push-Location $Root
 try{
  & $node --test
  if($LASTEXITCODE -ne 0){throw 'REGRESSION_TESTS_FAILED'}
 }finally{Pop-Location}
}catch{
 Copy-Item -LiteralPath (Join-Path $backup 'server.mjs') -Destination $server -Force
 Copy-Item -LiteralPath (Join-Path $backup 'index.html') -Destination $ui -Force
 throw "INTEGRATION_FAILED_SOURCE_ROLLED_BACK: $($_.Exception.Message)"
}
Write-Host "AUTONOMY_8789_SOURCE_INTEGRATED=PASS BACKUP=$backup"
Write-Host 'RUNNING_SERVICES_UNCHANGED=TRUE'
Write-Host 'DASHBOARD_RESTART_REQUIRED=TRUE'
Write-Host 'The currently running dashboard serves HTML cached at launch; restart it separately during a maintenance window, then reconnect REA if required.'
