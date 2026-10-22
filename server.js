/**
 * server.js — Antigravity Bypass & Regional Unlocker Web Control Center
 * AI Studio Web Entrypoint (Node.js 22, Port 3000)
 */

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const patch = require('./src/bypass/patch');
const bypass = require('./src/bypass');
const dnsBypass = require('./src/bypass/dns-bypass');
const { getNetworkStatus } = require('./src/network');
const { clean } = require('./clean');
const { freeRelayPort, isRelayActive } = require('./src/bypass/dns/relay');
const { AG_HOSTNAMES, PROVIDERS } = require('./src/bypass/dns/constants');
const { resolveViaProvider } = require('./src/bypass/dns/forwarder');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Network Status
app.get('/api/network', async (req, res) => {
  try {
    const net = await getNetworkStatus(true);
    res.json({ ok: true, data: net });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Detected Installations
app.get('/api/installations', (req, res) => {
  try {
    const all = patch.detectInstallations(true);
    res.json({ ok: true, data: all });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. System & Bypass Status
app.get('/api/status', (req, res) => {
  try {
    const st = bypass.status(true);
    const relayActive = isRelayActive();
    res.json({
      ok: true,
      data: {
        ...st,
        relayRunning: relayActive,
        platform: process.platform,
        arch: process.arch,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Free Relay Port (127.0.0.53:53)
app.post('/api/free-port', (req, res) => {
  try {
    const killed = freeRelayPort();
    res.json({ ok: true, message: `Terminated ${killed} process(es) holding relay port.`, killed });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Apply Patch (Single or All)
app.post('/api/patch', async (req, res) => {
  try {
    const { targetIndex } = req.body;
    const all = patch.detectInstallations();
    const installed = all.filter(i => i.status === 'found');

    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < installed.length) {
      const inst = installed[targetIndex];
      const r = patch.patchInstallation(inst, { force: true });
      const dnsRes = await dnsBypass.setup();
      return res.json({ ok: true, target: inst.name, patchResult: r, dnsResult: dnsRes });
    }

    // Patch all
    const r = await bypass.enable({ force: true });
    res.json({ ok: true, patchResult: r.patch, dnsResult: r.dns });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Restore Original Binaries & Settings
app.post('/api/restore', (req, res) => {
  try {
    const all = patch.detectInstallations();
    const installed = all.filter(i => i.status === 'found');
    for (const inst of installed) {
      patch.unpatchInstallation(inst);
    }
    dnsBypass.teardown(true);
    res.json({ ok: true, message: 'All installations restored to original state and DNS rules cleaned.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Clean Temp Files & Release Port
app.post('/api/clean', (req, res) => {
  try {
    clean();
    const killed = freeRelayPort();
    res.json({ ok: true, message: `Cleaned temp files and released port (killed ${killed} process(es)).` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 8. Test SmartDNS & DoH Providers against Google Antigravity endpoints
app.post('/api/dns/test', async (req, res) => {
  try {
    const hostname = req.body.hostname || 'generativelanguage.googleapis.com';
    const dohProvider = PROVIDERS.find(p => p.transport === 'doh') || PROVIDERS[0];
    
    const startTime = Date.now();
    const resolvedIps = await resolveViaProvider(hostname, dohProvider);
    const latencyMs = Date.now() - startTime;

    res.json({
      ok: true,
      hostname,
      provider: dohProvider.name,
      ips: resolvedIps,
      latencyMs,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 9. Download or View Scripts & Executable
app.get('/api/download/exe', (req, res) => {
  const exePath = path.join(__dirname, 'dist', 'antigravity-bypass.exe');
  if (!fs.existsSync(exePath)) {
    return res.status(404).send('Executable not built yet. Run npm run build:exe first.');
  }
  res.download(exePath, 'antigravity-bypass.exe');
});

app.get('/api/scripts/:name', (req, res) => {
  const name = req.params.name;
  const allowed = ['clean-hosts.bat', 'fix-nrpt.ps1'];
  if (!allowed.includes(name)) {
    return res.status(404).send('Not found');
  }
  const filePath = path.join(__dirname, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File missing');
  }
  res.download(filePath);
});

// SPA Fallback: serve index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 Antigravity Bypass Web Dashboard running at http://${HOST}:${PORT}`);
});
