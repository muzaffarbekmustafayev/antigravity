/**
 * 🌐 Network Connectivity & IP Detector Module
 * Tarmoq holati, tashqi IP va geolokatsiyani aniqlash.
 */

'use strict';

const https = require('https');

let _cachedIpInfo = null;
let _lastCheckTime = 0;
let _isChecking = false;

/**
 * Tashqi IP va geolokatsiyani aniqlash (bir nechta ishonchli provayderlar va kesh bilan)
 */
function fetchCurrentIp(timeoutMs = 3500) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (result) => {
      if (!finished) {
        finished = true;
        resolve(result);
      }
    };

    const req = https.get('https://ipinfo.io/json', {
      headers: {
        'User-Agent': 'curl/7.68.0',
        'Accept': 'application/json'
      },
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode !== 200) {
        fallbackIpify(timeoutMs).then(finish);
        res.resume(); // discard data to free socket
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          if (info && info.ip) {
            finish({
              ok: true,
              ip: String(info.ip).trim(),
              country: info.country || 'UZ',
              city: info.city || '',
              org: info.org || '',
            });
            return;
          }
        } catch (_) {}
        fallbackIpify(timeoutMs).then(finish);
      });
    });

    req.on('error', () => {
      fallbackIpify(timeoutMs).then(finish);
    });

    req.on('timeout', () => {
      req.destroy();
      fallbackIpify(timeoutMs).then(finish);
    });
  });
}

function fallbackIpify(timeoutMs = 3000) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (result) => {
      if (!finished) {
        finished = true;
        resolve(result);
      }
    };

    const req = https.get('https://api.ipify.org?format=json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode !== 200) {
        finish({ ok: false, error: `HTTP ${res.statusCode}` });
        res.resume();
        return;
      }
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j && j.ip) {
            finish({
              ok: true,
              ip: String(j.ip).trim(),
              country: 'UNKNOWN',
              city: '',
              org: '',
            });
            return;
          }
        } catch (_) {}
        finish({ ok: false, error: 'Fallback JSON parse error' });
      });
    });

    req.on('error', (e) => finish({ ok: false, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      finish({ ok: false, error: 'Fallback timeout' });
    });
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
    const res = await fetchCurrentIp(3000);
    if (res && res.ok && res.ip) {
      const prevIp = _cachedIpInfo ? _cachedIpInfo.ip : null;
      _cachedIpInfo = res;
      _lastCheckTime = Date.now();

      // Inform if public IP address changed
      if (prevIp !== null && prevIp !== res.ip) {
        console.log(`\n🌐 [NETWORK]: IP updated: ${res.ip} (${res.country}, ${res.city || ''})`);
      }
    }
  } catch (_) {}
  finally {
    _isChecking = false;
  }

  return _cachedIpInfo || { ok: false, ip: 'Unknown', country: 'UNKNOWN', org: '' };
}

/**
 * Fon rejimida tarmoq o'zgarishlarini kuzatish
 */
function startNetworkWatcher(intervalMs = 10000, onChangeCallback = null) {
  getNetworkStatus(true);
  const timer = setInterval(async () => {
    const prev = _cachedIpInfo ? { ..._cachedIpInfo } : null;
    const curr = await getNetworkStatus(true);
    if (prev && curr && curr.ok && prev.ok && prev.ip !== curr.ip) {
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
