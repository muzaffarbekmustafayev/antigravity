/**
 * egress.js — Asosiy internet interfeysini aniqlash
 */

'use strict';

const os = require('os');
const { execSync, execFileSync } = require('child_process');

function runPowershell(script, timeoutMs = 8000) {
  if (os.platform() !== 'win32') return null;
  try {
    const preamble = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue';\n`;
    const fullScript = preamble + script;
    const encoded = Buffer.from(fullScript, 'utf16le').toString('base64');

    return execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      {
        timeout: timeoutMs,
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    );
  } catch (_) {
    return null;
  }
}

function detectEgress() {
  if (os.platform() !== 'win32') return detectEgressUnix();

  const script = `
$phys=@(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object {$_.Status -eq 'Up'} | ForEach-Object {$_.ifIndex});
$def=@(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -PolicyStore ActiveStore -ErrorAction SilentlyContinue);
$mine=@($def | Where-Object {$phys -contains $_.ifIndex -and $_.NextHop -ne '0.0.0.0'});
if ($mine.Count -eq 0) { 'none' } else {
  $best=$mine | Sort-Object {[int]$_.RouteMetric + [int](Get-NetIPInterface -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).InterfaceMetric} | Select-Object -First 1;
  $ad=(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object {$_.ifIndex -eq $best.ifIndex});
  '{0}|{1}|{2}' -f $best.ifIndex,$best.NextHop,$ad.Name
}`.replace(/\r?\n/g, ' ').trim();

  try {
    const out = runPowershell(script, 8000);
    if (!out || out.trim() === 'none') return null;
    const last = out.split('\n').reverse().find(l => l.trim());
    if (!last) return null;
    const parts = last.trim().split('|');
    const ifIndex = parseInt(parts[0], 10);
    if (isNaN(ifIndex)) return null;
    const ifName = parts[2] ? parts[2].trim() : String(ifIndex);
    return {
      ifIndex,
      ifName: ifName || String(ifIndex),
    };
  } catch (_) {
    return null;
  }
}

function getIfNameByIndex(ifIndex) {
  try {
    const out = runPowershell(
      `(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object {$_.ifIndex -eq ${ifIndex}}).Name`,
      4000
    );
    return (out && out.trim()) ? out.trim() : String(ifIndex);
  } catch (_) {
    return String(ifIndex);
  }
}

function detectEgressUnix() {
  try {
    const out = execSync('ip route show default 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
    const m = out.match(/dev\s+(\S+)/);
    if (!m) return null;
    return { ifIndex: 0, ifName: m[1] };
  } catch (_) {
    return null;
  }
}

module.exports = {
  detectEgress,
  getIfNameByIndex,
  detectEgressUnix,
};
