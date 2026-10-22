@echo off
chcp 65001 >nul
echo 🧹 Cleaning Antigravity Hosts and NRPT DNS rules...

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Administrator privileges required, please click 'Yes' in the UAC prompt...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command \"Get-DnsClientNrptRule -ErrorAction SilentlyContinue | Where-Object { $_.Comment -like ''AG_*'' -or $_.Comment -like ''ANTIGRAVITY*'' -or $_.DisplayName -like ''AG Bypass*'' -or $_.Namespace -like ''*googleapis.com'' } | Remove-DnsClientNrptRule -Force -ErrorAction SilentlyContinue; Clear-DnsClientCache; Get-NetUDPEndpoint -LocalAddress 127.0.0.53 -LocalPort 53 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; $p = \"\"$env:SystemRoot\System32\drivers\etc\hosts\"\"; if (Test-Path $p) { $c = (Get-Content $p) -notmatch ''ANTIGRAVITY|AG_UNLOCKER''; Set-Content -Path $p -Value $c -Force }; Write-Host ''[OK] Antigravity NRPT, Hosts and Relay processes successfully cleaned!'' -ForegroundColor Green; Start-Sleep -Seconds 2\"'"
    exit /b
)

powershell -NoProfile -Command "Get-DnsClientNrptRule -ErrorAction SilentlyContinue | Where-Object { $_.Comment -like 'AG_*' -or $_.Comment -like 'ANTIGRAVITY*' -or $_.DisplayName -like 'AG Bypass*' -or $_.Namespace -like '*googleapis.com' } | Remove-DnsClientNrptRule -Force -ErrorAction SilentlyContinue; Clear-DnsClientCache; Get-NetUDPEndpoint -LocalAddress 127.0.0.53 -LocalPort 53 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; $p = \"$env:SystemRoot\System32\drivers\etc\hosts\"; if (Test-Path $p) { $c = (Get-Content $p) -notmatch 'ANTIGRAVITY|AG_UNLOCKER'; Set-Content -Path $p -Value $c -Force }; Write-Host '[OK] Antigravity NRPT, Hosts and Relay processes successfully cleaned!' -ForegroundColor Green; Start-Sleep -Seconds 2"
