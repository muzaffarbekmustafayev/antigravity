/**
 * binary.js — Binar fayllarni (.exe) bayt darajasida moslashtirish va zaxiradan tiklash
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  SIG_INELIGIBLE,
  SIG_INEXIGIBLE,
  SIG_HTTPS_PROXY,
  SIG_AG_LS_PROXY,
  BACKUP_EXT,
  BACKUP_META_EXT,
  PatchState,
} = require('./constants');
const { writeBinary, writeAtomic, killAffectedProcesses } = require('./process');
const Logger = require('../../logger');

// In-memory stat kesh — 180MB+ li fayllarni har safar qayta diskdan o'qishni oldini oladi
const _inspectCache = new Map();

function invalidateInspectCache(filePath) {
  if (filePath) {
    _inspectCache.delete(path.resolve(filePath));
  } else {
    _inspectCache.clear();
  }
}

/**
 * Baytlar massivida qidirish va o'rniga yozish (O(N), xotirani tejaydi)
 */
function replaceAll(buf, from, to) {
  if (from.length !== to.length) {
    throw new Error('replaceAll: length mismatch — replacement must match signature length');
  }
  let count = 0;
  let idx = 0;
  while ((idx = buf.indexOf(from, idx)) !== -1) {
    buf.set(to, idx);
    count++;
    idx += from.length;
  }
  return count;
}

function hasBytes(buf, needle) {
  return buf.indexOf(needle) !== -1;
}

function getBackupMeta(filePath) {
  const metaPath = filePath + BACKUP_META_EXT;
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function saveBackupMeta(filePath, stat) {
  const metaPath = filePath + BACKUP_META_EXT;
  try {
    fs.writeFileSync(metaPath, JSON.stringify({
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      createdAt: Date.now(),
    }, null, 2), 'utf8');
  } catch (_) {}
}

/**
 * Asl nusxani xavfsiz bir marta zaxiralash (.ag_backup)
 * Agar ilova yangilangan bo'lsa (mtime/size o'zgargan va toza bo'lsa), yangi toza zaxira olinadi.
 * Xotirani tejash maqsadida allaqachon o'qilgan preloadedData qayta ishlatiladi.
 */
function backupFileOnce(filePath, preloadedData = null) {
  const bakPath = filePath + BACKUP_EXT;
  let currStat;
  try {
    currStat = fs.statSync(filePath);
  } catch (err) {
    Logger.error(`Fayl ma'lumotlarini o'qishda xato: ${filePath}`, err.message);
    return false;
  }

  if (fs.existsSync(bakPath)) {
    const meta = getBackupMeta(filePath);
    if (!meta || meta.size !== currStat.size || Math.abs(meta.mtimeMs - currStat.mtimeMs) > 1000) {
      try {
        const data = preloadedData || fs.readFileSync(filePath);
        const isFreshUnpatched = data.indexOf(SIG_INELIGIBLE) !== -1 && data.indexOf(SIG_INEXIGIBLE) === -1;
        if (isFreshUnpatched) {
          fs.copyFileSync(filePath, bakPath);
          saveBackupMeta(filePath, currStat);
          Logger.info(`Antigravity yangilanishi sezildi, yangi asl nusxa zaxirasi olindi: ${bakPath}`);
          return true;
        }
      } catch (_) {}
    }
    return true;
  }

  try {
    fs.copyFileSync(filePath, bakPath);
    saveBackupMeta(filePath, currStat);
    Logger.debug(`Zaxira yaratildi: ${bakPath}`);
    return true;
  } catch (err) {
    Logger.error(`Zaxira nusxa yaratishda xato: ${filePath}`, err.message);
    return false;
  }
}

/**
 * 200MB+ binar fayllarni butunlay RAMga yuklamasdan, xotirani tejovchi (4MB chunk) oqimli skanerlash
 */
function scanSignaturesInFile(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
  } catch (_) {
    return null;
  }

  let hasPatched = false;
  let hasOriginal = false;
  let hasProxyNew = false;
  let hasProxyOrig = false;

  const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB chunks
  const OVERLAP = 32;
  const buf = Buffer.allocUnsafe(CHUNK_SIZE + OVERLAP);
  let position = 0;
  let carry = 0;

  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buf, carry, CHUNK_SIZE, position);
      if (bytesRead <= 0) break;

      const totalLen = carry + bytesRead;
      const slice = buf.subarray(0, totalLen);

      if (!hasPatched && slice.indexOf(SIG_INEXIGIBLE) !== -1) {
        hasPatched = true;
      }
      if (!hasPatched && !hasOriginal && slice.indexOf(SIG_INELIGIBLE) !== -1) {
        hasOriginal = true;
      }
      if (!hasProxyNew && slice.indexOf(SIG_AG_LS_PROXY) !== -1) {
        hasProxyNew = true;
      }
      if (!hasProxyNew && !hasProxyOrig && slice.indexOf(SIG_HTTPS_PROXY) !== -1) {
        hasProxyOrig = true;
      }

      // Agar ikkala patch mavjudligi tasdiqlansa, skanerlashni erta to'xtatish
      if (hasPatched && hasProxyNew) {
        break;
      }

      if (totalLen >= OVERLAP) {
        buf.copy(buf, 0, totalLen - OVERLAP, totalLen);
        carry = OVERLAP;
      } else {
        carry = 0;
      }

      position += bytesRead;
    }
  } catch (_) {
    return null;
  } finally {
    try { fs.closeSync(fd); } catch (_) {}
  }

  return {
    eligibility: hasPatched
      ? PatchState.PATCHED
      : (hasOriginal ? PatchState.UNPATCHED : PatchState.SIGNATURE_MISSING),
    proxyVar: hasProxyNew
      ? PatchState.PATCHED
      : (hasProxyOrig ? PatchState.UNPATCHED : PatchState.SIGNATURE_MISSING),
  };
}

