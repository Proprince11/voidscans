@echo off
REM =====================================================
REM Scheduled mega-grab — runs update-series then mega-grab.
REM Set this in Windows Task Scheduler to run twice daily.
REM =====================================================

cd /d "C:\Users\prince\OneDrive\Desktop\kiro repo\voidscans\scripts"

echo [%date% %time%] Starting scheduled grab... >> scheduled-grab.log

REM Update series.json with latest chapter numbers
node update-series.mjs >> scheduled-grab.log 2>&1

REM Run mega-grab with safe settings
node mega-grab.mjs --delay 100 --concurrency 2 >> scheduled-grab.log 2>&1

echo [%date% %time%] Scheduled grab complete. >> scheduled-grab.log
