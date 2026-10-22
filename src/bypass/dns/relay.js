/**
 * relay.js — Loopback 127.0.0.53:53 UDP DNS relay serveri
 */

'use strict';

const dgram = require('dgram');
const { execSync } = require('child_process');
const os = require('os');
const { RELAY_IP, RELAY_PORT, AG_HOSTNAMES } = require('./constants');
const { parseDnsQueryName } = require('./packet');
const { forwardToProviders, forwardToSystem } = require('./forwarder');
const Logger = require('../../logger');

let _relayServer = null;
let _relayEgress = null;

const PROTECTED_PROCESS_NAMES = [
  'sota.exe', 'sota', 'sotavpn.exe', 'sotavpn', 'sota-client.exe', 'sota-service.exe',
  'wireguard.exe', 'wireguard',
  'openvpn.exe', 'openvpn', 'openvpnserv.exe',
  'warp-svc.exe', 'cloudflare-warp.exe',
  'tailscaled.exe', 'tailscale.exe', 'tailscale',
  'clash.exe', 'clash-meta.exe', 'mihomo.exe',
  'sing-box.exe', 'xray.exe', 'v2ray.exe',
  'outline-service.exe', 'outline.exe', 'shadowsocks.exe',
  'nordvpn.exe', 'nordsec-service.exe',
  'surfshark.exe', 'expressvpn.exe', 'mullvad-daemon.exe',
  'svchost.exe', 'services.exe', 'lsass.exe', 'system',
];

/**
 * Jarayon VPN yoki tizim xizmati ekanini tekshirish
 */
function isProtectedProcess(pid) {
  if (!pid || pid <= 4 || pid === process.pid) return true;
  if (os.platform() === 'win32') {
    try {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8', windowsHide: true });
      const match = out.match(/^"([^"]+)"/);
      if (match) {
        const procName = match[1].toLowerCase();
        if (PROTECTED_PROCESS_NAMES.some(p => procName === p || procName.startsWith(p.replace('.exe', '')))) {
          Logger.info(`[relay] Jarayon (${procName}, PID: ${pid}) VPN yoki tizim xizmati, unga tegilmaydi.`);
          return true;
        }
      }
    } catch (_) {}
  }
  return false;
}

/**
 * 127.0.0.53:53 portini band qilib turgan jarayonlar PIDlarini aniqlash
 * VPN xavfsizligi: Faqat va faqat 127.0.0.53 manzili tekshiriladi, 127.0.0.1, 0.0.0.0 yoki VPN interfeyslariga tegilmaydi!
 */
