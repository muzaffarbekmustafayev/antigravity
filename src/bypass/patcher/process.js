/**
 * process.js — Jarayonlarni boshqarish, atomik yozish va fayl qulflanishini bartaraf etish
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Logger = require('../../logger');

/**
 * Windows jarayonlarini tozalash (agy.exe va language_server.exe)
 * Binar fayllarni qulflash (EBUSY/EPERM) xatolarini oldini oladi
 */
function killAffectedProcesses() {
  if (os.platform() !== 'win32') return;
  const procs = ['agy.exe', 'language_server.exe', 'language_server_windows_x64.exe'];
  for (const p of procs) {
    try {
      execFileSync('taskkill.exe', ['/F', '/T', '/IM', p], {
        stdio: 'ignore',
        windowsHide: true,
      });
      Logger.debug(`Process killed: ${p}`);
    } catch (_) {}
  }
}

function isIdeRunning() {
  if (os.platform() !== 'win32') return false;
  try {
    const out = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq Antigravity*', '/NH'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    return /antigravity/i.test(out);
  } catch (_) {
    return false;
  }
}

/**
 * Xavfsiz asinxron kutish
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fallback sinxron kutish (CPU ni 100% ga chiqarmaydigan xavfsiz mexanizm)
 */
function sleepSync(ms) {
  if (ms <= 0) return;
  try {
    const sab = new SharedArrayBuffer(4);
    const int32 = new Int32Array(sab);
    Atomics.wait(int32, 0, 0, ms);
  } catch (_) {
    try {
      const { spawnSync } = require('child_process');
      spawnSync(process.execPath, ['-e', `setTimeout(()=>{}, ${ms})`], {
        timeout: ms + 1000,
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch (_) {}
  }
}

/**
 * Windows-ga moslashgan, EPERM/EBUSY qulflanishlariga bardoshli atomik yozish
 */
function writeAtomic(targetPath, data) {
  const dir = path.dirname(targetPath);
  const tmp = path.join(dir, `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.agtmp`);

  try {
    fs.writeFileSync(tmp, data);
  } catch (err) {
    Logger.error(`Temp fayl yaratishda xato: ${tmp}`, err.message);
    throw err;
  }

  let retries = 5;
  let lastErr = null;

  while (retries > 0) {
    try {
      // 1. Standart atomik rename
      try {
        fs.renameSync(tmp, targetPath);
        return;
      } catch (renameErr) {
        // Windows da mavjud fayl ustiga rename qilish EPERM yoki EEXIST berishi mumkin
        if (os.platform() === 'win32') {
          fs.copyFileSync(tmp, targetPath);
          try { fs.unlinkSync(tmp); } catch (_) {}
          return;
        }
        throw renameErr;
      }
    } catch (err) {
      lastErr = err;
      retries--;
      if (retries > 0) {
        sleepSync(50 * (6 - retries));
      }
    }
  }

  try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
  Logger.error(`Fayl ustiga yozib bo'lmadi: ${targetPath}`, lastErr ? lastErr.message : '');
  throw lastErr || new Error(`Failed to write atomically to ${targetPath}`);
}

/**
 * Binar faylni xavfsiz yozish (agar qulflangan bo'lsa jarayonlarni tozalab qayta urinadi)
 */
function writeBinary(binPath, data, onWriteSuccess = null) {
  try {
    writeAtomic(binPath, data);
  } catch (err) {
    if (os.platform() === 'win32') {
      Logger.warn(`Fayl qulflangan bo'lishi mumkin, jarayonlar tozalanmoqda: ${binPath}`);
      killAffectedProcesses();
      sleepSync(200);
    }
    writeAtomic(binPath, data);
  }

  if (typeof onWriteSuccess === 'function') {
    onWriteSuccess(binPath);
  }
}

module.exports = {
  killAffectedProcesses,
  isIdeRunning,
  sleep,
  sleepSync,
  writeAtomic,
  writeBinary,
};
