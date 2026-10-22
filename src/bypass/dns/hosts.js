/**
 * hosts.js — Windows va Unix tizimlari uchun hosts faylini xavfsiz boshqarish (fallback)
 * Windows CRLF (\r\n) va Read-Only atributlarini to'g'ri boshqaradi.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execFileSync } = require('child_process');
const { HOSTS_BEGIN, HOSTS_END, AG_HOSTNAMES, PROVIDERS, DEFAULT_FALLBACK_IPS } = require('./constants');
const { resolveViaProvider } = require('./forwarder');
const Logger = require('../../logger');

const LEGACY_HOSTS_BEGIN = '# BEGIN ANTIGRAVITY-BYPASS-RUSSIA';
const LEGACY_HOSTS_END   = '# END ANTIGRAVITY-BYPASS-RUSSIA';

const EOL = os.platform() === 'win32' ? '\r\n' : '\n';

function hostsPath() {
  if (os.platform() === 'win32') {
    const root = process.env.SystemRoot || 'C:\\Windows';
    return path.join(root, 'System32', 'drivers', 'etc', 'hosts');
  }
  return '/etc/hosts';
}

function renderHostsBlock(entries) {
  let out = `${HOSTS_BEGIN}${EOL}`;
  for (const { hostname, ip } of entries) {
    out += `${ip} ${hostname}${EOL}`;
  }
  out += `${HOSTS_END}${EOL}`;
  return out;
}

function replaceHostsBlock(existing, block) {
  // \r\n va \n larni to'g'ri ajratish
  const lines = existing.replace(/\r\n/g, '\n').split('\n');
  let inside = false;
  let insideLegacy = false;
  const kept = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(HOSTS_BEGIN)) { inside = true; continue; }
    if (inside) { if (trimmed.startsWith(HOSTS_END)) inside = false; continue; }

    if (trimmed.startsWith(LEGACY_HOSTS_BEGIN)) { insideLegacy = true; continue; }
    if (insideLegacy) { if (trimmed.startsWith(LEGACY_HOSTS_END)) insideLegacy = false; continue; }

    kept.push(line);
  }

  let out = kept.join(EOL);
  if (block) {
    if (out.length && !out.endsWith(EOL)) out += EOL;
    out += block;
  }
  return out;
}

function ensureHostsWritable(filePath) {
  if (os.platform() === 'win32') {
    try {
      execFileSync('attrib.exe', ['-R', filePath], { stdio: 'ignore', windowsHide: true });
    } catch (_) {}
  }
  try {
    fs.chmodSync(filePath, 0o666);
  } catch (_) {}
}

function isHostsApplied() {
  try {
    const p = hostsPath();
    if (!fs.existsSync(p)) return false;
    const cur = fs.readFileSync(p, 'utf8');
    return cur.includes(HOSTS_BEGIN) || cur.includes(LEGACY_HOSTS_BEGIN);
  } catch (_) {
    return false;
  }
}

function writeHostsEntries(entries) {
  try {
    const p = hostsPath();
    if (!fs.existsSync(p)) {
      return { ok: false, error: 'Hosts fayli topilmadi' };
    }

    ensureHostsWritable(p);
    const cur = fs.readFileSync(p, 'utf8');
    const upd = replaceHostsBlock(cur, entries.length ? renderHostsBlock(entries) : null);

    if (upd !== cur) {
      try {
        fs.writeFileSync(p, upd, 'utf8');
      } catch (writeErr) {
        if (os.platform() === 'win32' && (writeErr.code === 'EPERM' || writeErr.code === 'EACCES')) {
          // Administrator huquqi bilan vaqtinchalik fayldan nusxalash
          const tmpFile = path.join(os.tmpdir(), `ag_hosts_${Date.now()}.tmp`);
          fs.writeFileSync(tmpFile, upd, 'utf8');
          const psScript = `Copy-Item -Path '${tmpFile}' -Destination '${p}' -Force; Remove-Item -Path '${tmpFile}' -Force`;
          const encoded = Buffer.from(`[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ${psScript}`, 'utf16le').toString('base64');
          execFileSync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile -NonInteractive -EncodedCommand ${encoded}'`
          ], { windowsHide: true });
        } else {
          throw writeErr;
        }
      }
      Logger.debug('Hosts fayli muvaffaqiyatli yangilandi.');
    }
    return { ok: true };
  } catch (e) {
    Logger.error('Hosts fayliga yozishda xato:', e.message);
    return { ok: false, error: e.message };
  }
}

function removeHostsEntries() {
  try {
    const p = hostsPath();
    if (!fs.existsSync(p)) return { ok: true };
    const cur = fs.readFileSync(p, 'utf8');
    if (!cur.includes(HOSTS_BEGIN) && !cur.includes(LEGACY_HOSTS_BEGIN)) return { ok: true };
    return writeHostsEntries([]);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function pinHostsFallback(ifName) {
  try {
    const defaultIp = (DEFAULT_FALLBACK_IPS && DEFAULT_FALLBACK_IPS[0]) || '157.22.178.37';
    const promises = AG_HOSTNAMES.map(async (hostname) => {
      for (const p of PROVIDERS) {
        try {
          const ips = await resolveViaProvider(hostname, p, ifName);
          if (ips && ips.length) {
            return { hostname, ip: ips[0] };
          }
        } catch (_) {}
      }
      return { hostname, ip: defaultIp };
    });

    const entries = (await Promise.all(promises)).filter(Boolean);

    if (entries.length > 0) {
      Logger.debug(`Hosts fayli uchun ${entries.length} ta domen IP manzillari muvaffaqiyatli aniqlandi.`);
      return writeHostsEntries(entries);
    }
    return { ok: false, error: 'Bypass provayderlaridan IP manzillarini olib bo\'lmadi' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  hostsPath,
  renderHostsBlock,
  replaceHostsBlock,
  isHostsApplied,
  writeHostsEntries,
  removeHostsEntries,
  pinHostsFallback,
};
