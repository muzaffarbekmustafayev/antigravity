/**
 * relay.js — Loopback 127.0.0.53:53 UDP DNS relay serveri
 */

'use strict';

const dgram = require('dgram');
const { execSync } = require('child_process');
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

function startRelay(egress) {
  return new Promise((resolve, reject) => {
    if (_relayServer) { resolve(); return; }

    _relayEgress = egress;
    let server = null;

    try {
      server = dgram.createSocket('udp4');
    } catch (e) {
      reject(e);
      return;
    }

    server.on('error', (err) => {
      try { server.close(); } catch (_) {}
      if (err.code === 'EADDRINUSE') {
        Logger.warn(`[relay] 127.0.0.53:53 porti allaqachon band (boshqa DNS xizmati yoki oldingi instansiya).`);
        _relayServer = { isExternal: true, close: () => {} };
        resolve();
        return;
      }
      _relayServer = null;
      Logger.error('[relay] Server xatoligi:', err.message);
      reject(err);
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
      resolve();
    });
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
};
