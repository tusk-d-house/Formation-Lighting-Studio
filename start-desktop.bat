@echo off
if exist "%~dp0release\FormationStudio-Windows\FormationStudio.exe" (
  start "" "%~dp0release\FormationStudio-Windows\FormationStudio.exe"
  exit /b
)
if exist "C:\Users\tasuku\.gemini\antigravity\scratch\formation-studio\release\FormationStudio-Windows\FormationStudio.exe" (
  start "" "C:\Users\tasuku\.gemini\antigravity\scratch\formation-studio\release\FormationStudio-Windows\FormationStudio.exe"
  exit /b
)
cd /d "C:\Users\tasuku\.gemini\antigravity\scratch\formation-studio"
start "" "node_modules\electron\dist\electron.exe" "electron\main.cjs"
