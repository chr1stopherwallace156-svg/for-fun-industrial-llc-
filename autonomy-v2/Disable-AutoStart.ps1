$ErrorActionPreference='Stop'
$registry='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
Remove-ItemProperty -Path $registry -Name 'FunIndustrialAutonomyV2GitHub' -ErrorAction SilentlyContinue
Write-Host 'AUTONOMY_LOGIN_START_DISABLED'
