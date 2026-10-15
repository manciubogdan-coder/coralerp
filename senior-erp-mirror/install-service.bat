@echo off
echo Instaleaza Senior ERP Mirror ca serviciu Windows (ruleaza ca Administrator)
cd /d "%~dp0"
call npm install
node scripts/install-service.js
pause
