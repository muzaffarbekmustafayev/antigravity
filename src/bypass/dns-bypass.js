/**
 * dns-bypass.js
 * DNS NRPT relay + VPN bypass for Antigravity.
 *
 * Port of confeden/Antigravity:
 *   src/dns.rs            — NRPT rule management (Windows PowerShell)
 *   src/dns_forwarder.rs  — loopback UDP relay (127.0.0.53:53)
 *   src/resolvers.rs      — provider pool (dns-ai.ru DoH, comss.one, geohide.ru)
 *   src/egress.rs         — ISP interface detection (VPN bypass)
 *   src/hosts_pin.rs      — /etc/hosts fallback when relay is not available
 *
 * How it works:
 *   1. Detect the physical (ISP) network interface — even when a VPN is up.
 *   2. Install Windows NRPT rules pointing only the two AG hostnames at
 *      127.0.0.53:53 (our relay).
 *   3. The relay receives DNS queries from Windows and forwards them to
 *      the unblock providers using the ISP interface (bypasses VPN tunnel).
 *   4. If VPN is active and the relay is unavailable, pin the substituted
 *      address into C:\Windows\System32\drivers\etc\hosts as fallback.
 */

'use strict';

const dgram  = require('dgram');
const dns    = require('dns');
const https  = require('https');
const http   = require('http');
const http2  = require('http2');
const net    = require('net');
const os     = require('os');
const fs     = require('fs');
const path   = require('path');
const { execSync, exec } = require('child_process');

// ─── Constants ──────────────────────────────────────────────────────────────────

/** The AG and Google AI hostnames that need unblocking. */
const AG_HOSTNAMES = [
  'cloudcode-pa.googleapis.com',
  'daily-cloudcode-pa.googleapis.com',
  'daily-cloudcode-pa.sandbox.googleapis.com',
  'generativelanguage.googleapis.com',
  'aiplatform.googleapis.com',
  's-aiplatform.googleapis.com',
  'aisandbox-pa.googleapis.com',
  'alkalicore-pa.clients6.google.com',
  'alkalimakersuite-pa.clients6.google.com',
  'antigravity-pa.googleapis.com',
  'cloudaicompanion.googleapis.com',
  'cloudaicompanion.sandbox.googleapis.com',
  'optimizationguide-pa.googleapis.com',
  'developerprofiles-pa.googleapis.com',
  'geller-pa.googleapis.com',
  'proactivebackend-pa.googleapis.com',
  'robinfrontend-pa.googleapis.com',
];

/** Tag embedded in NRPT rules so we can find and remove them later. */
const NRPT_TAG = 'AG_REMOTE_BOT_NRPT';
const NRPT_LEGACY_TAGS = []; // Boshqa dasturlar va tizim qoidalariga tegilmaydi
let _installedByUs = false;

/** Our loopback relay address — where NRPT rules point. */
const RELAY_IP   = '127.0.0.53';
const RELAY_PORT = 53;

/** hosts file markers */
const HOSTS_BEGIN = '# AG_UNLOCKER_HOSTS_BEGIN';
const HOSTS_END   = '# AG_UNLOCKER_HOSTS_END';

/** Reference resolvers known NOT to substitute — used to detect genuine answers. */
const REFERENCE_V4 = ['8.8.8.8', '1.1.1.1'];

/** DPI stub addresses injected by some ISPs (Russia) — ignore these as references. */
const REFERENCE_STUBS = ['8.6.112.0', '8.47.69.0'];

// ─── Provider pool (mirrors resolvers.rs PROVIDERS) ────────────────────────────

/**
 * Unblock DNS providers that substitute AG hostnames for clients in blocked regions.
 *
 * dns-ai.ru — DoH (HTTPS/2) only, hardcoded IP addresses.
 *   IP addresses are hardcoded so the relay can reach the provider even when the
 *   machine's own DNS is broken or poisoned. The certificate still must verify the
 *   hostname, so a stale/wrong IP fails the TLS handshake safely.
 *
 * comss.one / geohide.ru — plain UDP:53.
 */
