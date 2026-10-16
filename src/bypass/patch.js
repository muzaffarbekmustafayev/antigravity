/**
 * patch.js — Antigravity Patching Facade
 * Modullashtirilgan arxitektura:
 *   - patcher/constants.js — Konstantalar va imzo baytlari
 *   - patcher/process.js   — Jarayonlar va atomik yozish
 *   - patcher/binary.js    — Binar bayt darajasidagi moslashtirish va kesh
 *   - patcher/ide.js       — IDE / JavaScript fayllari moslashtiruvi
 *   - patcher/detector.js  — Tizimdagi o'rnatilmalarni avto-qidiruv
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const {
  PROXY_VAR_NAME,
  PatchState,
  JS_PATCH_MARKER,
  BACKUP_EXT,
} = require('./patcher/constants');

const {
  killAffectedProcesses,
  sleepSync,
  writeAtomic,
  writeBinary,
} = require('./patcher/process');

const {
  inspectFile,
  patchFile,
  unpatchFile,
  repatchIfNeeded,
  isBinaryPatched,
  backupFileOnce,
  hasBytes,
  replaceAll,
} = require('./patcher/binary');

const {
  isJsPatched,
  restoreJsFromBackup,
  patchIdeMainJs,
  backupJsOnce,
} = require('./patcher/ide');

const {
  formatSize,
  getFastVersion,
  findBinaryTargets,
  findIdeJsTargets,
  discoverInstalls,
  getAllBinaryTargets,
  getAllJsTargets,
  detectInstallations,
  invalidateDetectionCache,
} = require('./patcher/detector');

/**
 * Tizimdagi barcha aniqlangan fayllarni birvarakayiga patch qilish
 */
function patchAllInstalls(options = {}) {
  const summary = { ok: 0, failed: 0, proxyVar: 0, jsPatched: 0, jsFailed: 0, errors: [], details: [] };

  const targets = getAllBinaryTargets();
  for (const bin of targets) {
    const label  = path.basename(bin);
    const result = patchFile(bin, options);
    if (result.ok) {
      summary.ok++;
      if (result.proxyVarPatched) summary.proxyVar++;
      if (result.alreadyDone) {
        summary.details.push(`✓ ${label} — already patched`);
      } else {
        summary.details.push(`✓ ${label} — successfully patched`);
      }
    } else {
      summary.failed++;
      summary.errors.push(`${label}: ${result.error}`);
    }
  }

  const jsTargets = getAllJsTargets();
  for (const js of jsTargets) {
    const label  = path.basename(js);
    const result = patchIdeMainJs(js);
    if (result.ok) {
      summary.jsPatched++;
      if (result.alreadyDone) {
        summary.details.push(`✓ ${label} — ${result.note || 'already patched'}`);
      } else {
        summary.details.push(`✓ ${label} — ${result.changes || 0} change(s) applied`);
      }
    } else {
      summary.jsFailed++;
      summary.errors.push(`${label}: ${result.error}`);
    }
  }

  invalidateDetectionCache();
  return summary;
}

/**
 * Patch a specific single installation
 */
