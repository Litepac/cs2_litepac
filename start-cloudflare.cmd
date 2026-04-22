@echo off
setlocal
cd /d "%~dp0"

set "CLOUDFLARED=%USERPROFILE%\cloudflared\cloudflared.exe"
set "LOCAL_URL=http://127.0.0.1:4173"

if /i "%~1"=="run" goto run_tunnel

if not exist "%CLOUDFLARED%" (
  echo [DemoRead] Could not find cloudflared at:
  echo %CLOUDFLARED%
  echo.
  echo Put cloudflared.exe in "%USERPROFILE%\cloudflared\" or update this script.
  echo.
  pause
  exit /b 1
)

start "DemoRead Cloudflare Tunnel" cmd /k ""%~f0" run"
exit /b 0

:run_tunnel
echo [DemoRead] Starting Cloudflare quick tunnel.
echo [DemoRead] Local target: %LOCAL_URL%
echo.
echo Checking that localhost is reachable first.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing '%LOCAL_URL%' -TimeoutSec 4; if ($response.StatusCode -lt 400) { exit 0 }; exit 1 } catch { exit 1 }"
if errorlevel 1 (
  echo [DemoRead] Localhost is not reachable at %LOCAL_URL%.
  echo [DemoRead] Run start-localhost.cmd first, wait for Vite to print the local URL, then retry.
  echo.
  pause
  exit /b 1
)

echo [DemoRead] Localhost is reachable.
echo [DemoRead] Cloudflare will print a temporary https://*.trycloudflare.com URL below.
echo [DemoRead] Copy that URL when you want to share the site.
echo.

"%CLOUDFLARED%" tunnel --url %LOCAL_URL%

echo.
echo [DemoRead] Cloudflare tunnel stopped.
pause
