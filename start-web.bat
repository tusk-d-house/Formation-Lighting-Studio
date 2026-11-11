@echo off
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"
echo Starting Formation & Lighting Studio...
"C:\Program Files\nodejs\node.exe" "node_modules\vite\bin\vite.js" --port 5173 --open
pause