function findPidsOnPort(port = RELAY_PORT, ip = RELAY_IP) {
  const pids = new Set();
  const currentPid = process.pid;

  if (os.platform() === 'win32') {
    // 1. netstat -ano orqali qat'iy ravishda 127.0.0.53:53 ni tekshirish
    try {
      const out = execSync('netstat -ano', { encoding: 'utf8', windowsHide: true });
      const lines = out.split(/\r?\n/);
      const targetExact = `${ip}:${port}`;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('UDP') && !trimmed.startsWith('TCP')) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length < 4) continue;
        const localAddr = parts[1];
        const lastToken = parts[parts.length - 1];
        const pid = parseInt(lastToken, 10);
        if (isNaN(pid) || pid <= 4 || pid === currentPid) continue;

        // Faqat aniq 127.0.0.53:53 porti va himoyalanmagan jarayonlar
        if (localAddr === targetExact) {
          if (!isProtectedProcess(pid)) {
            pids.add(pid);
          }
        }
      }
    } catch (_) {}

    // 2. PowerShell Get-NetUDPEndpoint orqali -LocalAddress 127.0.0.53 bilan qat'iy tekshirish
    try {
      const psCmd = `powershell -NoProfile -NonInteractive -Command "Get-NetUDPEndpoint -LocalAddress ${ip} -LocalPort ${port} -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne ${currentPid} -and $_.OwningProcess -gt 4 } | Select-Object -ExpandProperty OwningProcess"`;
      const out = execSync(psCmd, { encoding: 'utf8', windowsHide: true });
      const lines = out.split(/\r?\n/);
      for (const line of lines) {
        const pid = parseInt(line.trim(), 10);
        if (!isNaN(pid) && pid > 4 && pid !== currentPid) {
          if (!isProtectedProcess(pid)) {
            pids.add(pid);
          }
        }
      }
    } catch (_) {}
  } else {
    // Linux / macOS
    try {
      const out = execSync(`lsof -t -i UDP:${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      for (const line of out.split(/\r?\n/)) {
        const pid = parseInt(line.trim(), 10);
        if (!isNaN(pid) && pid !== currentPid && !isProtectedProcess(pid)) {
          pids.add(pid);
        }
      }
    } catch (_) {
      try {
        const out = execSync(`fuser ${port}/udp`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        for (const part of out.trim().split(/\s+/)) {
          const pid = parseInt(part.trim(), 10);
          if (!isNaN(pid) && pid !== currentPid && !isProtectedProcess(pid)) {
            pids.add(pid);
          }
        }
      } catch (_) {}
    }
  }

  return Array.from(pids);
}

/**
 * Jarayonni PID orqali xavfsiz o'chirish (VPN jarayonlariga tegilmaydi)
 */
function killPid(pid) {
  if (!pid || pid === process.pid || pid <= 4 || isProtectedProcess(pid)) return false;
  if (os.platform() === 'win32') {
    let killed = false;
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore', windowsHide: true });
      killed = true;
    } catch (_) {
      try {
        process.kill(pid, 'SIGKILL');
        killed = true;
      } catch (_) {}
    }
    return killed;
  } else {
    try {
      process.kill(pid, 'SIGKILL');
      return true;
    } catch (_) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        return true;
      } catch (_) {
        return false;
      }
    }
  }
}

/**
 * Relay portini (127.0.0.53:53) band qilgan eski antigravity jarayonlarini kill qilish
 * VPN adapterlari va umumiy tarmoq sozlamalariga ta'sir qilmaydi!
 */
function freeRelayPort(ip = RELAY_IP, port = RELAY_PORT) {
  const pids = findPidsOnPort(port, ip);
  let count = 0;
  for (const pid of pids) {
    if (killPid(pid)) {
      count++;
      Logger.info(`[relay] Port ${ip}:${port} ni band qilgan eski jarayon to'xtatildi (PID: ${pid}).`);
    }
  }

  if (os.platform() === 'win32') {
    try {
      // Qat'iy ravishda faqat 127.0.0.53 manzili bo'yicha tozalash (VPN ga tegmasdan)
      execSync(`powershell -NoProfile -NonInteractive -Command "Get-NetUDPEndpoint -LocalAddress ${ip} -LocalPort ${port} -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne ${process.pid} -and $_.OwningProcess -gt 4 } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore', windowsHide: true });
    } catch (_) {}
  }

  return count;
}

function isRelayActive() {
  if (_relayServer !== null && !_relayServer.isExternal) return true;
  try {
    const out = execSync(`netstat -aon | findstr ${RELAY_IP}:${RELAY_PORT}`, { encoding: 'utf8', windowsHide: true });
    return out.includes(`${RELAY_IP}:${RELAY_PORT}`);
  } catch (_) {
    return false;
  }
}

function startRelay(egress, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    if (_relayServer && !_relayServer.isExternal) {
      resolve();
      return;
    }

    _relayEgress = egress;

    // Agar avvalgi instansiya yoki boshqa jarayon portni ushlab turgan bo'lsa, oldindan tozalash
    if (os.platform() === 'win32' && isRelayActive() && !_relayServer) {
      Logger.info(`[relay] Eski relay jarayoni aniqlandi, port bo'shatilmoqda...`);
      freeRelayPort(RELAY_IP, RELAY_PORT);
    }

    let attempts = 0;

    function tryBind() {
      attempts++;
      let server = null;

      try {
        server = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      } catch (e) {
        reject(e);
        return;
      }

      let resolved = false;

      server.on('error', (err) => {
        try { server.close(); } catch (_) {}

        if (err.code === 'EADDRINUSE') {
          if (attempts <= maxRetries) {
            Logger.warn(`[relay] ${RELAY_IP}:${RELAY_PORT} porti band. Jarayon to'xtatilib, port bo'shatilmoqda... (urinish: ${attempts}/${maxRetries})`);
            const killed = freeRelayPort(RELAY_IP, RELAY_PORT);
            if (killed > 0) {
              Logger.info(`[relay] ${killed} ta jarayon to'xtatildi, qayta ulanmoqda...`);
            }
            setTimeout(() => {
              tryBind();
            }, 350);
            return;
          }

          Logger.warn(`[relay] ${RELAY_IP}:${RELAY_PORT} portini bo'shatib bo'lmadi (boshqa tizim xizmati).`);
          _relayServer = { isExternal: true, close: () => {} };
          if (!resolved) {
            resolved = true;
            resolve();
          }
          return;
        }

        _relayServer = null;
        Logger.error('[relay] Server xatoligi:', err.message);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      server.on('message', async (msg, rinfo) => {
        try {
          const hostname = parseDnsQueryName(msg);
          if (!hostname) return;

          const isAgHost = AG_HOSTNAMES.some(h => hostname.toLowerCase() === h.toLowerCase());

          if (!isAgHost) {
            forwardToSystem(msg, rinfo, server);
            return;
          }

          const ifName = _relayEgress?.ifName || null;
          const answer = await forwardToProviders(msg, hostname, ifName);
          if (answer) {
            server.send(answer, rinfo.port, rinfo.address, () => {});
          } else {
            forwardToSystem(msg, rinfo, server);
          }
        } catch (err) {
          Logger.debug('[relay] Xabar qayta ishlashda xato:', err.message);
        }
      });

      server.bind(RELAY_PORT, RELAY_IP, () => {
        _relayServer = server;
        Logger.debug(`[relay] DNS relay server faol: ${RELAY_IP}:${RELAY_PORT}`);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      });
    }

    tryBind();
  });
}

function stopRelay() {
  if (_relayServer) {
    try {
      if (!_relayServer.isExternal && typeof _relayServer.close === 'function') {
        _relayServer.close();
      }
    } catch (_) {}
    _relayServer = null;
    Logger.debug('[relay] DNS relay to\'xtatildi.');
  }
}

function getRelayEgress() {
  return _relayEgress;
}

module.exports = {
  isRelayActive,
  startRelay,
  stopRelay,
  getRelayEgress,
  findPidsOnPort,
  killPid,
  freeRelayPort,
  killPortOwner: (force) => freeRelayPort(),
};
