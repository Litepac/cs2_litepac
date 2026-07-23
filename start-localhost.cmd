@echo off
setlocal
cd /d "%~dp0"

curl.exe --silent --fail --max-time 2 --output NUL http://127.0.0.1:4173/api/health
if not errorlevel 1 (
  start "" "http://127.0.0.1:4173/"
  exit /b 0
)

del /q ".tmp-bridge-localhost.err.log" ".tmp-bridge-localhost.out.log" ".tmp-localhost-err.log" ".tmp-localhost-out.log" ".tmp-localhost.err.log" ".tmp-localhost.out.log" ".tmp-viewer-localhost.err.log" ".tmp-viewer-localhost.out.log" 2>nul

start "DemoRead Localhost" cmd /k "cd /d ""%~dp0viewer"" && npm.cmd run dev:local -- --open"
