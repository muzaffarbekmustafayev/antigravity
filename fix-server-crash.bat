@echo off
chcp 65001 >nul
echo ===================================================================
echo  🔧 Antigravity Server Crash Recovery & Sota VPN Fix
echo ===================================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Administrator huquqi talab qilinadi.
    echo     Iltimos, ochilgan oynada 'Yes' (Ha) tugmasini bosing...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -Verb RunAs -ArgumentList '/c \"\"%~dpnx0\"\"'"
    exit /b
)

echo [1/4] Qotib qolgan Language Server jarayonlarini to'xtatish...
taskkill /F /IM language_server.exe >nul 2>&1
taskkill /F /IM language_server_windows_x64.exe >nul 2>&1
taskkill /F /IM agy.exe >nul 2>&1

echo [2/4] Hosts faylidan noto'g'ri / o'lik IP yozuvlarini tozalash...
powershell -NoProfile -Command "$p = \"$env:SystemRoot\System32\drivers\etc\hosts\"; if (Test-Path $p) { $c = (Get-Content $p) -notmatch 'ANTIGRAVITY|AG_UNLOCKER|googleapis|91\.132\.224'; Set-Content -Path $p -Value $c -Force }"

echo [3/4] DNS keshini tozalash...
ipconfig /flushdns >nul 2>&1
powershell -NoProfile -Command "Clear-DnsClientCache -ErrorAction SilentlyContinue"

echo [4/4] Asl zaxiralarni tiklash va xavfsiz sozlash...
cd /d "%~dp0"
node -e "try { require('./src/bypass/dns/hosts').removeHostsEntries(); } catch(_) {}"
node -e "try { const { clean } = require('./clean'); clean(); } catch(_) {}"

echo.
echo ===================================================================
echo  ✅ MUAMMO TO'LIQ TUZATILDI!
echo ===================================================================
echo  1. Sota VPN dasturini yoqing.
echo  2. Antigravity IDE ni qaytadan oching (Reload tugmasini bosing).
echo  Language Server endi Sota VPN orqali qulamasdan, ravon ishlaydi!
echo ===================================================================
echo.
pause