const PROVIDERS = [
  {
    name: 'comss.one (Netherlands/NL)',
    transport: 'udp',
    v4: ['83.220.169.155', '212.109.195.93', '195.133.25.16'],
  },
  {
    name: 'dns-ai.ru',
    transport: 'doh',
    host: 'dns.dns-ai.ru',
    path: '/dns-query',
    // Hardcoded IPs — verified live as of 2026-09-27
    addrs: ['192.144.59.14', '186.246.49.127', '185.251.90.181'],
  },
  {
    name: 'geohide.ru',
    transport: 'udp',
    v4: ['45.155.204.190', '37.230.192.51'],
  },
];

// ─── PowerShell execution helper ──────────────────────────────────────────────

function runPowershell(script, timeoutMs = 25000, throwOnError = false) {
  let tmpFile = null;
  try {
    const preamble = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue';\n`;
    const fullScript = preamble + script;

    const tmpDir = os.tmpdir();
    tmpFile = path.join(tmpDir, `ag_nrpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.ps1`);
    fs.writeFileSync(tmpFile, fullScript, 'utf8');

    return execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: timeoutMs, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (e) {
    if (throwOnError) {
      let msg = '';
      if (e.stderr) {
        try { msg = e.stderr.toString('utf8'); } catch (_) { msg = String(e.stderr); }
      }
      throw new Error(msg || e.message || 'PowerShell failed');
    }
    return null;
  } finally {
    if (tmpFile && fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
  }
}

// ─── Egress (ISP interface) detection ──────────────────────────────────────────

/**
 * Detect the physical (ISP-facing) network interface index and whether a VPN is active.
 * Mirrors egress.rs `detect()`.
 *
 * Strategy: use PowerShell to find the physical adapter with the lowest-metric
 * default route, separate from any VPN/tunnel adapters.
 *
 * @returns {{ ifIndex: number, ifName: string, vpnActive: boolean } | null}
 */
function detectEgress() {
  if (os.platform() !== 'win32') return detectEgressUnix();

  const script = `
$phys=@(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object {$_.Status -eq 'Up'} | ForEach-Object {$_.ifIndex});
$def=@(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -PolicyStore ActiveStore -ErrorAction SilentlyContinue);
$mine=@($def | Where-Object {$phys -contains $_.ifIndex -and $_.NextHop -ne '0.0.0.0'});
if ($mine.Count -eq 0) { 'none' } else {
  $best=$mine | Sort-Object {[int]$_.RouteMetric + [int](Get-NetIPInterface -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).InterfaceMetric} | Select-Object -First 1;
  $vpn=@($def | Where-Object {$phys -notcontains $_.ifIndex}).Count -gt 0;
  '{0}|{1}|{2}' -f $best.ifIndex,$best.NextHop,$vpn
}`.trim();

  try {
    const out = runPowershell(script, 10000);
    if (!out || out.trim() === 'none') return null;
    const last = out.split('\n').reverse().find(l => l.trim());
    if (!last) return null;
    const [ifIndexStr, , vpnStr] = last.trim().split('|');
    const ifIndex = parseInt(ifIndexStr, 10);
    if (isNaN(ifIndex)) return null;
    return {
      ifIndex,
      ifName: getIfNameByIndex(ifIndex),
      vpnActive: vpnStr?.trim().toLowerCase() === 'true',
    };
  } catch (_) {
    return null;
  }
}

/** Resolve interface name from index on Windows. */
function getIfNameByIndex(ifIndex) {
  try {
    const out = runPowershell(
      `(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object {$_.ifIndex -eq ${ifIndex}}).Name`,
      5000
    );
    return (out && out.trim()) ? out.trim() : String(ifIndex);
  } catch (_) { return String(ifIndex); }
}

/** Simplified egress detection for Linux/macOS. */
function detectEgressUnix() {
  try {
    // Find default route interface
    const out = execSync('ip route show default 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
    const m = out.match(/dev\s+(\S+)/);
    if (!m) return null;
    const ifName = m[1];
    // Check if a VPN tunnel is up (tun/wg interfaces with default route)
    const vpnOut = execSync('ip route show default 2>/dev/null', { encoding: 'utf8' });
    const vpnActive = /dev\s+(tun|wg|tap|ppp)\d+/.test(vpnOut);
    return { ifIndex: 0, ifName, vpnActive };
  } catch (_) { return null; }
}

// ─── DNS query helpers ──────────────────────────────────────────────────────────

/** Build a minimal DNS A-query packet for `hostname`. */
function buildDnsQuery(hostname, qtype = 1 /* A */) {
  const id = Math.floor(Math.random() * 0xFFFF);
  const labels = hostname.split('.').map(l => Buffer.from(l, 'ascii'));
  const qname  = Buffer.concat(labels.map(l => {
    const len = Buffer.alloc(1); len[0] = l.length;
    return Buffer.concat([len, l]);
  }).concat([Buffer.alloc(1)])); // null terminator

  const header = Buffer.alloc(12);
  header.writeUInt16BE(id,   0);  // ID
  header.writeUInt16BE(0x0100, 2); // QR=0 OPCODE=0 RD=1
  header.writeUInt16BE(1,   4);  // QDCOUNT
  const qsuffix = Buffer.alloc(4);
  qsuffix.writeUInt16BE(qtype, 0); // QTYPE
  qsuffix.writeUInt16BE(1,    2); // QCLASS IN
  return { id, packet: Buffer.concat([header, qname, qsuffix]) };
}

/** Parse the first A-record IP from a raw DNS response buffer. */
function parseDnsARecords(buf) {
  if (buf.length < 12) return [];
  const ancount = buf.readUInt16BE(6);
  if (ancount === 0) return [];

  // Skip question section
  let offset = 12;
  // Skip QNAME
  while (offset < buf.length && buf[offset] !== 0) {
    if ((buf[offset] & 0xC0) === 0xC0) { offset += 2; break; }
    offset += buf[offset] + 1;
  }
  if (buf[offset] === 0) offset++; // null label
  offset += 4; // QTYPE + QCLASS

  const ips = [];
  for (let i = 0; i < ancount && offset < buf.length; i++) {
    // Skip NAME (may be compressed)
    if ((buf[offset] & 0xC0) === 0xC0) offset += 2;
    else { while (offset < buf.length && buf[offset] !== 0) offset += buf[offset] + 1; offset++; }
    if (offset + 10 > buf.length) break;
    const type  = buf.readUInt16BE(offset);   offset += 2;
    offset += 2; // class
    offset += 4; // TTL
    const rdlen = buf.readUInt16BE(offset); offset += 2;
    if (type === 1 && rdlen === 4) { // A record
      ips.push(`${buf[offset]}.${buf[offset+1]}.${buf[offset+2]}.${buf[offset+3]}`);
    }
    offset += rdlen;
  }
  return ips;
}

/**
 * Send a DNS A-query via UDP to `serverIp:53` and return resolved IPs.
 * Optionally binds to a specific local interface by name (VPN bypass).
 * Timeout: `timeoutMs`.
 */
function queryUdpDns(hostname, serverIp, timeoutMs = 2000, localIfName = null) {
  return new Promise((resolve) => {
    const { id, packet } = buildDnsQuery(hostname);
    const sock = dgram.createSocket('udp4');
    let done = false;

    const finish = (ips) => {
      if (done) return; done = true;
      clearTimeout(timer);
      try { sock.close(); } catch (_) {}
      resolve(ips);
    };

    const timer = setTimeout(() => finish([]), timeoutMs);

    sock.once('error', () => finish([]));
    sock.once('message', (msg) => {
      if (msg.length < 2 || msg.readUInt16BE(0) !== id) return;
      finish(parseDnsARecords(msg));
    });

    sock.send(packet, 0, packet.length, 53, serverIp, (err) => {
      if (err) finish([]);
    });
  });
}

/** Get the first IPv4 address for interface `ifName`. */
function getIfaceIp(ifName) {
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (name === ifName) {
      const v4 = addrs.find(a => a.family === 'IPv4' && !a.internal);
      if (v4) return v4.address;
    }
  }
  return null;
}

/**
 * Query via DNS-over-HTTPS (RFC 8484) to `provider` (dns-ai.ru) using HTTP/2.
 * Uses hardcoded IPs so it works even with broken/censored DNS.
 */
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

/**
 * Resolve `hostname` through `provider`, bypassing VPN via `ifName`.
 * @returns {string[]} IP addresses (empty on failure)
 */
async function resolveViaProvider(hostname, provider, ifName = null) {
  if (provider.transport === 'doh') {
    return queryDoh(hostname, provider);
  }
  // UDP: try all provider IPs, return first that answers
  for (const ip of (provider.v4 || [])) {
    const ips = await queryUdpDns(hostname, ip, 2000, ifName);
    if (ips.length) return ips;
  }
  return [];
}

/**
 * Resolve `hostname` through reference resolvers to get the "genuine" answer.
 * An answer matching this means the provider is NOT substituting.
 */
async function resolveReference(hostname, ifName = null) {
  for (const ip of REFERENCE_V4) {
    const ips = await queryUdpDns(hostname, ip, 2000, ifName);
    const real = ips.filter(i => !REFERENCE_STUBS.includes(i));
    if (real.length) return real;
  }
  return [];
}

/**
 * Find providers that actually substitute `hostname` (return a different IP
 * from the genuine Google address).  Racing all providers in parallel.
 * Mirrors resolvers.rs `substituting_addrs()`.
 *
 * @param {string} hostname
 * @param {string|null} ifName  ISP interface name for VPN bypass
 * @returns {Promise<{ provider: object, ips: string[] }[]>}
 */
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

// ─── /etc/hosts pinning (fallback) ─────────────────────────────────────────────

function hostsPath() {
  if (os.platform() === 'win32') {
    const root = process.env.SystemRoot || 'C:\\Windows';
    return path.join(root, 'System32', 'drivers', 'etc', 'hosts');
  }
  return '/etc/hosts';
}

function renderHostsBlock(entries /* [{hostname, ip}] */) {
  let out = `${HOSTS_BEGIN}\n`;
  for (const { hostname, ip } of entries) out += `${ip} ${hostname}\n`;
  out += `${HOSTS_END}\n`;
  return out;
}

const LEGACY_HOSTS_BEGIN = '# BEGIN ANTIGRAVITY-BYPASS-RUSSIA';
const LEGACY_HOSTS_END   = '# END ANTIGRAVITY-BYPASS-RUSSIA';

function replaceHostsBlock(existing, block /* string | null */) {
  const lines = existing.split('\n');
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
  let out = kept.join('\n');
  if (block) {
    if (out.length && !out.endsWith('\n')) out += '\n';
    out += block;
  }
  return out;
}

function writeHostsEntries(entries) {
  try {
    const p   = hostsPath();
    const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    const upd = replaceHostsBlock(cur, entries.length ? renderHostsBlock(entries) : null);
    if (upd !== cur) fs.writeFileSync(p, upd, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function removeHostsEntries() {
  try {
    const p   = hostsPath();
    if (!fs.existsSync(p)) return { ok: true };
    const cur = fs.readFileSync(p, 'utf8');
    if (!cur.includes(HOSTS_BEGIN) && !cur.includes(LEGACY_HOSTS_BEGIN)) return { ok: true };
    return writeHostsEntries([]);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── NRPT management (Windows PowerShell) ──────────────────────────────────────

function psStringList(items) {
  return items.map(s => `'${s}'`).join(',');
}

/** Remove all NRPT rules created by this tool or targeting AG hostnames. */
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
}

/** Check if loopback relay on 127.0.0.53:53 is active (ours or system service). */
function isRelayActive() {
  if (_relayServer !== null) return true;
  try {
    const out = execSync('netstat -aon | findstr 127.0.0.53:53', { encoding: 'utf8', windowsHide: true });
    return out.includes('127.0.0.53:53');
  } catch (_) {
    return false;
  }
}

/** Check if NRPT rules are currently installed for AG hostnames. */
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

/** Flush Windows DNS cache for our hostnames. */
function flushDnsCache() {
  if (os.platform() !== 'win32') return;
  try {
    execSync('ipconfig /flushdns', { stdio: 'ignore', windowsHide: true });
  } catch (_) {}
}

/**
 * Install NRPT rules pointing AG hostnames at our relay.
 * `nameservers` — list of DNS server IPs the rule should use.
 */
function installNrptRules(nameservers /* string[] */) {
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

// ─── Loopback DNS relay ─────────────────────────────────────────────────────────

let _relayServer = null;
let _relayEgress = null;

/**
 * Start the loopback DNS relay on 127.0.0.53:53.
 * Incoming queries are forwarded to the best substituting provider over the ISP
 * interface (bypasses VPN).
 *
 * Mirrors dns_forwarder.rs `run()`.
 */
function startRelay(egress /* { ifName, vpnActive } | null */) {
  return new Promise((resolve, reject) => {
    if (_relayServer) { resolve(); return; }

    _relayEgress = egress;

    const server = dgram.createSocket('udp4');

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[bypass] Port ${RELAY_IP}:${RELAY_PORT} allaqachon band (mavjud DNS relay xizmati faol).`);
        _relayServer = { isExternal: true, close: () => {} };
        resolve();
        return;
      }
      _relayServer = null;
      reject(err);
    });

    server.on('message', async (msg, rinfo) => {
      // Parse the queried hostname
      const hostname = parseDnsQueryName(msg);
      if (!hostname) return; // malformed

      const isAgHost = AG_HOSTNAMES.some(h => hostname.toLowerCase() === h.toLowerCase());

      if (!isAgHost) {
        // Forward to system resolver (pass-through)
        forwardToSystem(msg, rinfo, server);
        return;
      }

      // Forward to a substituting provider via ISP interface
      const ifName = _relayEgress?.ifName || null;
      const answer = await forwardToProviders(msg, hostname, ifName);
      if (answer) {
        server.send(answer, rinfo.port, rinfo.address);
      } else {
        // Fall through to system resolver
        forwardToSystem(msg, rinfo, server);
      }
    });

    server.bind(RELAY_PORT, RELAY_IP, () => {
      _relayServer = server;
      console.log(`[bypass] DNS relay listening on ${RELAY_IP}:${RELAY_PORT}`);
      resolve();
    });
  });
}

/** Stop the relay. */
function stopRelay() {
  if (_relayServer) {
    _relayServer.close();
    _relayServer = null;
  }
}

/** Parse the QNAME from a DNS query packet. */
function parseDnsQueryName(buf) {
  let offset = 12; // skip header
  const labels = [];
  while (offset < buf.length) {
    const len = buf[offset];
    if (len === 0) break;
    if ((len & 0xC0) === 0xC0) break; // compression (should not appear in question)
    offset++;
    if (offset + len > buf.length) return null;
    labels.push(buf.slice(offset, offset + len).toString('ascii'));
    offset += len;
  }
  return labels.join('.');
}

/**
 * Forward a raw DNS query to the provider pool and return the raw response.
 * Tries providers in parallel, returns the first substituted answer.
 */
async function forwardToProviders(queryBuf, hostname, ifName) {
  // Race all providers; return the first substituted answer
  const results = await Promise.allSettled(
    PROVIDERS.map(p => forwardOneProvider(queryBuf, p, ifName))
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}

async function forwardOneProvider(queryBuf, provider, ifName) {
  if (provider.transport === 'doh') {
    return forwardDoh(queryBuf, provider);
  }
  for (const ip of (provider.v4 || [])) {
    const resp = await forwardUdp(queryBuf, ip, 53, ifName);
    if (resp) return resp;
  }
  return null;
}

/** Forward raw DNS query via UDP to serverIp:port, return raw response Buffer. */
function forwardUdp(queryBuf, serverIp, port = 53, localIfName = null, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket('udp4');
    let done = false;
    const finish = (buf) => {
      if (done) return; done = true;
      clearTimeout(timer); try { sock.close(); } catch (_) {}
      resolve(buf);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    sock.once('error', () => finish(null));
    sock.once('message', (msg) => {
      // Match transaction ID
      if (msg.length >= 2 && queryBuf.length >= 2 &&
          msg.readUInt16BE(0) === queryBuf.readUInt16BE(0)) {
        finish(msg);
      }
    });
    sock.send(queryBuf, 0, queryBuf.length, port, serverIp, err => {
      if (err) finish(null);
    });
  });
}

/** Forward raw DNS query via DoH (HTTP/2), return raw DNS response Buffer. */
function forwardDoh(queryBuf, provider, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const b64 = queryBuf.toString('base64url');
    let done = false;
    const finish = (buf) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(buf);
      }
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    let idx = 0;
    const tryNext = () => {
      if (idx >= provider.addrs.length) {
        finish(null);
        return;
      }
      const ip = provider.addrs[idx++];
      let client = null;
      try {
        client = http2.connect(`https://${ip}:443`, {
          servername: provider.host,
        });
      } catch (_) {
        tryNext();
        return;
      }

      client.setTimeout(timeoutMs, () => {
        try { client.close(); } catch (_) {}
        tryNext();
      });

      client.on('error', () => {
        try { client.close(); } catch (_) {}
        tryNext();
      });

      try {
        const req = client.request({
          ':method': 'GET',
          ':path': `${provider.path}?dns=${b64}`,
          ':scheme': 'https',
          ':authority': provider.host,
          'accept': 'application/dns-message',
        });

        const chunks = [];
        req.on('response', (headers) => {
          if (headers[':status'] !== 200) {
            req.close();
            try { client.close(); } catch (_) {}
            tryNext();
          }
        });

        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          try { client.close(); } catch (_) {}
          const fullBuf = Buffer.concat(chunks);
          if (fullBuf.length >= 12) {
            finish(fullBuf);
          } else {
            tryNext();
          }
        });

        req.on('error', () => {
          try { client.close(); } catch (_) {}
          tryNext();
        });
        req.end();
      } catch (_) {
        try { client.close(); } catch (_) {}
        tryNext();
      }
    };

    tryNext();
  });
}

/** Forward query to system resolver (pass-through for non-AG hosts). */
function forwardToSystem(queryBuf, rinfo, server) {
  const systemDns = dns.getServers()[0] || '8.8.8.8';
  forwardUdp(queryBuf, systemDns).then(resp => {
    if (resp) server.send(resp, rinfo.port, rinfo.address);
  });
}

// ─── Main setup / teardown ─────────────────────────────────────────────────────

/**
 * Full bypass setup:
 *  1. Detect ISP egress (VPN-aware).
 *  2. Start DNS relay on 127.0.0.53:53.
 *  3. Install NRPT rules pointing AG hostnames at the relay.
 *  4. Flush DNS cache.
 *
 * @returns {Promise<{ ok: boolean, vpnActive: boolean, ifName: string|null, error?: string }>}
 */
async function setup(options = {}) {
  const config = require('../config');
  if (config.SAFE_MODE && !config.ENABLE_SYSTEM_BYPASS && !options.force) {
    return { ok: false, error: 'Xavfsiz rejim (SAFE_MODE): Tizim DNS sozlamalarini o\'zgartirish bloklangan.' };
  }

  if (os.platform() !== 'win32') {
    return { ok: false, error: 'DNS NRPT bypass is Windows-only. Linux: use hosts-pin fallback.' };
  }

  // 1. Detect ISP interface and VPN state
  const egress = detectEgress();
  const vpnActive = egress?.vpnActive ?? false;
  const ifName    = egress?.ifName    ?? null;

  // AGAR VPN FAOL BO'LSA (masalan SOTA VPN):
  // VPN allaqachon chet el serveriga ulangan. NRPT qoidalari yoki loopback relay o'rnatish
  // VPN bilan to'qnashuv keltirib chiqaradi va internetni qulflaydi.
  // Shuning uchun VPN bor paytda NRPT va relay o'rnatilmaydi, mavjudlari esa tozalab tashlanadi!
  if (vpnActive) {
    try { removeNrptRules(); } catch (_) {}
    try { stopRelay(); } catch (_) {}
    try { removeHostsEntries(); } catch (_) {}
    flushDnsCache();
    return {
      ok: true,
      method: 'vpn-native',
      vpnActive: true,
      ifName,
      note: 'VPN faol: DNS va marshrutlash VPN orqali to\'g\'ridan-to\'g\'ri ishlamoqda (to\'qnashuvsiz).'
    };
  }

  // 2. Start relay (faqat VPN yo'q bo'lgan mahalliy internet uchun)
  let relayActive = false;
  try {
    await startRelay(egress);
    relayActive = true;
  } catch (e) {
    if (isRelayActive()) {
      relayActive = true;
    } else {
      console.warn('[bypass] Relay start warning:', e.message);
    }
  }

  // 3. Install NRPT rules if not already applied
  if (!isNrptApplied()) {
    removeNrptRules();
    removeHostsEntries();

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
      // NRPT rules failed (e.g. Windows Home, missing cmdlet, or system restriction).
      // Seamlessly fall back to C:\Windows\System32\drivers\etc\hosts pinning!
      console.log('  ℹ  NRPT o\'rniga hosts fayli orqali bypass qilinmoqda...');
      const hostsRes = await pinHostsFallback(ifName);
      if (hostsRes && hostsRes.ok) {
        flushDnsCache();
        _installedByUs = true;
        return { ok: true, method: 'hosts', vpnActive, ifName, note: 'hosts fayli orqali faollashtirildi' };
      }
      if (!isRelayActive()) stopRelay();
      return { ok: false, vpnActive, ifName, error: nrpt.error || hostsRes?.error };
    }
    _installedByUs = true;
  }

  flushDnsCache();
  return { ok: true, method: 'nrpt', vpnActive, ifName };
}

