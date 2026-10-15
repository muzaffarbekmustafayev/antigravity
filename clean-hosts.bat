@echo off
chcp 65001 >nul
echo 🧹 Hosts va NRPT DNS qoidalarini tozalash boshlandi...

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Administrator huquqi talab qilinmoqda, UAC oynasida 'Ha' (Yes) ni bosing...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command \"Get-DnsClientNrptRule -ErrorAction SilentlyContinue | Remove-DnsClientNrptRule -Force -ErrorAction SilentlyContinue; Clear-DnsClientCache; $p = \"\"$env:SystemRoot\System32\drivers\etc\hosts\"\"; if (Test-Path $p) { $c = (Get-Content $p) -notmatch ''ANTIGRAVITY|AG_UNLOCKER''; Set-Content -Path $p -Value $c -Force }; Write-Host ''[OK] NRPT va Hosts to\'liq tozalandi!'' -ForegroundColor Green; Start-Sleep -Seconds 2\"'"
    exit /b
)

powershell -NoProfile -Command "Get-DnsClientNrptRule -ErrorAction SilentlyContinue | Remove-DnsClientNrptRule -Force -ErrorAction SilentlyContinue; Clear-DnsClientCache; $p = \"$env:SystemRoot\System32\drivers\etc\hosts\"; if (Test-Path $p) { $c = (Get-Content $p) -notmatch 'ANTIGRAVITY|AG_UNLOCKER'; Set-Content -Path $p -Value $c -Force }; Write-Host '[OK] NRPT va Hosts to''liq tozalandi!' -ForegroundColor Green; Start-Sleep -Seconds 2"
