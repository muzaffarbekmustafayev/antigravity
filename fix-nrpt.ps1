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
Write-Host 'DNS cache cleared'
$remaining = (Get-DnsClientNrptRule).Count
Write-Host ('Remaining rules: ' + $remaining)
