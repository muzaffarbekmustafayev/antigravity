Write-Host 'Removing all ANTIGRAVITY-BYPASS NRPT rules...'
$rules = Get-DnsClientNrptRule
$count = 0
foreach ($rule in $rules) {
    if ($rule.Name -like 'ANTIGRAVITY*' -or $rule.Comment -like 'ANTIGRAVITY*' -or $rule.Comment -like 'AG_*') {
        try {
            Remove-DnsClientNrptRule -Name $rule.Name -Force -ErrorAction SilentlyContinue
            $count++
        } catch {
            # Try registry removal directly
            $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters\DnsPolicyConfig\" + $rule.Name
            if (Test-Path $regPath) {
                Remove-Item -Path $regPath -Recurse -Force -ErrorAction SilentlyContinue
                $count++
            }
        }
    }
}
Write-Host ('Removed: ' + $count + ' rules')
ipconfig /flushdns | Out-Null
Clear-DnsClientCache -ErrorAction SilentlyContinue
# Kill any orphaned processes holding relay port 127.0.0.53:53
try {
    Get-NetUDPEndpoint -LocalAddress 127.0.0.53 -LocalPort 53 -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.OwningProcess -gt 4) {
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host ('Terminated process holding 127.0.0.53:53 (PID: ' + $_.OwningProcess + ')')
        }
    }
} catch {}

$remaining = (Get-DnsClientNrptRule).Count
Write-Host ('Remaining rules: ' + $remaining)