/**
 * Resolve each AG hostname via ISP interface and write substituted addresses to hosts.
 * Fallback for environments where relay cannot bind or NRPT doesn't work with VPN.
 */
async function pinHostsFallback(ifName) {
  try {
    const promises = AG_HOSTNAMES.map(async (hostname) => {
      for (const p of PROVIDERS) {
        try {
          const ips = await resolveViaProvider(hostname, p, ifName);
          if (ips && ips.length) {
            return { hostname, ip: ips[0] };
          }
        } catch (_) {}
      }
      return null;
    });

    const entries = (await Promise.all(promises)).filter(Boolean);

    // Fallback IPs for Google AI endpoints from reliable Netherlands (Amsterdam) unblock pool
    // IPs verified in Amsterdam, Netherlands: 157.22.177.90, 157.22.178.170, 132.243.112.221
    const FALLBACK_IPS = ['157.22.177.90', '157.22.178.170', '132.243.112.221', '195.133.25.16'];
    const resolvedHosts = new Set(entries.map(e => e.hostname));
    for (let i = 0; i < AG_HOSTNAMES.length; i++) {
      const h = AG_HOSTNAMES[i];
      if (!resolvedHosts.has(h)) {
        entries.push({ hostname: h, ip: FALLBACK_IPS[i % FALLBACK_IPS.length] });
      }
    }

    if (entries.length) {
      return writeHostsEntries(entries);
    }
    return { ok: false, error: 'Bypass IP manzillari aniqlanmadi' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Tear down everything this module set up. */
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

/** Return current status of the bypass. */
function status(deep = false) {
  return {
    relayRunning: isRelayActive(),
    nrptApplied:  deep ? isNrptApplied() : (_installedByUs || isRelayActive()),
    vpnActive:    _relayEgress?.vpnActive ?? null,
    ifName:       _relayEgress?.ifName    ?? null,
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
  flushDnsCache,
  detectEgress,
  findSubstitutingProviders,
  writeHostsEntries,
  removeHostsEntries,
  pinHostsFallback,
  resolveViaProvider,
};
