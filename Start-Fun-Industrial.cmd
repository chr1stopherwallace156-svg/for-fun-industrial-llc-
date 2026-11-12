@echo off
rem Fun Industrial V4.3 — one-click local startup. No other operations.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Fun-Industrial-OneCommand.ps1" -Start
if errorlevel 1 (
 echo.
 echo FUN ONE-COMMAND STARTUP HELD. See the last error above.
 pause
) else (
 start "" "http://127.0.0.1:8798/"
)
