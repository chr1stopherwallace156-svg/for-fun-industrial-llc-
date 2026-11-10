# Fun Industrial Security Chat — isolated preview launcher.
# Runs a separate dashboard only. Never stops existing servers or invokes Ollama/REA.
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
$Live=Join-Path $HOME 'FunIndustrial-REA-MCP-Activation'
$Llama=Join-Path $HOME 'FunIndustrial\.runtime\llama.cpp\llama-server.exe'
$Model=Join-Path $HOME 'FunIndustrial\.runtime\models\Qwen3-4B-Q4_K_M.gguf'
if(!(Test-Path -LiteralPath (Join-Path $Live 'src\workflows\coordinator.mjs') -PathType Leaf)){throw 'FUN_SECURITY_LIVE_SOURCE_MISSING'}
if(!(Test-Path -LiteralPath $Llama -PathType Leaf)){throw 'FUN_SECURITY_LLAMA_CPP_MISSING'}
if(!(Test-Path -LiteralPath $Model -PathType Leaf)){throw 'FUN_SECURITY_MODEL_MISSING'}
$Tcp=Get-NetTCPConnection -LocalPort 8794 -State Listen -ErrorAction SilentlyContinue
if($Tcp){throw 'FUN_SECURITY_PREVIEW_PORT_8794_ALREADY_IN_USE'}
$Api=Get-NetTCPConnection -LocalPort 8791 -State Listen -ErrorAction SilentlyContinue
if(!$Api){throw 'FUN_SECURITY_EXISTING_API_8791_NOT_LISTENING'}
$env:HOST='127.0.0.1'
$env:PORT='8794'
$env:COMPUTE_PORT='8791'
$env:LOCAL_FIRST_MODE='true'
$env:VPN_REQUIRED='false'
$env:VPN_REQUIRE_EXIT_NODE='false'
$env:NETBIRD_ENABLED='false'
$env:REA_ENABLED='false'
$env:REA_ALLOWED_TOOLS=''
$env:COMPUTE_ENABLED='false'
$env:AI_ENABLED='true'
$env:AI_AUTOSTART='false'
$env:LLAMA_CPP_SERVER=$Llama
$env:LLAMA_CPP_MODEL=$Model
$env:FI_SECURITY_SOURCE_ROOT=$Live
$env:APP_ROOT=$Root
Push-Location $Root
try{
  & node --check '.\src\server.mjs'
  if($LASTEXITCODE -ne 0){throw 'FUN_SECURITY_SERVER_SYNTAX_HOLD'}
  & node --test '.\intelligence-checks\security-chat-phase4-case.mjs' '.\intelligence-checks\local-security-scan-case.mjs' '.\src\platform-tools.test.mjs'
  if($LASTEXITCODE -ne 0){throw 'FUN_SECURITY_LOCAL_TEST_HOLD'}
  Write-Host 'FUN_SECURITY_PREVIEW=STARTING (127.0.0.1:8794)'
  Write-Host 'FUN_SECURITY_LIVE_SERVICES=UNMODIFIED'
  Write-Host 'FUN_SECURITY_REA=DISABLED'
  Write-Host 'FUN_SECURITY_OLLAMA=NOT_USED'
  Write-Host 'Open http://127.0.0.1:8794 in your browser; use the chat Security Audit button with explicit confirmation.'
  & node '.\src\server.mjs'
  if($LASTEXITCODE -ne 0){throw 'FUN_SECURITY_PREVIEW_PROCESS_EXITED_WITH_ERROR'}
} finally { Pop-Location }
