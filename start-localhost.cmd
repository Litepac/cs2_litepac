@echo off
setlocal
cd /d "%~dp0"

del /q ".tmp-bridge-localhost.err.log" ".tmp-bridge-localhost.out.log" ".tmp-localhost-err.log" ".tmp-localhost-out.log" ".tmp-localhost.err.log" ".tmp-localhost.out.log" ".tmp-viewer-localhost.err.log" ".tmp-viewer-localhost.out.log" 2>nul

start "DemoRead Localhost" cmd /k "cd /d %~dp0viewer && npm.cmd run dev:local"
