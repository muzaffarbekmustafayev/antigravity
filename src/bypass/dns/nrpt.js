/**
 * nrpt.js — Windows NRPT (Name Resolution Policy Table) qoidalarini xavfsiz boshqarish
 * Diskka vaqtinchalik .ps1 yozmasdan, to'liq xotirada (-EncodedCommand) xavfsiz ishlaydi.
 */

'use strict';

const os   = require('os');
const { execFileSync } = require('child_process');
const { NRPT_TAG, AG_HOSTNAMES } = require('./constants');
const Logger = require('../../logger');

/**
 * PowerShell buyrug'ini diskka fayl yozmasdan, in-memory (UTF-16LE Base64) orqali chaqirish
 */
function runPowershell(script, timeoutMs = 25000, throwOnError = false) {
  if (os.platform() !== 'win32') return null;

  try {
    const preamble = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue';\n`;
    const fullScript = preamble + script;
    const encoded = Buffer.from(fullScript, 'utf16le').toString('base64');

    const stdout = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      {
        timeout: timeoutMs,
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    return stdout;
  } catch (e) {
    let msg = '';
    if (e.stderr) {
      try { msg = e.stderr.toString('utf8'); } catch (_) { msg = String(e.stderr); }
    }
    Logger.debug('PowerShell bajarishda xato:', msg || e.message);

    if (throwOnError) {
      throw new Error(msg || e.message || 'PowerShell execution failed');
    }
    return null;
  }
}

function psStringList(items) {
  return items.map(s => `'${s}'`).join(',');
}

function removeNrptRules() {
  if (os.platform() !== 'win32') return;
  const tags = [NRPT_TAG];
  const hostnamesList = psStringList(AG_HOSTNAMES);
  const script = `
if (-not (Get-Command Get-DnsClientNrptRule -ErrorAction SilentlyContinue)) { exit 0 }
$tags=@(${psStringList(tags)});
$hosts=@(${hostnamesList});
Get-DnsClientNrptRule -ErrorAction SilentlyContinue |
  Where-Object { $tags -contains $_.Comment -or $hosts -contains $_.Namespace } |
  Remove-DnsClientNrptRule -Force -ErrorAction SilentlyContinue;
Clear-DnsClientCache -ErrorAction SilentlyContinue`.trim();

  runPowershell(script);
  Logger.debug('NRPT qoidalari tozalandi.');
}

function isNrptApplied() {
  if (os.platform() !== 'win32') return false;
  const tags = [NRPT_TAG];
  const tagsList = psStringList(tags);
  const hostnamesList = psStringList(AG_HOSTNAMES);
  const script = `
if (-not (Get-Command Get-DnsClientNrptRule -ErrorAction SilentlyContinue)) { exit 0 }
$tags = @(${tagsList});
$hosts = @(${hostnamesList});
Get-DnsClientNrptRule -ErrorAction SilentlyContinue |
  Where-Object { $tags -contains $_.Comment -or $hosts -contains $_.Namespace } |
  ForEach-Object { $_.Namespace }`.trim();

  const out = runPowershell(script);
  if (!out) return false;

  const installed = out.split('\n')
    .map(l => l.trim().replace(/^[\.\{\s]+/, '').replace(/[\.\}\s]+$/, '').toLowerCase())
    .filter(Boolean);

  return ['cloudcode-pa.googleapis.com', 'daily-cloudcode-pa.googleapis.com'].some(h => installed.includes(h.toLowerCase()));
}

function flushDnsCache() {
  if (os.platform() !== 'win32') return;
  try {
    execFileSync('ipconfig.exe', ['/flushdns'], { stdio: 'ignore', windowsHide: true });
    Logger.debug('Windows DNS keshi tozalandi.');
  } catch (_) {}
}

function installNrptRules(nameservers) {
  if (os.platform() !== 'win32') return { ok: false, error: 'NRPT faqat Windows tizimida mavjud' };

  const ns = psStringList(nameservers);
  const hostnamesList = psStringList(AG_HOSTNAMES);

  const script = `
if (-not (Get-Command Add-DnsClientNrptRule -ErrorAction SilentlyContinue)) {
  Write-Error "NRPT_UNSUPPORTED";
  exit 1;
}
$hosts = @(${hostnamesList});
Get-DnsClientNrptRule -ErrorAction SilentlyContinue |
  Where-Object { $_.Comment -eq '${NRPT_TAG}' -or $hosts -contains $_.Namespace } |
  Remove-DnsClientNrptRule -Force -ErrorAction SilentlyContinue;

$idx = 0;
foreach ($name in $hosts) {
  Add-DnsClientNrptRule -Namespace $name -NameServers @(${ns}) -Comment '${NRPT_TAG}' -DisplayName "AG Bypass $idx" -ErrorAction SilentlyContinue;
  $idx++;
}
Clear-DnsClientCache -ErrorAction SilentlyContinue;
"OK"`.trim();

  try {
    const out = runPowershell(script, 20000, true);
    if (out && out.includes('OK')) {
      Logger.debug('NRPT qoidalari muvaffaqiyatli o\'rnatildi.');
      return { ok: true };
    }
    return { ok: false, error: 'NRPT o\'rnatishda xatolik yuz berdi' };
  } catch (e) {
    const errText = (e.message || '').toString();
    if (errText.includes('NRPT_UNSUPPORTED')) {
      return { ok: false, unsupported: true, error: 'Windows versiyasi NRPT qo\'llab-quvvatlamaydi (Windows Home)' };
    }
    const isElevation = /denied|elevation|administrator|prava|доступ/i.test(errText);
    const hint = isElevation
      ? 'Administrator huquqi talab qilinadi'
      : 'PowerShell NRPT xatoligi';
    return { ok: false, error: hint };
  }
}

module.exports = {
  runPowershell,
  installNrptRules,
  removeNrptRules,
  isNrptApplied,
  flushDnsCache,
};
