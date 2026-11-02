[CmdletBinding()]
param([Parameter(Mandatory=$true)][string[]]$ToolNames)
$ErrorActionPreference="Stop"
$RepoRoot=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile=Join-Path $RepoRoot ".env"
if(-not(Test-Path $envFile)){throw "Run Activate-FunIndustrial.ps1 first."}
$names=@($ToolNames|ForEach-Object{$_.Trim()}|Where-Object{$_}|Sort-Object -Unique)
if($names.Count -gt 14){throw "At most 14 REA tools may be allowlisted because the local AI registry reserves 18 of its 32 tool slots for built-in platform capabilities."}
foreach($name in $names){if($name -notmatch "^[A-Za-z0-9_.:-]{1,128}$"){throw "Invalid MCP tool name: $name"}}
$value=$names -join ","
$lines=[System.Collections.Generic.List[string]]::new()
$lines.AddRange([string[]](Get-Content $envFile))
$found=$false
for($i=0;$i -lt $lines.Count;$i++){if($lines[$i] -match "^REA_ALLOWED_TOOLS="){$lines[$i]="REA_ALLOWED_TOOLS=$value";$found=$true;break}}
if(-not $found){$lines.Add("REA_ALLOWED_TOOLS=$value")}
$lines|Set-Content -Encoding UTF8 $envFile
Write-Host "REA_ALLOWLIST_UPDATED=PASS"
Write-Host "APPROVED_TOOL_COUNT=$($names.Count)"
Write-Host "Only these exact names can be called from the AI interface. Restart Fun Industrial to apply the change."
$global:LASTEXITCODE=0