/**
 * Binar faylni diskdan tezkor tekshirish (stat kesh va kam xotira sarflovchi skaner bilan)
 */
function inspectFile(binPath) {
  const resolved = path.resolve(binPath);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (_) {
    return { eligibility: PatchState.UNREADABLE, proxyVar: PatchState.UNREADABLE };
  }

  const cached = _inspectCache.get(resolved);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.result;
  }

  const result = scanSignaturesInFile(resolved);
  if (!result) {
    return { eligibility: PatchState.UNREADABLE, proxyVar: PatchState.UNREADABLE };
  }

  _inspectCache.set(resolved, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    result,
  });

  return result;
}

/**
 * Binar faylni xavfsiz patch qilish (zaxira kafolati va xotira tejamkorligi bilan)
 */
function patchFile(binPath, options = {}) {
  let data;
  try {
    data = fs.readFileSync(binPath);
  } catch (e) {
    return { ok: false, alreadyDone: false, proxyVarPatched: false, error: e.message };
  }

  const eligCount = replaceAll(data, SIG_INELIGIBLE, SIG_INEXIGIBLE);
  const alreadyDone = eligCount === 0 && (data.indexOf(SIG_INEXIGIBLE) !== -1);

  if (eligCount === 0 && !alreadyDone) {
    return { ok: false, alreadyDone: false, proxyVarPatched: false, error: 'Signature not found (ineligible)' };
  }

  // VPN (Sota VPN) va tizim proksisi orqali gRPC ulanishini saqlash uchun https_proxy buzilmaydi
  const patchProxy = options.patchProxy === true;
  const proxyCount = patchProxy ? replaceAll(data, SIG_HTTPS_PROXY, SIG_AG_LS_PROXY) : 0;
  const proxyVarPatched = proxyCount > 0 || (data.indexOf(SIG_AG_LS_PROXY) !== -1);

  if (eligCount > 0 || proxyCount > 0) {
    // ⚠️ Xavfsizlik: Zaxira yaratilmasa, aslo asl fayl ustiga yozilmaydi!
    const backedUp = backupFileOnce(binPath, data);
    if (!backedUp) {
      return {
        ok: false,
        alreadyDone: false,
        proxyVarPatched: false,
        error: 'Zaxira nusxa yaratib bo\'lmadi. Xavfsizlik yuzasidan patch bekor qilindi.',
      };
    }

    try {
      writeBinary(binPath, data, (p) => invalidateInspectCache(p));
    } catch (e) {
      return { ok: false, alreadyDone: false, proxyVarPatched: false, error: e.message };
    }
  }

  return { ok: true, alreadyDone, proxyVarPatched };
}

/**
 * Asliga qaytarish (Unpatch) — fayl qulflanishiga chidamli
 */
function unpatchFile(binPath) {
  const bakPath = binPath + BACKUP_EXT;
  if (fs.existsSync(bakPath)) {
    try {
      try {
        fs.copyFileSync(bakPath, binPath);
      } catch (copyErr) {
        killAffectedProcesses();
        const bakData = fs.readFileSync(bakPath);
        writeBinary(binPath, bakData);
      }
      invalidateInspectCache(binPath);
      return { ok: true, alreadyDone: false, fromBackup: true };
    } catch (err) {
      Logger.warn(`Zaxira nusxadan tiklashda muammo: ${err.message}, bayt darajasida teskari tiklash sinab ko'riladi.`);
    }
  }

  let data;
  try {
    data = fs.readFileSync(binPath);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  const c1 = replaceAll(data, SIG_INEXIGIBLE,  SIG_INELIGIBLE);
  const c2 = replaceAll(data, SIG_AG_LS_PROXY, SIG_HTTPS_PROXY);

  if (c1 === 0 && c2 === 0) {
    return { ok: true, alreadyDone: true };
  }

  try {
    writeBinary(binPath, data, (p) => invalidateInspectCache(p));
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return { ok: true, alreadyDone: false };
}

/**
 * Watchdog yoki fonda yangilanganda qayta patch qilish
 */
function repatchIfNeeded(binPath) {
  const resolved = path.resolve(binPath);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (_) {
    return 'failed';
  }

  const cached = _inspectCache.get(resolved);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    if (cached.result.eligibility === PatchState.PATCHED) {
      return 'already_patched';
    }
  }

  let data;
  try {
    data = fs.readFileSync(resolved);
  } catch (_) {
    return 'failed';
  }

  const eligCount  = replaceAll(data, SIG_INELIGIBLE,  SIG_INEXIGIBLE);
  const proxyCount = replaceAll(data, SIG_HTTPS_PROXY, SIG_AG_LS_PROXY);

  if (eligCount === 0) {
    if (!hasBytes(data, SIG_INEXIGIBLE)) return 'signature_missing';
    if (proxyCount > 0) {
      try {
        writeAtomic(resolved, data);
        invalidateInspectCache(resolved);
      } catch (_) {}
    }
    return 'already_patched';
  }

  try {
    const backedUp = backupFileOnce(resolved, data);
    if (!backedUp) return 'failed';
    writeBinary(resolved, data, (p) => invalidateInspectCache(p));
  } catch (_) {
    return 'failed';
  }
  return 'repatched';
}

function isBinaryPatched(binPath) {
  if (!binPath || !fs.existsSync(binPath)) return false;
  const insp = inspectFile(binPath);
  return insp.eligibility === PatchState.PATCHED;
}

module.exports = {
  inspectFile,
  patchFile,
  unpatchFile,
  repatchIfNeeded,
  isBinaryPatched,
  backupFileOnce,
  hasBytes,
  replaceAll,
  invalidateInspectCache,
};
