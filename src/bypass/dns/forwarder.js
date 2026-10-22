/**
 * forwarder.js — DNS so'rovlarini DoH va UDP provayderlariga yuborish va parallel poyga (fast race)
 */

'use strict';

const dgram = require('dgram');
const dns   = require('dns');
const http2 = require('http2');
const { PROVIDERS, REFERENCE_V4, REFERENCE_STUBS } = require('./constants');
const { buildDnsQuery, parseDnsARecords } = require('./packet');
const Logger = require('../../logger');

// HTTP/2 sessiyalarini qayta ishlatish havzasi (Connection Pooling) — DNS kechikishini 10 barobarga kamaytiradi
const _dohSessionPool = new Map();

/**
 * DNS javob paketi to'g'ri va muvaffaqiyatli (NOERROR) ekanini va kamida bitta A-rekord borligini tekshirish
 */
function isValidDnsResponse(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 12) return false;
  // QR bit must be 1 (is response)
  const isResponse = (buf[2] & 0x80) !== 0;
  if (!isResponse) return false;
  // RCODE (RFC 1035: lower 4 bits of byte 3) must be 0 (NOERROR)
  const rcode = buf[3] & 0x0F;
  if (rcode !== 0) return false;
  // ANCOUNT (bytes 6-7) must be > 0 (at least one answer)
  const ancount = buf.readUInt16BE(6);
  return ancount > 0;
}

function getOrCreateHttp2Session(provider, ip) {
  const poolKey = `${provider.host}_${ip}`;
  const existing = _dohSessionPool.get(poolKey);
  if (existing && !existing.destroyed && !existing.closed) {
    return existing;
  }

  try {
    const session = http2.connect(`https://${ip}:443`, {
      servername: provider.host,
    });

    const cleanup = () => {
      _dohSessionPool.delete(poolKey);
      try {
        if (!session.destroyed) session.destroy();
      } catch (_) {}
    };

    session.on('error', cleanup);
    session.on('close', cleanup);
    session.on('goaway', cleanup);

    _dohSessionPool.set(poolKey, session);
    return session;
  } catch (_) {
    return null;
  }
}

function forwardUdp(queryBuf, serverIp, port = 53, localIfNameOrTimeout = null, timeoutMsOrSignal = 1800, maybeSignal = null) {
  let timeoutMs = 1800;
  let signal = null;

  if (typeof localIfNameOrTimeout === 'number') {
    timeoutMs = localIfNameOrTimeout;
    if (timeoutMsOrSignal && typeof timeoutMsOrSignal === 'object' && 'aborted' in timeoutMsOrSignal) {
      signal = timeoutMsOrSignal;
    }
  } else {
    if (typeof timeoutMsOrSignal === 'number') timeoutMs = timeoutMsOrSignal;
    if (maybeSignal && typeof maybeSignal === 'object' && 'aborted' in maybeSignal) {
      signal = maybeSignal;
    }
  }
  return new Promise((resolve) => {
    let sock = null;
    let timer = null;
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
      if (sock) {
        try { sock.close(); } catch (_) {}
        sock = null;
      }
    };

    const abortHandler = () => {
      cleanup();
      resolve(null);
    };

    if (signal?.aborted) {
      resolve(null);
      return;
    }

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    try {
      sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      sock.on('error', (err) => {
        Logger.debug(`UDP so'rovda xato (${serverIp}):`, err.message);
        cleanup();
        resolve(null);
      });

      // sock.on ishlatiladi — boshqa yoki noto'g'ri ID li paket kelganda listener yo'qolmaydi
      sock.on('message', (msg) => {
        if (msg.length >= 2 && queryBuf.length >= 2 &&
            msg.readUInt16BE(0) === queryBuf.readUInt16BE(0)) {
          cleanup();
          resolve(msg);
        }
      });

      sock.send(queryBuf, 0, queryBuf.length, port, serverIp, (err) => {
        if (err) {
          cleanup();
          resolve(null);
        }
      });
    } catch (_) {
      cleanup();
      resolve(null);
    }
  });
}

function forwardDoh(queryBuf, provider, timeoutMs = 2500, signal = null) {
  return new Promise((resolve) => {
    const b64 = queryBuf.toString('base64url');
    const addrs = provider.addrs || [];
    if (!addrs.length) {
      resolve(null);
      return;
    }

    let finished = false;
    const activeStreams = [];

    const cleanup = () => {
      if (!finished) {
        finished = true;
        if (timer) clearTimeout(timer);
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
        for (const req of activeStreams) {
          try { req.close(); } catch (_) {}
        }
        activeStreams.length = 0;
      }
    };

    const abortHandler = () => {
      cleanup();
      resolve(null);
    };

    if (signal?.aborted) {
      resolve(null);
      return;
    }

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    const finish = (buf) => {
      if (!finished) {
        cleanup();
        resolve(buf);
      }
    };

    let pending = addrs.length;

    for (const ip of addrs) {
      const poolKey = `${provider.host}_${ip}`;
      try {
        const session = getOrCreateHttp2Session(provider, ip);
        if (!session) {
          pending--;
          if (pending === 0) finish(null);
          continue;
        }

        let req;
        try {
          req = session.request({
            ':method': 'GET',
            ':path': `${provider.path}?dns=${b64}`,
            ':scheme': 'https',
            ':authority': provider.host,
            'accept': 'application/dns-message',
          });
        } catch (reqErr) {
          _dohSessionPool.delete(poolKey);
          try { session.destroy(); } catch (_) {}
          pending--;
          if (pending === 0) finish(null);
          continue;
        }

        activeStreams.push(req);

        const chunks = [];
        req.on('response', (headers) => {
          if (headers[':status'] !== 200) {
            try { req.close(); } catch (_) {}
            pending--;
            if (pending === 0) finish(null);
          }
        });

        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const fullBuf = Buffer.concat(chunks);
          if (isValidDnsResponse(fullBuf)) {
            finish(fullBuf);
          } else {
            pending--;
            if (pending === 0) finish(null);
          }
        });

        req.on('error', () => {
          pending--;
          if (pending === 0) finish(null);
        });

        req.end();
      } catch (_) {
        pending--;
        if (pending === 0) finish(null);
      }
    }
  });
}

