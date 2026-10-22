/**
 * relay.js — Loopback 127.0.0.53:53 UDP DNS relay serveri
 */

'use strict';

const dgram    = require('dgram');
const { execSync, execFileSync } = require('child_process');
const { RELAY_IP, RELAY_PORT, AG_HOSTNAMES } = require('./constants');
const { parseDnsQueryName } = require('./packet');
const { forwardToProviders, forwardToSystem } = require('./forwarder');
const Logger = require('../../logger');

let _relayServer = null;
let _relayEgress = null;

function isRelayActive() {
  if (_relayServer !== null) return true;
  try {
    const out = execSync('netstat -aon | findstr 127.0.0.53:53', { encoding: 'utf8', windowsHide: true });
    return out.includes('127.0.0.53:53');
  } catch (_) {
    return false;
  }
}

/**
 * RELAY_IP:RELAY_PORT portini egallagan jarayonlarni o'ldiradi.
 * @returns {number} o'ldirilgan jarayonlar soni
 */
function killPortOwner(forceAll = false) {
  let killed = 0;
  try {
    const out = execSync(
      `netstat -aon | findstr "${RELAY_IP}:${RELAY_PORT}"`,
      { encoding: 'utf8', windowsHide: true }
    );
    const pids = new Set();
    for (const line of out.split('\n')) {
      // Misol: "  UDP    127.0.0.53:53    *:*    1234"
      const m = line.trim().match(/(\d+)\s*$/);
      if (m && m[1] !== '0') pids.add(m[1]);
    }
    for (const pid of pids) {
      try {
        if (!forceAll) {
          try {
            const pName = execSync(
              `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName"`,
              { encoding: 'utf8', windowsHide: true }
            ).trim();
            // VPN yoki boshqa dasturlar (Sota VPN va h.k.) ga aslo tegilmaydi!
            if (pName && !['node', 'antigravity-bypass'].includes(pName.toLowerCase())) {
              continue;
            }
          } catch (_) {}
        }
        execFileSync('taskkill', ['/PID', pid, '/F'], { windowsHide: true });
        Logger.info(`[relay] Eski relay jarayoni (PID ${pid}) to'xtatildi.`);
        killed++;
      } catch (_) {
        // Jarayon allaqachon o'lgan yoki ruxsat yo'q
      }
    }
  } catch (_) {
    // netstat muvaffaqiyatsiz — portni hech kim egallagan bo'lmasligi mumkin
  }
  return killed;
}

/**
 * Portning bo'shashini kuting (maks maxMs millisekund).
 */
function waitPortFree(maxMs = 2000, stepMs = 200) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const out = execSync(
        `netstat -aon | findstr "${RELAY_IP}:${RELAY_PORT}"`,
        { encoding: 'utf8', windowsHide: true }
      );
      if (!out.includes(`${RELAY_IP}:${RELAY_PORT}`)) return true;
    } catch (_) {
      return true; // netstat xatosi = port bo'sh deb hisoblaymiz
    }
    // Sinxron kutish (msleep ekvivalenti)
    const until = Date.now() + stepMs;
    while (Date.now() < until) { /* spin */ }
  }
  return false;
}

function _bindServer(server, resolve, reject, isRetry = false) {
  server.on('error', (err) => {
    try { server.close(); } catch (_) {}

    if (err.code === 'EADDRINUSE') {
      if (isRetry) {
        // Ikkinchi urinish ham muvaffaqiyatsiz — eski xulq bilan davom etamiz
        Logger.warn(`[relay] Port ${RELAY_PORT} hali ham band. Tashqi DNS relay qabul qilindi.`);
        _relayServer = { isExternal: true, close: () => {} };
        resolve();
        return;
      }

      // Birinchi EADDRINUSE: portni egallagan jarayonni o'ldirib, qayta urinamiz
      Logger.warn(`[relay] ${RELAY_IP}:${RELAY_PORT} porti band — egallagan jarayon o'ldirilmoqda...`);
      const killedCount = killPortOwner();

      if (killedCount === 0) {
        Logger.warn(`[relay] O'ldiriladigan jarayon topilmadi. Tashqi DNS relay qabul qilindi.`);
        _relayServer = { isExternal: true, close: () => {} };
        resolve();
        return;
      }

      const freed = waitPortFree(2000);
      if (!freed) {
        Logger.warn(`[relay] Port ${RELAY_PORT} hali band (kutish tugadi). Qayta urinilmoqda...`);
      }

      // Yangi socket yaratib, qayta bind qilamiz
      let retryServer;
      try {
        retryServer = dgram.createSocket('udp4');
      } catch (e) {
        reject(e);
        return;
      }
      _attachMessageHandler(retryServer);
      _bindServer(retryServer, resolve, reject, true);
      return;
    }

    _relayServer = null;
    Logger.error('[relay] Server xatoligi:', err.message);
    reject(err);
  });

  server.bind(RELAY_PORT, RELAY_IP, () => {
    _relayServer = server;
    Logger.debug(`[relay] DNS relay server faol: ${RELAY_IP}:${RELAY_PORT}`);
    resolve();
  });
}

function _attachMessageHandler(server) {
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
}

function startRelay(egress) {
  return new Promise((resolve, reject) => {
    if (_relayServer) { resolve(); return; }

    _relayEgress = egress;
    let server;

    try {
      server = dgram.createSocket('udp4');
    } catch (e) {
      reject(e);
      return;
    }

    _attachMessageHandler(server);
    _bindServer(server, resolve, reject, false);
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
  // Agar boshqa node jarayoni 127.0.0.53:53 ni ushlab turgan bo'lsa, xavfsiz to'xtatish
  if (isRelayActive()) {
    killPortOwner(false);
  }
}

function getRelayEgress() {
  return _relayEgress;
}

module.exports = {
  isRelayActive,
  startRelay,
  stopRelay,
  killPortOwner,
  getRelayEgress,
};
