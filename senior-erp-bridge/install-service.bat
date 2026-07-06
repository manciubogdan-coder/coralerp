@echo off
echo Instaleaza Senior ERP Bridge ca serviciu Windows...
echo (Trebuie sa rulezi acest fisier ca Administrator)
cd /d "%~dp0"
call npm install
node scripts/install-service.js
pause
