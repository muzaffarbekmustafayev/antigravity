@echo off
chcp 65001 >nul
echo ===================================================================
echo  🇷🇺 Antigravity Russia Region SmartDNS Unlocker (Comss.one)
echo ===================================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Administrator huquqi talab qilinadi.
    echo     Iltimos, ochilgan oynada 'Yes' (Ha) tugmasini bosing...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -Verb RunAs -ArgumentList '/c \"\"%~dpnx0\"\"'"
    exit /b
)

echo [1/3] Hosts fayliga Comss SmartDNS Anycast proksi yozuvlarini kiritish...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$hostsPath = \"$env:SystemRoot\System32\drivers\etc\hosts\"; $comssIp = '157.22.178.37'; $domains = @('cloudcode-pa.googleapis.com', 'daily-cloudcode-pa.googleapis.com', 'generativelanguage.googleapis.com', 'aiplatform.googleapis.com', 'alkalicore-pa.clients6.google.com', 'alkalimakersuite-pa.clients6.google.com', 'antigravity-pa.googleapis.com', 'cloudaicompanion.googleapis.com', 'proactivebackend-pa.googleapis.com', 'robinfrontend-pa.googleapis.com'); $cur = Get-Content $hostsPath -Raw -ErrorAction SilentlyContinue; if (-not $cur) { $cur = '' }; $cur = ($cur -split \"`r?`n\" | Where-Object { $_ -notmatch 'ANTIGRAVITY|AG_UNLOCKER|googleapis|clients6\.google' }) -join \"`r`n\"; $block = \"`r`n# AG_UNLOCKER_HOSTS_BEGIN`r`n\"; foreach ($d in $domains) { $block += \"$comssIp $d`r`n\" }; $block += \"# AG_UNLOCKER_HOSTS_END`r`n\"; $final = $cur.TrimEnd() + $block; Set-Content -Path $hostsPath -Value $final -Encoding UTF8 -Force; Write-Host '  [+] Hosts fayli muvaffaqiyatli yangilandi!' -ForegroundColor Green"

echo.
echo [2/3] Windows DNS keshini tozalash...
ipconfig /flushdns >nul 2>&1
powershell -NoProfile -Command "Clear-DnsClientCache -ErrorAction SilentlyContinue"

echo.
echo [3/3] Antigravity o'rnatilmalarini patch qilish...
cd /d "%~dp0"
node patcher.js

echo.
echo ===================================================================
echo  ✅ ROSSIYA REGIONI UCHUN SMARTDNS MUVAFFAQIYATLI SOZLANDI!
echo ===================================================================
echo  Endi Antigravity IDE ichida Agent ("hi" deb yozgan joyingizda):
echo  1. Pastdagi "Retry" tugmasini bosing yoki IDE ni qayta ishga tushiring.
echo  2. Google so'rovlari Gollandiya Anycast proksi (157.22.178.37) orqali
echo     o'tadi va "Agent execution terminated" xatoligi yo'qoladi!
echo ===================================================================
echo.
pause