/**
 * Barcha DoH va UDP provayderlariga bir vaqtda parallel so'rov yuborish (Fast Zero-Leak Race)
 * Faqat haqiqiy (NOERROR, ancount > 0) javob qaytargan provayder g'olib bo'ladi.
 * Noto'g'ri (NXDOMAIN/SERVFAIL/REFUSED) paketlar chetga suriladi.
 */
async function forwardToProviders(queryBuf, hostname, ifName, timeoutMs = 2500) {
  const ac = new AbortController();
  const signal = ac.signal;
  const tasks = [];

  for (const provider of PROVIDERS) {
    if (provider.transport === 'doh') {
      tasks.push(
        forwardDoh(queryBuf, provider, timeoutMs, signal).then(buf => {
          if (isValidDnsResponse(buf)) return buf;
          throw new Error('invalid or empty doh');
        })
      );
    } else if (provider.v4 && Array.isArray(provider.v4)) {
      for (const ip of provider.v4) {
        tasks.push(
          forwardUdp(queryBuf, ip, 53, ifName, Math.min(timeoutMs, 2000), signal).then(buf => {
            if (isValidDnsResponse(buf)) return buf;
            throw new Error('invalid or empty udp');
          })
        );
      }
    }
  }

  try {
    const fastest = await Promise.any(tasks);
    ac.abort(); // Qolgan barcha soketlarni zudlik bilan yopish
    return fastest;
  } catch (_) {
    ac.abort();
    return null;
  }
}

function forwardToSystem(queryBuf, rinfo, server) {
  const servers = dns.getServers();
  const targets = (servers && servers.length) ? servers : ['8.8.8.8'];
  let answered = false;

  for (const systemDns of targets) {
    forwardUdp(queryBuf, systemDns, 53, null, 1800).then(resp => {
      if (resp && server && !answered) {
        answered = true;
        try {
          server.send(resp, rinfo.port, rinfo.address);
        } catch (_) {}
      }
    }).catch(() => {});
  }
}

function queryUdpDns(hostname, serverIp, timeoutMs = 2000, localIfName = null) {
  return new Promise((resolve) => {
    const { id, packet } = buildDnsQuery(hostname);
    forwardUdp(packet, serverIp, 53, localIfName, timeoutMs).then(msg => {
      if (msg && msg.length >= 2 && msg.readUInt16BE(0) === id) {
        resolve(parseDnsARecords(msg));
      } else {
        resolve([]);
      }
    }).catch(() => resolve([]));
  });
}

function queryDoh(hostname, provider, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const { packet } = buildDnsQuery(hostname);
    forwardDoh(packet, provider, timeoutMs).then(buf => {
      if (buf) {
        resolve(parseDnsARecords(buf));
      } else {
        resolve([]);
      }
    }).catch(() => resolve([]));
  });
}

async function resolveViaProvider(hostname, provider, ifName = null) {
  if (provider.transport === 'doh') {
    return queryDoh(hostname, provider);
  }
  for (const ip of (provider.v4 || [])) {
    const ips = await queryUdpDns(hostname, ip, 2000, ifName);
    if (ips && ips.length) return ips;
  }
  return [];
}

async function resolveReference(hostname, ifName = null) {
  for (const ip of REFERENCE_V4) {
    const ips = await queryUdpDns(hostname, ip, 2000, ifName);
    const real = ips.filter(i => !REFERENCE_STUBS.includes(i));
    if (real.length) return real;
  }
  return [];
}

async function findSubstitutingProviders(hostname, ifName = null) {
  const [refIps, ...providerResults] = await Promise.all([
    resolveReference(hostname, ifName),
    ...PROVIDERS.map(p => resolveViaProvider(hostname, p, ifName).then(ips => ({ p, ips }))),
  ]);

  const refSet = new Set(refIps);
  return providerResults
    .filter(({ ips }) => ips.length && ips.some(ip => !refSet.has(ip)))
    .map(({ p, ips }) => ({ provider: p, ips: ips.filter(ip => !refSet.has(ip)) }));
}

module.exports = {
  isValidDnsResponse,
  forwardUdp,
  forwardDoh,
  forwardToProviders,
  forwardToSystem,
  queryUdpDns,
  queryDoh,
  resolveViaProvider,
  resolveReference,
  findSubstitutingProviders,
};
