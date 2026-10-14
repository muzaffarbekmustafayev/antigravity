/**
 * index.js  —  src/bypass/index.js
 *
 * Public API for the AG bypass module.
 * Combines:
 *   • patch.js      — binary patching (ineligible → inexigible, https_proxy → AG_LS_PROXY)
 *   • dns-bypass.js — DNS NRPT relay + VPN-aware unblock provider pool
 *   • watchdog.js   — auto-repatch when Antigravity updates itself
 *
 * Usage (from server.js or any handler):
 *
 *   const bypass = require('./bypass');
 *
 *   // One-shot full setup (patch + DNS + relay):
 *   const result = await bypass.enable();
 *
 *   // Check status:
 *   console.log(bypass.status());
 *
 *   // Tear everything down (e.g. on shutdown):
 *   bypass.disable();
 */

'use strict';

const patch      = require('./patch');
const dnsBypass  = require('./dns-bypass');
const { Watchdog } = require('./watchdog');

let _watchdog = null;
let _isEnabled = false;

function isEnabled() {
  return _isEnabled;
}

/**
 * Enable the full bypass:
 *  1. Kill affected AG processes (CLI only, never IDE).
 *  2. Patch all binaries found on disk (if permitted).
 *  3. Setup DNS relay + NRPT rules (VPN-safe).
 *  4. Start watchdog (optional).
 *
 * Requires Administrator on Windows (for NRPT rules and hosts file).
 */
async function enable(options = {}) {
  const config = require('../config');
  if (config.SAFE_MODE && !config.ENABLE_SYSTEM_BYPASS && !options.force) {
    return {
      patch: { ok: 0, failed: 0, proxyVar: 0, errors: ['SAFE_MODE: Tizim sozlamalarini himoyalash uchun bypass bloklangan.'] },
      dns: { ok: false, vpnActive: false, ifName: null, error: 'SAFE_MODE faol' }
    };
  }

  // 1. Kill running CLI processes (never IDE)
  patch.killAffectedProcesses();

  // 2. Patch binaries
  const patchResult = patch.patchAllInstalls(options);

  // 3. DNS relay + NRPT
  const dnsResult = await dnsBypass.setup(options);

  if (patchResult.ok > 0 || dnsResult.ok) {
    _isEnabled = true;
  }

  // 4. Start watchdog only if explicitly requested
  if (options.watchdog && !_watchdog) {
    _watchdog = new Watchdog();
    _watchdog.on('repatched', ({ bin }) =>
      console.log(`[bypass:watchdog] Repatched after update: ${bin}`)
    );
    _watchdog.on('failed', ({ bin }) =>
      console.warn(`[bypass:watchdog] Failed to repatch: ${bin}`)
    );
    _watchdog.start();
  }

  return { patch: patchResult, dns: dnsResult };
}

/**
 * Disable the bypass:
 *  Faqat agar bypass ushbu instansiya tomonidan yoqilgan bo'lsa (yoki force=true),
 *  to'xtatiladi. Tizim sozlamalari va tashqi unlocker qoidalariga tegilmaydi!
 */
function disable(force = false) {
  if (!_isEnabled && !force) {
    return { ok: true, alreadyDisabled: true };
  }
  _isEnabled = false;
  if (_watchdog) {
    _watchdog.stop();
    _watchdog = null;
  }
  dnsBypass.teardown(force);
  return { ok: true };
}

/**
 * Current status snapshot.
 * @returns {{
 *   dns: { relayRunning: boolean, nrptApplied: boolean, vpnActive: boolean|null, ifName: string|null },
 *   watchdog: boolean,
 *   isEnabled: boolean,
 * }}
 */
function status(deep = false) {
  return {
    dns:       dnsBypass.status(deep),
    watchdog:  _watchdog !== null,
    isEnabled: _isEnabled,
  };
}

/**
 * Inspect installed binaries without writing anything.
 * @returns {{ path: string, eligibility: string, proxyVar: string }[]}
 */
function inspect() {
  const results = [];
  const targets = patch.getAllBinaryTargets ? patch.getAllBinaryTargets() : [];
  for (const bin of targets) {
    const state = patch.inspectFile(bin);
    results.push({ path: bin, type: 'binary', ...state });
  }
  const jsTargets = patch.getAllJsTargets ? patch.getAllJsTargets() : [];
  for (const js of jsTargets) {
    try {
      const content = require('fs').readFileSync(js, 'utf8');
      const patched = content.includes(patch.JS_PATCH_MARKER);
      results.push({
        path: js,
        type: 'js',
        eligibility: patched ? patch.PatchState.PATCHED : patch.PatchState.UNPATCHED,
        proxyVar: patch.PatchState.SIGNATURE_MISSING,
      });
    } catch (_) {
      results.push({
        path: js,
        type: 'js',
        eligibility: patch.PatchState.UNREADABLE,
        proxyVar: patch.PatchState.SIGNATURE_MISSING,
      });
    }
  }
  return results;
}

module.exports = {
  enable,
  disable,
  status,
  inspect,
  isEnabled,
  // Re-export sub-modules for advanced use
  patch,
  dns: dnsBypass,
  Watchdog,
};
