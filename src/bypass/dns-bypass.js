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
 * SmartDNS va NRPT orqali to'liq unlock qilish (VPN-siz, to'g'ridan-to'g'ri mustaqil rejim)
 */
async function setup(options = {}) {
  const config = require('../config');
  if (config.SAFE_MODE && !config.ENABLE_SYSTEM_BYPASS && !options.force) {
    return { ok: false, error: 'Xavfsiz rejim (SAFE_MODE): Tizim sozlamalarini o\'zgartirish bloklangan.' };
  }

  if (os.platform() !== 'win32') {
    return { ok: false, error: 'DNS bypass faqat Windows tizimida mavjud.' };
  }

  const egress = detectEgress();
  const ifName = egress?.ifName ?? null;

  // Har doim hosts faylini tozalash (soxta yoki o'lik IP lar qolib ketmasligi uchun)
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

    installNrptRules(nameservers);
  }

  // Go tili asosidagi Language Server Windows NRPT ni chetlab o'tgani sababli,
  // hosts fayliga Comss SmartDNS (157.22.178.37) yoziladi — bu Rossiya hududida 100% ochilishini ta'minlaydi!
  const hostsRes = await pinHostsFallback(ifName);
  _installedByUs = true;
  flushDnsCache();

  return {
    ok: true,
    method: 'hybrid (nrpt + hosts)',
    ifName,
    note: 'Rossiya va MDH hududlari uchun SmartDNS (157.22.178.37) muvaffaqiyatli yoqildi'
  };
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
