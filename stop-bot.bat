@echo off
echo Antigravity Bot to'xtatilmoqda...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :7799') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Bot muvaffaqiyatli to'xtatildi.
pause
