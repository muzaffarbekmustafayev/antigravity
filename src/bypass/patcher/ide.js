/**
 * ide.js — Antigravity IDE va kengaytmalar uchun JavaScript fayllarini xavfsiz patch qilish va tiklash
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { JS_PATCH_MARKER, BACKUP_EXT, BACKUP_META_EXT } = require('./constants');
const { writeAtomic } = require('./process');
const Logger = require('../../logger');

function isJsPatched(content) {
  return typeof content === 'string' && content.includes(JS_PATCH_MARKER);
}

function restoreJsFromBackup(jsPath) {
  const bakPath = jsPath + BACKUP_EXT;
  if (fs.existsSync(bakPath)) {
    try {
      fs.copyFileSync(bakPath, jsPath);
      Logger.debug(`IDE fayli zaxiradan tiklandi: ${jsPath}`);
      return { ok: true };
    } catch (e) {
      Logger.error(`IDE faylini tiklashda xato: ${jsPath}`, e.message);
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: 'Backup topilmadi' };
}

function backupJsOnce(filePath) {
  const bakPath = filePath + BACKUP_EXT;
  const metaPath = filePath + BACKUP_META_EXT;

  let currStat;
  try {
    currStat = fs.statSync(filePath);
  } catch (err) {
    return false;
  }

  if (fs.existsSync(bakPath)) {
    try {
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (meta && (meta.size !== currStat.size || Math.abs(meta.mtimeMs - currStat.mtimeMs) > 1000)) {
          const content = fs.readFileSync(filePath, 'utf8');
          if (!isJsPatched(content)) {
            fs.copyFileSync(filePath, bakPath);
            fs.writeFileSync(metaPath, JSON.stringify({ size: currStat.size, mtimeMs: currStat.mtimeMs }, null, 2), 'utf8');
            Logger.info(`IDE JS yangilanishi sezildi, yangi toza zaxira olindi: ${bakPath}`);
          }
        }
      }
    } catch (_) {}
    return true;
  }

  try {
    fs.copyFileSync(filePath, bakPath);
    try {
      fs.writeFileSync(metaPath, JSON.stringify({ size: currStat.size, mtimeMs: currStat.mtimeMs }, null, 2), 'utf8');
    } catch (_) {}
    Logger.debug(`IDE JS zaxira yaratildi: ${bakPath}`);
    return true;
  } catch (err) {
    Logger.error(`IDE JS zaxira yaratishda xato: ${filePath}`, err.message);
    return false;
  }
}

/**
 * Qavslar muvozanatini (Balanced Parentheses) saqlagan holda funksiya chaqiruvlarini
 * sintaksisni buzmasdan qiymatga almashtirish algoritmi.
 * Funksiya/metod e'lonlarini (declarations) va izohlarni avtomatik chetlab o'tadi.
 * Masalan: isAllowedCountry(user.getCountry(a, b)) -> true
 */
function replaceBalancedCall(code, funcName, replacement) {
  const regex = new RegExp(`(?<!function\\s+|async\\s+function\\s+|class\\s+|get\\s+|set\\s+|async\\s+|\\*\\s*)\\b${funcName}\\s*\\(`, 'g');
  let match;
  let lastIndex = 0;
  let result = '';
  let count = 0;

  while ((match = regex.exec(code)) !== null) {
    const startCall = match.index;
    const openParenIndex = match.index + match[0].length - 1;

    result += code.slice(lastIndex, startCall);

    let depth = 1;
    let i = openParenIndex + 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let inLineComment = false;
    let inBlockComment = false;
    let escaped = false;

    while (i < code.length && depth > 0) {
      const ch = code[i];

      if (escaped) {
        escaped = false;
        i++;
        continue;
      }

      if (ch === '\\' && !inLineComment && !inBlockComment) {
        escaped = true;
        i++;
        continue;
      }

      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
      } else if (inBlockComment) {
        if (ch === '*' && code[i + 1] === '/') {
          inBlockComment = false;
          i++;
        }
      } else if (inSingleQuote) {
        if (ch === "'") inSingleQuote = false;
      } else if (inDoubleQuote) {
        if (ch === '"') inDoubleQuote = false;
      } else if (inBacktick) {
        if (ch === '`') inBacktick = false;
      } else {
        if (ch === '/' && code[i + 1] === '/') {
          inLineComment = true;
          i++;
        } else if (ch === '/' && code[i + 1] === '*') {
          inBlockComment = true;
          i++;
        } else if (ch === "'") {
          inSingleQuote = true;
        } else if (ch === '"') {
          inDoubleQuote = true;
        } else if (ch === '`') {
          inBacktick = true;
        } else if (ch === '(') {
          depth++;
        } else if (ch === ')') {
          depth--;
        }
      }
      i++;
    }

    if (depth === 0) {
      // Metod yoki funksiya e'lonlarini (declarations) chetlab o'tish (SyntaxError oldini olish)
      // Masalan: isAllowedCountry(...) { yoki isAllowedCountry(...) =>
      const lookahead = code.slice(i, i + 60).trimStart();
      if (lookahead.startsWith('{') || lookahead.startsWith('=>') || /^:\s*[a-zA-Z0-9_<>[\]|&]+\s*\{/.test(lookahead)) {
        result += code.slice(startCall, i);
        lastIndex = i;
        regex.lastIndex = i;
        continue;
      }

      result += replacement;
      lastIndex = i;
      count++;
      regex.lastIndex = i;
    } else {
      result += code.slice(startCall, openParenIndex + 1);
      lastIndex = openParenIndex + 1;
    }
  }

  result += code.slice(lastIndex);
  return { modified: result, count };
}

