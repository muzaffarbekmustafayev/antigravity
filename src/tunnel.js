/**
 * 🔒 HTTPS Tunnel Moduli (Nofaol / Standart rejim)
 * Foydalanuvchi veb interfeys va tunneldan foydalanmagani sababli nofaol qilingan.
 */

let activeTunnelUrl = null;
let tunnelProc      = null;

function getTunnelUrl() {
  return activeTunnelUrl;
}

function startTunnel(port, onReady) {
  // Nofaol
}

function cleanupTunnel() {
  if (tunnelProc) {
    try { tunnelProc.kill(); } catch (_) {}
    tunnelProc = null;
  }
}

module.exports = {
  startTunnel,
  getTunnelUrl,
  cleanupTunnel
};
