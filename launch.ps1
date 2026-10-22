# launch.ps1 — Antigravity Bypass dasturini ishga tushirish (VPN-Safe, Hosts rejimi)
# Administrator huquqi talab qilinadi.

#Requires -RunAsAdministrator

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "  [*] Tarmoq sozlamalari tekshirilmoqda (Hosts / VPN-Safe rejimi)..." -ForegroundColor Cyan

# ─── 1. Eski NRPT qoidalarini tozalash (Agar qolib ketgan bo'lsa) ───────────────
try {
    $nrptRules = Get-DnsClientNrptRule -ErrorAction SilentlyContinue
    $count = 0
    foreach ($rule in $nrptRules) {
        if ($rule.Name -like 'ANTIGRAVITY*' -or $rule.Comment -like '*ANTIGRAVITY*' -or $rule.Comment -like '*AG_*') {
            Remove-DnsClientNrptRule -Name $rule.Name -Force -ErrorAction SilentlyContinue
            $count++
        }
    }
    if ($count -gt 0) {
        Write-Host "  [+] $count ta eski NRPT qoidasi tozalandi." -ForegroundColor Green
        Clear-DnsClientCache -ErrorAction SilentlyContinue
    }
} catch {
    # NRPT mavjud bo'lmasa yoki xato bo'lsa davom etadi
}

# ─── 2. Eski relay jarayoni bo'lsa to'xtatish (Faqat node.exe, VPN ga tegilmaydi) ─
try {
    $netstatLines = netstat -aon 2>$null | Select-String "\s+127\.0\.0\.53:53\s"
    foreach ($line in $netstatLines) {
        $parts = ($line.ToString().Trim() -split '\s+')
        $lastPart = $parts[-1]
        if ($lastPart -match '^\d+$' -and [int]$lastPart -gt 0) {
            $proc = Get-Process -Id [int]$lastPart -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq 'node') {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Write-Host "  [+] Eski DNS relay (node PID $($proc.Id)) to'xtatildi." -ForegroundColor Green
            }
        }
    }
} catch {}

Write-Host "  [+] Port 53 va VPN interfeyslari to'liq daxlsiz saqlandi." -ForegroundColor Green
Write-Host ""

# ─── 3. Dasturni ishga tushirish ───────────────────────────────────────────────
Write-Host "  [*] Antigravity Bypass ishga tushirilmoqda..." -ForegroundColor Cyan
Write-Host ""

Set-Location $ScriptDir
node cli.js