function patchInstallation(item, options = {}) {
  const result = {
    name: item.name,
    target: item.target,
    success: false,
    alreadyDone: false,
    details: [],
    errors: [],
  };

  if (!item || item.status === 'not found' || !item.target || item.target === 'Not found') {
    result.errors.push('Installation not found on system');
    return result;
  }

  if (item.type === 'ide') {
    if (fs.existsSync(item.target)) {
      const jsRes = patchIdeMainJs(item.target);
      if (jsRes.ok) {
        result.success = true;
        result.alreadyDone = jsRes.alreadyDone;
        result.details.push(`main.js — ${jsRes.alreadyDone ? 'already patched' : 'successfully patched'}`);
      } else {
        result.errors.push(`main.js: ${jsRes.error}`);
      }
    }
    if (Array.isArray(item.extraTargets)) {
      for (const eb of item.extraTargets) {
        if (fs.existsSync(eb)) {
          if (eb.endsWith('.js')) {
            const r = patchIdeMainJs(eb);
            if (r.ok) result.details.push(`${path.basename(eb)} — ${r.alreadyDone ? 'already patched' : 'patched'}`);
          } else {
            const r = patchFile(eb, options);
            if (r.ok) {
              result.details.push(`${path.basename(eb)} — ${r.alreadyDone ? 'already patched' : 'patched'}`);
              if (!r.alreadyDone) result.alreadyDone = false;
            } else {
              result.errors.push(`${path.basename(eb)}: ${r.error}`);
            }
          }
        }
      }
    }
  } else if (item.type === 'bin' || item.type === 'cli') {
    if (fs.existsSync(item.target)) {
      const bRes = patchFile(item.target, options);
      if (bRes.ok) {
        result.success = true;
        result.alreadyDone = bRes.alreadyDone;
        result.details.push(`${path.basename(item.target)} — ${bRes.alreadyDone ? 'already patched' : 'successfully patched'}`);
      } else {
        result.errors.push(`${path.basename(item.target)}: ${bRes.error}`);
      }
    }
  } else if (item.type === 'extension') {
    if (fs.existsSync(item.target)) {
      const jsFiles = findIdeJsTargets(item.target);
      for (const j of jsFiles) {
        const r = patchIdeMainJs(j);
        if (r.ok) {
          result.success = true;
          result.details.push(`${path.basename(j)} — ${r.alreadyDone ? 'already patched' : 'patched'}`);
        }
      }
      const binFiles = findBinaryTargets(item.target);
      for (const b of binFiles) {
        const r = patchFile(b, options);
        if (r.ok) {
          result.success = true;
          result.details.push(`${path.basename(b)} — ${r.alreadyDone ? 'already patched' : 'patched'}`);
        }
      }
    }
  }

  invalidateDetectionCache();
  return result;
}

/**
 * Restore a specific single installation back to original state (unpatch)
 */
function unpatchInstallation(item) {
  const result = {
    name: item.name,
    target: item.target,
    success: false,
    alreadyDone: false,
    details: [],
    errors: [],
  };

  if (!item || item.status === 'not found' || !item.target || item.target === 'Not found') {
    result.errors.push('Installation not found on system');
    return result;
  }

  if (item.type === 'ide') {
    if (fs.existsSync(item.target)) {
      const r = restoreJsFromBackup(item.target);
      if (r.ok) {
        result.success = true;
        result.details.push(`main.js — restored from backup`);
      } else {
        result.details.push(`main.js — ${r.error || 'already original'}`);
      }
    }
    if (Array.isArray(item.extraTargets)) {
      for (const eb of item.extraTargets) {
        if (fs.existsSync(eb)) {
          if (eb.endsWith('.js')) {
            restoreJsFromBackup(eb);
          } else {
            const r = unpatchFile(eb);
            if (r.ok) result.details.push(`${path.basename(eb)} — ${r.alreadyDone ? 'already original' : 'restored'}`);
          }
        }
      }
    }
  } else if (item.type === 'bin' || item.type === 'cli') {
    if (fs.existsSync(item.target)) {
      const r = unpatchFile(item.target);
      if (r.ok) {
        result.success = true;
        result.alreadyDone = r.alreadyDone;
        result.details.push(`${path.basename(item.target)} — ${r.alreadyDone ? 'already original' : 'restored'}`);
      } else {
        result.errors.push(r.error);
      }
    }
  } else if (item.type === 'extension') {
    if (fs.existsSync(item.target)) {
      const jsFiles = findIdeJsTargets(item.target);
      for (const j of jsFiles) {
        const r = restoreJsFromBackup(j);
        if (r.ok) {
          result.success = true;
          result.details.push(`${path.basename(j)} — restored from backup`);
        }
      }
      const binFiles = findBinaryTargets(item.target);
      for (const b of binFiles) {
        const r = unpatchFile(b);
        if (r.ok) {
          result.success = true;
          result.details.push(`${path.basename(b)} — ${r.alreadyDone ? 'already original' : 'restored'}`);
        }
      }
    }
  }

  invalidateDetectionCache();
  return result;
}

module.exports = {
  PROXY_VAR_NAME,
  PatchState,
  JS_PATCH_MARKER,
  BACKUP_EXT,
  inspectFile,
  patchFile,
  unpatchFile,
  repatchIfNeeded,
  patchIdeMainJs,
  restoreJsFromBackup,
  isJsPatched,
  isBinaryPatched,
  findBinaryTargets,
  findIdeJsTargets,
  discoverInstalls,
  getAllBinaryTargets,
  getAllJsTargets,
  patchAllInstalls,
  killAffectedProcesses,
  formatSize,
  getFastVersion,
  detectInstallations,
  patchInstallation,
  unpatchInstallation,
  invalidateDetectionCache,
};
