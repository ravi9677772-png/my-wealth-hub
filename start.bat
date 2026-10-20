@echo off
title My Wealth Hub - Production Server
cd /d "%~dp0\backend"
echo ========================================================
echo               MY WEALTH HUB - INDIA
echo     Private Personal Finance Management Suite
echo ========================================================
echo Starting backend server on http://localhost:3001 ...
echo Open your browser at: http://localhost:3001
echo.
set PATH=C:\Users\ravi9\nodejs;%PATH%
node dist/index.js
pause
