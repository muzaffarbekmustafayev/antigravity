/**
 * 🌐 Network & VPN Auto-Detector Module
 * SOTA VPN va umumiy tarmoq holatini avtomatik aniqlaydi,
 * IP o'zgarishlarini kuzatadi va ulanishlarni to'g'ri marshrutlaydi.
 */

'use strict';

const https = require('https');
const http  = require('http');

let _cachedIpInfo = null;
let _lastCheckTime = 0;
let _isChecking = false;

/**
 * Tashqi IP va geolokatsiyani aniqlash (tezkor kesh bilan)
 */
function fetchCurrentIp(timeoutMs = 4000) {
  return new Promise((resolve) => {
    const req = https.get('https://ipinfo.io/json', {
      headers: { 'User-Agent': 'curl/7.68.0' },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve({
            ok: true,
            ip: info.ip,
            country: info.country,
            city: info.city,
            org: info.org,
            isVpn: info.country !== 'RU',
          });
        } catch (_) {
          resolve({ ok: false, error: 'JSON parse error' });
        }
      });
    });

    req.on('error', () => {
      // Zaxira: SOTA-ning o'z servisi
      fallbackAccessly(timeoutMs).then(resolve);
    });

    req.on('timeout', () => {
      req.destroy();
      fallbackAccessly(timeoutMs).then(resolve);
    });
  });
}

function fallbackAccessly(timeoutMs) {
  return new Promise((resolve) => {
    const req = https.get('https://ip.accessly.app', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve({
            ok: true,
            ip: j.ip,
            country: 'UNKNOWN',
            city: '',
            org: '',
            isVpn: true,
          });
        } catch (_) {
          resolve({ ok: false, error: 'Fallback failed' });
        }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
  });
}

/**
 * Joriy IP ma'lumotlarini olish (oxirgi 15 soniya davomida keshlanadi)
 */
async function getNetworkStatus(force = false) {
  const now = Date.now();
  if (!force && _cachedIpInfo && (now - _lastCheckTime < 15000)) {
    return _cachedIpInfo;
  }

  if (_isChecking && _cachedIpInfo) {
    return _cachedIpInfo;
  }

  _isChecking = true;
  try {
    const res = await fetchCurrentIp(3500);
    if (res.ok) {
      const prevVpn = _cachedIpInfo ? _cachedIpInfo.isVpn : null;
      _cachedIpInfo = res;
      _lastCheckTime = Date.now();

      // Agar VPN holati o'zgargan bo'lsa xabar beramiz
      if (prevVpn !== null && prevVpn !== res.isVpn) {
        if (res.isVpn) {
          console.log(`\n🛡️ [VPN FAOL]: SOTA VPN ulandi! IP: ${res.ip} (${res.country}, ${res.city || ''})`);
        } else {
          console.log(`\n⚠️ [VPN O'CHIQ]: Mahalliy tarmoqqa o'tildi. IP: ${res.ip} (${res.country})`);
        }
      }
    }
  } catch (_) {}
  finally {
    _isChecking = false;
  }

  return _cachedIpInfo || { ok: false, ip: 'Noma\'lum', country: 'RU', isVpn: false };
}

/**
 * Fon rejimida tarmoq o'zgarishlarini kuzatish
 */
function startNetworkWatcher(intervalMs = 10000, onChangeCallback = null) {
  getNetworkStatus(true);
  const timer = setInterval(async () => {
    const prev = _cachedIpInfo ? { ..._cachedIpInfo } : null;
    const curr = await getNetworkStatus(true);
    if (prev && curr.ok && prev.ok && (prev.ip !== curr.ip || prev.isVpn !== curr.isVpn)) {
      if (typeof onChangeCallback === 'function') {
        onChangeCallback(curr, prev);
      }
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

module.exports = {
  getNetworkStatus,
  fetchCurrentIp,
  startNetworkWatcher,
};
