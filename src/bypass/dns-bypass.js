/**
 * dns-bypass.js — Antigravity DNS & NRPT Unlocker Facade
 * Modullashtirilgan arxitektura:
 *   - dns/constants.js — Domenlar va provayderlar
 *   - dns/packet.js    — Wire-format DNS kodlash/dekodlash
 *   - dns/forwarder.js — DoH va UDP provayderlar poygasi
 *   - dns/egress.js    — Tarmoq interfeysini aniqlash
 *   - dns/relay.js     — Loopback 127.0.0.53:53 xizmati
 *   - dns/nrpt.js      — Windows NRPT qoidalarini sozlash
 *   - dns/hosts.js     — hosts fayli zaxira marshruti
 */

'use strict';

const os = require('os');

const {
  AG_HOSTNAMES,
  PROVIDERS,
  RELAY_IP,
} = require('./dns/constants');

const {
  detectEgress,
} = require('./dns/egress');

const {
  isRelayActive,
  startRelay,
  stopRelay,
  getRelayEgress,
} = require('./dns/relay');

const {
  installNrptRules,
  removeNrptRules,
  isNrptApplied,
  flushDnsCache,
} = require('./dns/nrpt');

const {
  writeHostsEntries,
  removeHostsEntries,
  pinHostsFallback,
  isHostsApplied,
} = require('./dns/hosts');

const {
  findSubstitutingProviders,
  resolveViaProvider,
} = require('./dns/forwarder');

let _installedByUs = false;

/**
 * SmartDNS va Hosts/NRPT orqali to'liq unlock qilish
 */
async function setup(options = {}) {
  const config = require('../config');
  if (config.SAFE_MODE && !config.ENABLE_SYSTEM_BYPASS && !options.force) {
    return { ok: false, error: 'Xavfsiz rejim (SAFE_MODE): Tizim sozlamalarini o\'zgartirish bloklangan.' };
  }

  if (os.platform() !== 'win32') {
    return { ok: false, error: 'DNS bypass faqat Windows tizimida mavjud.' };
  }

  const mode = (options.mode || config.DNS_MODE || 'hosts').toLowerCase();
  const egress = detectEgress();
  const ifName = egress?.ifName ?? null;

  // 1. Hosts rejimi (Birlamchi, VPN-safe, Port 53 ga umuman tegmaydi)
  if (mode === 'hosts') {
    // Port 53 relay'ni to'xtatamiz va NRPT qoidalarini tozalaymiz
    stopRelay();
    removeNrptRules();

    const hostsRes = await pinHostsFallback(ifName);
    if (hostsRes && hostsRes.ok) {
      flushDnsCache();
      _installedByUs = true;
      return {
        ok: true,
        method: 'hosts',
        ifName,
        note: 'hosts fayli orqali faollashtirildi (Port 53 bo\'sh, VPN-safe)'
      };
    }
    return { ok: false, ifName, error: hostsRes?.error || 'Hosts faylini yangilab bo\'lmadi' };
  }

  // 2. NRPT rejimi (Eski usul, faqat majburiy so'ralganda)
  removeHostsEntries();

  try {
    await startRelay(egress);
  } catch (e) {
    if (!isRelayActive()) {
      console.warn('[bypass] Relay start warning:', e.message);
    }
  }

  if (!isNrptApplied()) {
    removeNrptRules();

    const nameservers = [RELAY_IP];
    if (egress) {
      for (const p of PROVIDERS) {
        if (p.transport === 'udp') {
          for (const ip of (p.v4 || [])) nameservers.push(ip);
        }
      }
    }

    const nrpt = installNrptRules(nameservers);
    if (!nrpt.ok && !isNrptApplied()) {
      const hostsRes = await pinHostsFallback(ifName);
      if (hostsRes && hostsRes.ok) {
        flushDnsCache();
        _installedByUs = true;
        return { ok: true, method: 'hosts', ifName, note: 'hosts fayli orqali faollashtirildi' };
      }
      if (!isRelayActive()) stopRelay();
      return { ok: false, ifName, error: nrpt.error || hostsRes?.error };
    }
    _installedByUs = true;
  }

  flushDnsCache();
  return { ok: true, method: 'nrpt', ifName };
}

/**
 * Sozlangan qoidalarni tozalash
 */
function teardown(force = false) {
  if (!_installedByUs && !force) {
    stopRelay();
    return;
  }
  _installedByUs = false;
  stopRelay();
  removeNrptRules();
  removeHostsEntries();
  flushDnsCache();
}

/**
 * Tarmoq va DNS holatini qaytarish
 */
function status(deep = false) {
  const relayEgress = getRelayEgress();
  const hostsActive = isHostsApplied();
  const nrptActive  = deep ? isNrptApplied() : (_installedByUs || isRelayActive());
  return {
    mode: hostsActive ? 'hosts' : (nrptActive ? 'nrpt' : 'none'),
    hostsApplied: hostsActive,
    relayRunning: isRelayActive(),
    nrptApplied:  nrptActive,
    ifName:       relayEgress?.ifName ?? null,
  };
}

module.exports = {
  AG_HOSTNAMES,
  PROVIDERS,
  setup,
  teardown,
  status,
  startRelay,
  stopRelay,
  installNrptRules,
  removeNrptRules,
  isNrptApplied,
  isHostsApplied,
  flushDnsCache,
  detectEgress,
  findSubstitutingProviders,
  writeHostsEntries,
  removeHostsEntries,
  pinHostsFallback,
  resolveViaProvider,
};