/**
 * Antigravity IDE main.js va extension fayllarini sintaksisni buzmagan holda xavfsiz patch qilish
 */
function patchIdeMainJs(jsPath) {
  let content;
  try {
    content = fs.readFileSync(jsPath, 'utf8');
  } catch (e) {
    return { ok: false, error: e.message };
  }

  if (isJsPatched(content)) {
    return { ok: true, alreadyDone: true };
  }

  let modified = content;
  let changes = 0;

  // 1. Qavslar muvozanatini hisobga oluvchi xavfsiz chaqiruvlarni almashtirish
  const callReplacements = [
    { name: 'isAllowedCountry', val: 'true' },
    { name: 'isRegionBlocked', val: 'false' },
    { name: 'isCountryBlocked', val: 'false' },
    { name: 'isEligibleCountry', val: 'true' },
    { name: 'isCountryEligible', val: 'true' },
    { name: 'isGeoAllowed', val: 'true' },
    { name: 'isGeoBlocked', val: 'false' },
  ];

  for (const cr of callReplacements) {
    const res = replaceBalancedCall(modified, cr.name, cr.val);
    if (res.count > 0) {
      modified = res.modified;
      changes += res.count;
    }
  }

  // 2. Aniq identifikator va konstantalarni almashtirish
  const literalPatterns = [
    { find: /\bineligible_tiers\b/g, replace: 'inexigible_tiers' },
    { find: /\bineligibleTiers\b/g,  replace: 'inexigibleTiers' },
    { find: /"SET_INELIGIBLE"/g, replace: '"SET_INEXIGIBLE"' },
    { find: /'SET_INELIGIBLE'/g, replace: "'SET_INEXIGIBLE'" },
  ];

  for (const pat of literalPatterns) {
    const before = modified;
    modified = modified.replace(pat.find, pat.replace);
    if (modified !== before) changes++;
  }

  if (changes === 0) {
    const hasAnyGeoCode = /ineligible_tiers|SET_INELIGIBLE|isAllowedCountry|isRegionBlocked|isCountryBlocked/i.test(content);
    if (!hasAnyGeoCode) {
      return { ok: true, alreadyDone: true, note: 'geo-tekshiruv yo\'q (Language Server orqali)' };
    }
    return { ok: false, error: 'JS signature topilmadi (versiya mos kelmaydi)' };
  }

  const backedUp = backupJsOnce(jsPath);
  if (!backedUp) {
    return { ok: false, error: 'Asl JS fayli zaxiralab bo\'lmadi. Xavfsizlik yuzasidan patch bekor qilindi.' };
  }

  modified += '\n' + JS_PATCH_MARKER + '\n';

  try {
    writeAtomic(jsPath, Buffer.from(modified, 'utf8'));
  } catch (e) {
    return { ok: false, error: e.message };
  }

  return { ok: true, alreadyDone: false, changes };
}

module.exports = {
  isJsPatched,
  restoreJsFromBackup,
  patchIdeMainJs,
  backupJsOnce,
  replaceBalancedCall,
};
