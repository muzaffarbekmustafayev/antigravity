/**
 * patch.js
 * Binary patch for Antigravity language_server / agy / IDE binaries.
 *
 * Enhanced port combining techniques from:
 *   - confeden/Antigravity (src/patch_binary.rs, src/patch_ide.rs)
 *   - antigravity-bypass-russia (src/core/patcher.rs, src/core/detector.rs)
 *
 * Three patch strategies:
 *   1. Binary (EXE) — "ineligible" → "inexigible" + "https_proxy" → "AG_LS_PROXY"
 *   2. IDE main.js   — Region check functions → always return true
 *   3. VS Code/Cursor/Windsurf extensions — Same JS patching
 *
 * File size and structure are never changed for binaries — only bytes at the
 * matched offsets are overwritten.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Signatures (Binary patches — same-length byte replacements) ──────────────
const SIG_INELIGIBLE  = Buffer.from('ineligible',  'ascii'); // 10 bytes
const SIG_INEXIGIBLE  = Buffer.from('inexigible',  'ascii'); // 10 bytes  (same length)
const SIG_HTTPS_PROXY = Buffer.from('https_proxy', 'ascii'); // 11 bytes
const SIG_AG_LS_PROXY = Buffer.from('AG_LS_PROXY', 'ascii'); // 11 bytes  (same length)

// Public constant — used by dns-bypass to set the env variable on the LS process
const PROXY_VAR_NAME = 'AG_LS_PROXY';

// ─── IDE/JS patch markers ──────────────────────────────────────────────────────
const JS_PATCH_MARKER = '// AG_BYPASS_PATCHED';
const JS_BACKUP_EXT   = '.ag_backup';

/**
 * Replace ALL occurrences of `from` with `to` inside `buf` (in-place).
 * @returns {number} count of replacements made
 */
function replaceAll(buf, from, to) {
  if (from.length !== to.length) throw new Error('replaceAll: length mismatch');
  let count = 0;
  let idx = 0;
  while ((idx = buf.indexOf(from, idx)) !== -1) {
    buf.set(to, idx);
    count++;
    idx += from.length;
  }
  return count;
}

/**
 * Count occurrences of `needle` in `buf`.
 */
function countOccurrences(buf, needle) {
  let count = 0;
  let idx = 0;
  while ((idx = buf.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

/**
 * Atomic write: write to a sibling temp file, then rename over the target.
 */
function writeAtomic(targetPath, data) {
  const tmp = targetPath + `.${process.pid}.agtmp`;
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, targetPath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw err;
  }
}

/**
 * Kill whichever process holds the binary open (Windows only).
 */
function killHolder(binPath) {
  // Antigravity IDE va tizim jarayonlarini hech qachon o'ldirmaymiz
  return;
}

function sleepSync(ms) {
  try {
    const sab = new SharedArrayBuffer(4);
    const int32 = new Int32Array(sab);
    Atomics.wait(int32, 0, 0, ms);
  } catch (_) {
    try {
      require('child_process').execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, { stdio: 'ignore', windowsHide: true });
    } catch (__) {}
  }
}

/**
 * Write data to binPath, retrying once after killing any holder process.
 */
function writeBinary(binPath, data) {
  try {
    writeAtomic(binPath, data);
  } catch (_) {
    if (os.platform() === 'win32') killHolder(binPath);
    sleepSync(600);
    writeAtomic(binPath, data);
  }
}

// ─── State enum ─────────────────────────────────────────────────────────────────
const PatchState = Object.freeze({
  PATCHED:           'PATCHED',
  UNPATCHED:         'UNPATCHED',
  SIGNATURE_MISSING: 'SIGNATURE_MISSING',
  UNREADABLE:        'UNREADABLE',
});

/**
 * Read a binary and classify its current state without writing anything.
 */
function inspectFile(binPath) {
  let data;
  try { data = fs.readFileSync(binPath); }
  catch (e) { return { eligibility: PatchState.UNREADABLE, proxyVar: PatchState.UNREADABLE }; }

  const hasPatched   = countOccurrences(data, SIG_INEXIGIBLE)  > 0;
  const hasOriginal  = countOccurrences(data, SIG_INELIGIBLE)  > 0;
  const hasProxyNew  = countOccurrences(data, SIG_AG_LS_PROXY) > 0;
  const hasProxyOrig = countOccurrences(data, SIG_HTTPS_PROXY) > 0;

  return {
    eligibility: hasPatched
      ? PatchState.PATCHED
      : hasOriginal
        ? PatchState.UNPATCHED
        : PatchState.SIGNATURE_MISSING,
    proxyVar: hasProxyNew
      ? PatchState.PATCHED
      : hasProxyOrig
        ? PatchState.UNPATCHED
        : PatchState.SIGNATURE_MISSING,
  };
}

/**
 * Patch one binary file (EXE).
 */
function patchFile(binPath, options = {}) {
  let data;
  try { data = Buffer.from(fs.readFileSync(binPath)); }
  catch (e) { return { ok: false, alreadyDone: false, proxyVarPatched: false, error: e.message }; }

  // 1. Eligibility rename (required)
  const eligCount = replaceAll(data, SIG_INELIGIBLE, SIG_INEXIGIBLE);
  const alreadyDone = eligCount === 0 && countOccurrences(data, SIG_INEXIGIBLE) > 0;
  if (eligCount === 0 && !alreadyDone) {
    return { ok: false, alreadyDone: false, proxyVarPatched: false, error: 'Signature not found (ineligible)' };
  }

  // 2. Proxy var rename (additive — failure is not fatal)
  const proxyCount = replaceAll(data, SIG_HTTPS_PROXY, SIG_AG_LS_PROXY);
  const proxyVarPatched = proxyCount > 0 || countOccurrences(data, SIG_AG_LS_PROXY) > 0;

  if (eligCount > 0) {
    try { writeBinary(binPath, data); }
    catch (e) { return { ok: false, alreadyDone: false, proxyVarPatched: false, error: e.message }; }
  } else if (proxyCount > 0) {
    try { writeAtomic(binPath, data); } catch (_) {}
  }

  return { ok: true, alreadyDone, proxyVarPatched };
}

/**
 * Revert one binary to original state.
 */
function unpatchFile(binPath) {
  let data;
  try { data = Buffer.from(fs.readFileSync(binPath)); }
  catch (e) { return { ok: false, error: e.message }; }

  const c1 = replaceAll(data, SIG_INEXIGIBLE,  SIG_INELIGIBLE);
  const c2 = replaceAll(data, SIG_AG_LS_PROXY, SIG_HTTPS_PROXY);
  if (c1 === 0 && c2 === 0) return { ok: true, alreadyDone: true };

  try { writeBinary(binPath, data); }
  catch (e) { return { ok: false, error: e.message }; }
  return { ok: true, alreadyDone: false };
}

/**
 * Re-apply patch if an app auto-update reverted it.
 */
function repatchIfNeeded(binPath) {
  let data;
  try { data = Buffer.from(fs.readFileSync(binPath)); }
  catch (e) { return 'failed'; }

  const eligCount  = replaceAll(data, SIG_INELIGIBLE,  SIG_INEXIGIBLE);
  const proxyCount = replaceAll(data, SIG_HTTPS_PROXY, SIG_AG_LS_PROXY);

  if (eligCount === 0) {
    if (countOccurrences(data, SIG_INEXIGIBLE) === 0) return 'signature_missing';
    if (proxyCount > 0) { try { writeAtomic(binPath, data); } catch (_) {} }
    return 'already_patched';
  }

  try { writeBinary(binPath, data); }
  catch (e) { return 'failed'; }
  return 'repatched';
}

// ─── IDE main.js patching (from confeden/Antigravity src/patch_ide.rs) ────────

/**
 * Check if a main.js file has already been patched.
 */
function isJsPatched(content) {
  return content.includes(JS_PATCH_MARKER);
}

/**
 * Create a backup of the original file before patching.
 */
function backupOnce(filePath) {
  const bakPath = filePath + JS_BACKUP_EXT;
  if (fs.existsSync(bakPath)) return;
  try { fs.copyFileSync(filePath, bakPath); } catch (_) {}
}

/**
 * Patch IDE main.js — replace region check patterns with bypass.
 * Adapted from confeden's patch_ide.rs and antigravity-bypass-russia's patcher.rs
 *
 * Patterns targeted:
 *   - isAllowedCountry() → true
 *   - isRegionBlocked() → false
 *   - isIneligible / SET_INELIGIBLE checks
 *   - Tier restriction checks
 */
function patchIdeMainJs(jsPath) {
  let content;
  try { content = fs.readFileSync(jsPath, 'utf8'); }
  catch (e) { return { ok: false, error: e.message }; }

  if (isJsPatched(content)) {
    return { ok: true, alreadyDone: true };
  }

  // Check if this is v2.4+ architecture (auth in Language Server, no JS patch needed)
  if ((content.includes('./languageServer') || content.includes('languageServer') || content.includes('language_server') || path.basename(jsPath) === 'extension.js') &&
      !content.includes('_handleAuthErrorResponse') && !content.includes('"SET_INELIGIBLE"') && !content.includes("'SET_INELIGIBLE'") && !content.includes('ineligible_tiers')) {
    return { ok: true, alreadyDone: true, note: 'v2+ arxitektura — tekshiruv Language Server orqali' };
  }

  let modified = content;
  let changes = 0;

  // Pattern 1: isAllowedCountry() → true (from patcher.js and extensions)
  const p1 = /isAllowedCountry\s*\([^)]*\)/g;
  if (p1.test(modified)) {
    modified = modified.replace(p1, 'true');
    changes++;
  }

  // Pattern 2: isRegionBlocked() → false
  const p2 = /isRegionBlocked\s*\([^)]*\)/g;
  if (p2.test(modified)) {
    modified = modified.replace(p2, 'false');
    changes++;
  }

  // Pattern 2b: isCountryBlocked() -> false
  const p2b = /isCountryBlocked\s*\([^)]*\)/g;
  if (p2b.test(modified)) {
    modified = modified.replace(p2b, 'false');
    changes++;
  }

  // Pattern 2c: isEligibleCountry() -> true
  const p2c = /isEligibleCountry\s*\([^)]*\)/g;
  if (p2c.test(modified)) {
    modified = modified.replace(p2c, 'true');
    changes++;
  }

  // Pattern 2d: isCountryEligible() -> true
  const p2d = /isCountryEligible\s*\([^)]*\)/g;
  if (p2d.test(modified)) {
    modified = modified.replace(p2d, 'true');
    changes++;
  }

  // Pattern 2e: isGeoAllowed() -> true, isGeoBlocked() -> false
  const p2e = /isGeoAllowed\s*\([^)]*\)/g;
  if (p2e.test(modified)) {
    modified = modified.replace(p2e, 'true');
    changes++;
  }
  const p2f = /isGeoBlocked\s*\([^)]*\)/g;
  if (p2f.test(modified)) {
    modified = modified.replace(p2f, 'false');
    changes++;
  }

  // Pattern 3: Region ineligibility check — "ineligible" in tier responses
  const ineligiblePatterns = [
    { find: /\bineligible_tiers\b/g, replace: 'inexigible_tiers' },
    { find: /\bineligibleTiers\b/g,  replace: 'inexigibleTiers' },
    { find: /"SET_INELIGIBLE"/g, replace: '"SET_INEXIGIBLE"' },
    { find: /'SET_INELIGIBLE'/g, replace: "'SET_INEXIGIBLE'" },
  ];

  for (const pat of ineligiblePatterns) {
    const before = modified;
    modified = modified.replace(pat.find, pat.replace);
    if (modified !== before) changes++;
  }

  if (changes === 0) {
    // If the file doesn't have any geo-blocking signatures to begin with
    const hasAnyGeoCode = /ineligible_tiers|SET_INELIGIBLE|isAllowedCountry|isRegionBlocked|isCountryBlocked/i.test(content);
    if (!hasAnyGeoCode) {
      return { ok: true, alreadyDone: true, note: 'geo-tekshiruv yo\'q (Language Server orqali)' };
    }
    return { ok: false, error: 'JS signature topilmadi (versiya mos kelmaydi)' };
  }

  // Add marker
  modified += '\n' + JS_PATCH_MARKER + '\n';

  // Backup and write
  backupOnce(jsPath);
  try { writeAtomic(jsPath, Buffer.from(modified, 'utf8')); }
  catch (e) { return { ok: false, error: e.message }; }

  return { ok: true, alreadyDone: false, changes };
}

/**
 * Restore an IDE JS file from its backup.
 */
function restoreJsFromBackup(jsPath) {
  const bakPath = jsPath + JS_BACKUP_EXT;
  if (fs.existsSync(bakPath)) {
    try {
      fs.copyFileSync(bakPath, jsPath);
      fs.unlinkSync(bakPath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: 'Backup topilmadi' };
}

// ─── Binary target discovery (enhanced — covers IDE, CLI, extensions) ──────────

/**
 * Find all Antigravity binaries for a given install root.
 * Enhanced to find language_server, IDE, CLI, and extension binaries.
 */
function findBinaryTargets(installRoot) {
  const candidates = [];

  // If installRoot is directly a binary file
  try {
    if (fs.statSync(installRoot).isFile()) {
      return [installRoot];
    }
  } catch (_) {}

  const isWin = os.platform() === 'win32';
  const ext = isWin ? '.exe' : '';

  // CLI binaries
  candidates.push(path.join(installRoot, `agy${ext}`));
  candidates.push(path.join(installRoot, 'bin', `agy${ext}`));

  // Language Server binaries (core of Antigravity)
  candidates.push(path.join(installRoot, `language_server${ext}`));
  candidates.push(path.join(installRoot, 'bin', `language_server${ext}`));
  candidates.push(path.join(installRoot, `language_server_windows_x64${ext}`));
  candidates.push(path.join(installRoot, 'bin', `language_server_windows_x64${ext}`));
  candidates.push(path.join(installRoot, `language_server_windows_arm64${ext}`));
  candidates.push(path.join(installRoot, 'bin', `language_server_windows_arm64${ext}`));

  // IDE-bundled and extension-bundled language server
  if (isWin) {
    candidates.push(path.join(installRoot, 'resources', 'app', 'out', `language_server${ext}`));
    candidates.push(path.join(installRoot, 'resources', `language_server${ext}`));
    candidates.push(path.join(installRoot, 'resources', 'bin', `language_server${ext}`));
    candidates.push(path.join(installRoot, 'resources', 'bin', `language_server_windows_x64${ext}`));
    candidates.push(path.join(installRoot, 'resources', 'app', 'bin', `language_server${ext}`));
    candidates.push(path.join(installRoot, 'resources', 'app', 'bin', `language_server_windows_x64${ext}`));
    candidates.push(path.join(installRoot, 'resources', 'app', 'extensions', 'antigravity', 'bin', `language_server_windows_x64${ext}`));
    candidates.push(path.join(installRoot, 'resources', 'app', 'extensions', 'antigravity', 'bin', `language_server${ext}`));
    candidates.push(path.join(installRoot, 'resources', 'app', 'extensions', 'antigravity', 'bin', `language_server_windows_arm64${ext}`));
  }
  candidates.push(path.join(installRoot, 'bin', `language_server_windows_x64${ext}`));
  candidates.push(path.join(installRoot, 'dist', `language_server_windows_x64${ext}`));

  return candidates.filter(p => {
    try { return fs.statSync(p).isFile(); } catch (_) { return false; }
  });
}

/**
 * Find IDE main.js files for patching.
 */
function findIdeJsTargets(installRoot) {
  const candidates = [];

  // If installRoot itself is directly a JS file
  try {
    if (fs.statSync(installRoot).isFile() && installRoot.endsWith('.js')) {
      return [installRoot];
    }
  } catch (_) {}

  // Antigravity IDE main.js locations
  candidates.push(path.join(installRoot, 'resources', 'app', 'out', 'main.js'));
  candidates.push(path.join(installRoot, 'app', 'out', 'main.js'));
  candidates.push(path.join(installRoot, 'out', 'main.js'));
  candidates.push(path.join(installRoot, 'main.js'));

  // VS Code extension
  const vscodeExtDir = path.join(installRoot, 'resources', 'app', 'extensions', 'antigravity', 'dist');
  candidates.push(path.join(vscodeExtDir, 'extension.js'));
  candidates.push(path.join(installRoot, 'dist', 'extension.js'));

  return candidates.filter(p => {
    try { return fs.statSync(p).isFile(); } catch (_) { return false; }
  });
}

/**
 * Well-known Antigravity install locations on this system.
 * Enhanced to find IDE, CLI, VS Code extensions, Cursor, Windsurf.
 */
function discoverInstalls() {
  const roots = [];
  const local = process.env.LOCALAPPDATA;
  const home  = os.homedir();
  const prog  = process.env.PROGRAMFILES || 'C:\\Program Files';
  const prog86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const appdata = process.env.APPDATA;

  // Standard bases
  const bases = [
    local,
    home ? path.join(home, 'AppData', 'Local') : null,
    home,
    prog,
    prog86,
    appdata
  ].filter(Boolean);

  // CLI locations
  for (const base of bases) {
    for (const name of ['agy', 'Antigravity']) {
      const p = path.join(base, name);
      try { if (fs.statSync(p).isDirectory()) roots.push(p); } catch (_) {}
    }
  }

  // Antigravity IDE locations
  const ideNames = [
    'Antigravity IDE',
    'Antigravity',
    'Antigravity 2.0',
    'Google Antigravity'
  ];

  const programBases = [
    local ? path.join(local, 'Programs') : null,
    home ? path.join(home, 'AppData', 'Local', 'Programs') : null,
    prog,
    prog86
  ].filter(Boolean);

  for (const base of programBases) {
    for (const name of ideNames) {
      const p = path.join(base, name);
      try { if (fs.statSync(p).isDirectory()) roots.push(p); } catch (_) {}
    }
  }

  // Scan all user profiles on Windows C:\Users
  if (os.platform() === 'win32' || fs.existsSync('C:\\Users')) {
    try {
      const usersDir = 'C:\\Users';
      if (fs.existsSync(usersDir)) {
        const users = fs.readdirSync(usersDir);
        for (const u of users) {
          const userLocalProg = path.join(usersDir, u, 'AppData', 'Local', 'Programs');
          for (const name of ideNames) {
            const p = path.join(userLocalProg, name);
            try { if (fs.statSync(p).isDirectory()) roots.push(p); } catch (_) {}
          }
          const userAgy = path.join(usersDir, u, 'AppData', 'Local', 'agy');
          try { if (fs.statSync(userAgy).isDirectory()) roots.push(userAgy); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // VS Code extensions — Antigravity extension in various editors
  const editorExtDirs = [];
  if (home) {
    editorExtDirs.push(path.join(home, '.vscode', 'extensions'));
    editorExtDirs.push(path.join(home, '.vscode-insiders', 'extensions'));
    editorExtDirs.push(path.join(home, '.cursor', 'extensions'));
    editorExtDirs.push(path.join(home, '.windsurf', 'extensions'));
    editorExtDirs.push(path.join(home, '.vscodium', 'extensions'));
  }

  for (const extDir of editorExtDirs) {
    try {
      if (!fs.statSync(extDir).isDirectory()) continue;
      const entries = fs.readdirSync(extDir);
      for (const entry of entries) {
        if (entry.toLowerCase().includes('antigravity') || entry.toLowerCase().includes('google.cloudcode')) {
          const extPath = path.join(extDir, entry);
          try { if (fs.statSync(extPath).isDirectory()) roots.push(extPath); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // Also query PATH for agy.exe
  try {
    const cmd = os.platform() === 'win32' ? 'where agy.exe' : 'which agy';
    const out = require('child_process').execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    for (const line of out.trim().split('\n')) {
      const p = line.trim();
      if (p && fs.existsSync(p)) {
        roots.push(p);
        roots.push(path.dirname(p));
        roots.push(path.dirname(path.dirname(p)));
      }
    }
  } catch (_) {}

  // Deduplicate
  return Array.from(new Set(roots.filter(r => fs.existsSync(r))));
}

/**
 * Collect and deduplicate all unique binary targets across all install roots.
 */
function getAllBinaryTargets() {
  const installs = discoverInstalls();
  const set = new Set();
  for (const root of installs) {
    for (const bin of findBinaryTargets(root)) {
      try { set.add(path.resolve(bin)); } catch (_) { set.add(bin); }
    }
  }
  return Array.from(set);
}

/**
 * Collect all IDE JS targets across all install roots.
 */
function getAllJsTargets() {
  const installs = discoverInstalls();
  const set = new Set();
  for (const root of installs) {
    for (const js of findIdeJsTargets(root)) {
      try { set.add(path.resolve(js)); } catch (_) { set.add(js); }
    }
  }
  return Array.from(set);
}

/**
 * Patch everything: binaries + IDE JS files.
 * @returns {{ ok: number, failed: number, proxyVar: number, jsPatched: number, jsFailed: number, errors: string[], details: string[] }}
 */
function patchAllInstalls(options = {}) {
  const summary = { ok: 0, failed: 0, proxyVar: 0, jsPatched: 0, jsFailed: 0, errors: [], details: [] };

  // 1. Binary patches (EXE files)
  const targets = getAllBinaryTargets();
  for (const bin of targets) {
    const label  = path.basename(bin);
    const result = patchFile(bin, options);
    if (result.ok) {
      summary.ok++;
      if (result.proxyVarPatched) summary.proxyVar++;
      if (result.alreadyDone) {
        summary.details.push(`✓ ${label} — allaqachon patch qilingan`);
      } else {
        summary.details.push(`✓ ${label} — muvaffaqiyatli patch qilindi`);
      }
    } else {
      summary.failed++;
      summary.errors.push(`${label}: ${result.error}`);
    }
  }

  // 2. IDE JS patches
  const jsTargets = getAllJsTargets();
  for (const js of jsTargets) {
    const label  = path.basename(js);
    const result = patchIdeMainJs(js);
    if (result.ok) {
      summary.jsPatched++;
      if (result.alreadyDone) {
        summary.details.push(`✓ ${label} — ${result.note || 'allaqachon patch qilingan'}`);
      } else {
        summary.details.push(`✓ ${label} — ${result.changes || 0} ta o'zgarish kiritildi`);
      }
    } else {
      summary.jsFailed++;
      summary.errors.push(`${label}: ${result.error}`);
    }
  }

  return summary;
}

// ─── Helpers: Format, Version & State ──────────────────────────────────────────

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + ' MB';
  const kb = bytes / 1024;
  return kb.toFixed(1) + ' KB';
}

function getExeVersion(exePath) {
  if (!exePath || !fs.existsSync(exePath)) return null;
  try {
    const { execFileSync } = require('child_process');
    const cmd = '(Get-Item \x27' + exePath + '\x27).VersionInfo.FileVersion';
    const out = execFileSync('powershell', ['-NoProfile', '-Command', cmd], {
      encoding: 'utf8',
      timeout: 2000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const trimmed = out.trim();
    if (trimmed) return trimmed;
  } catch (_) {}
  return null;
}

function getCliVersion(binPath) {
  if (!binPath || !fs.existsSync(binPath)) return null;
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync(binPath, ['--version'], {
      encoding: 'utf8',
      timeout: 1500,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const trimmed = out.trim();
    if (trimmed) return trimmed.replace(/^agy\s*/i, '').trim();
  } catch (_) {}
  return null;
}

function isBinaryPatched(binPath) {
  if (!binPath || !fs.existsSync(binPath)) return false;
  const insp = inspectFile(binPath);
  return insp.eligibility === PatchState.PATCHED;
}

/**
 * Kompyuterdagi barcha Antigravity o'rnatilmalarini to'liq aniqlash
 * (IDE, Antigravity 2.0, CLI, Gemini AGY va VS Code kengaytmalari)
 */
function detectInstallations() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const prog = process.env.PROGRAMFILES || 'C:\\Program Files';
  const prog86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const home = os.homedir();

  const defs = [
    {
      id: 'ide',
      name: 'ANTIGRAVITY IDE',
      checkDirs: [
        path.join(local, 'Programs', 'Antigravity IDE'),
        path.join(prog, 'Antigravity IDE'),
        path.join(prog86, 'Antigravity IDE'),
      ],
      targetRel: path.join('resources', 'app', 'out', 'main.js'),
      exeRel: 'Antigravity IDE.exe',
      extraBinRel: path.join('resources', 'app', 'extensions', 'antigravity', 'bin', 'language_server_windows_x64.exe'),
      pkgRel: path.join('resources', 'app', 'package.json'),
      type: 'ide'
    },
    {
      id: 'antigravity2',
      name: 'ANTIGRAVITY 2.0',
      checkDirs: [
        path.join(local, 'Programs', 'antigravity'),
        path.join(local, 'Programs', 'Antigravity'),
        path.join(prog, 'antigravity'),
        path.join(prog, 'Antigravity'),
      ],
      targetRel: path.join('resources', 'bin', 'language_server.exe'),
      exeRel: 'Antigravity.exe',
      pkgRel: path.join('resources', 'app', 'package.json'),
      type: 'bin'
    },
    {
      id: 'cli',
      name: 'ANTIGRAVITY CLI',
      target: path.join(local, 'agy', 'bin', 'agy.exe'),
      type: 'cli'
    },
    {
      id: 'gemini_bin',
      name: 'AGY BIN (.gemini)',
      target: path.join(home, '.gemini', 'bin', 'agy.exe'),
      type: 'cli'
    },
    {
      id: 'vscode_ext',
      name: 'ANTIGRAVITY VS CODE EXTENSION',
      type: 'extension'
    }
  ];

  const results = [];

  for (const d of defs) {
    if (d.id === 'ide' || d.id === 'antigravity2') {
      let foundDir = null;
      for (const c of d.checkDirs) {
        if (fs.existsSync(c)) { foundDir = c; break; }
      }
      if (foundDir) {
        const targetPath = path.join(foundDir, d.targetRel);
        const exePath = d.exeRel ? path.join(foundDir, d.exeRel) : null;
        const extraBin = d.extraBinRel ? path.join(foundDir, d.extraBinRel) : null;
        const hasTarget = fs.existsSync(targetPath);
        let size = null;
        if (hasTarget) {
          try { size = formatSize(fs.statSync(targetPath).size); } catch (_) {}
        }
        let ver = getExeVersion(exePath);
        if (!ver && d.pkgRel) {
          const pkgP = path.join(foundDir, d.pkgRel);
          if (fs.existsSync(pkgP)) {
            try { ver = JSON.parse(fs.readFileSync(pkgP, 'utf8')).version; } catch (_) {}
          }
        }

        let patchStatus = 'not patched';
        if (hasTarget) {
          if (d.type === 'ide') {
            try {
              const content = fs.readFileSync(targetPath, 'utf8');
              patchStatus = isJsPatched(content) ? 'already patched' : 'not patched';
            } catch (_) {}
          } else {
            const st = inspectFile(targetPath);
            patchStatus = st.eligibility === PatchState.PATCHED ? 'already patched' : 'not patched';
          }
        }

        results.push({
          id: d.id,
          name: d.name,
          target: hasTarget ? targetPath : 'Not found',
          extraTargets: extraBin && fs.existsSync(extraBin) ? [extraBin] : [],
          status: hasTarget ? 'found' : 'not found',
          patch: patchStatus,
          version: ver || 'N/A',
          size: size || 'N/A',
          type: d.type
        });
      } else {
        results.push({
          id: d.id,
          name: d.name,
          target: 'Not found',
          extraTargets: [],
          status: 'not found',
          patch: 'not found',
          version: 'N/A',
          size: 'N/A',
          type: d.type
        });
      }
    } else if (d.type === 'cli') {
      if (fs.existsSync(d.target)) {
        let size = null;
        try { size = formatSize(fs.statSync(d.target).size); } catch (_) {}
        const isP = isBinaryPatched(d.target);
        const ver = getCliVersion(d.target);
        results.push({
          id: d.id,
          name: d.name,
          target: d.target,
          extraTargets: [],
          status: 'found',
          patch: isP ? 'already patched' : 'not patched',
          version: ver || 'N/A',
          size: size || 'N/A',
          type: 'bin'
        });
      } else {
        results.push({
          id: d.id,
          name: d.name,
          target: 'Not found',
          extraTargets: [],
          status: 'not found',
          patch: 'not found',
          version: 'N/A',
          size: 'N/A',
          type: 'bin'
        });
      }
    } else if (d.id === 'vscode_ext') {
      let extFound = null;
      const extDirs = [
        path.join(home, '.vscode', 'extensions'),
        path.join(home, '.vscode-insiders', 'extensions'),
        path.join(home, '.cursor', 'extensions'),
        path.join(home, '.windsurf', 'extensions')
      ];
      for (const ed of extDirs) {
        if (fs.existsSync(ed)) {
          try {
            const dirs = fs.readdirSync(ed);
            for (const item of dirs) {
              if (/antigravity/i.test(item) && !/python/i.test(item)) {
                extFound = path.join(ed, item);
                break;
              }
            }
          } catch (_) {}
        }
        if (extFound) break;
      }

      if (extFound) {
        results.push({
          id: d.id,
          name: d.name,
          target: extFound,
          extraTargets: [],
          status: 'found',
          patch: 'ready',
          version: 'N/A',
          size: 'N/A',
          type: 'extension'
        });
      } else {
        results.push({
          id: d.id,
          name: d.name,
          target: 'Not found',
          extraTargets: [],
          status: 'not found',
          patch: 'not found',
          version: 'N/A',
          size: 'N/A',
          type: 'extension'
        });
      }
    }
  }

  // Scan all binary/JS targets across system and add any uncataloged ones
  const catalogedTargets = new Set();
  for (const r of results) {
    if (r.target && r.target !== 'Not found') catalogedTargets.add(path.resolve(r.target).toLowerCase());
    if (Array.isArray(r.extraTargets)) {
      for (const et of r.extraTargets) catalogedTargets.add(path.resolve(et).toLowerCase());
    }
  }

  const allBins = getAllBinaryTargets();
  for (const b of allBins) {
    const resolved = path.resolve(b).toLowerCase();
    if (!catalogedTargets.has(resolved)) {
      catalogedTargets.add(resolved);
      let size = null;
      try { size = formatSize(fs.statSync(b).size); } catch (_) {}
      const isP = isBinaryPatched(b);
      results.push({
        id: `extra_bin_${path.basename(b)}`,
        name: `ANTIGRAVITY (${path.basename(b)})`,
        target: b,
        extraTargets: [],
        status: 'found',
        patch: isP ? 'already patched' : 'not patched',
        version: getCliVersion(b) || 'N/A',
        size: size || 'N/A',
        type: 'bin'
      });
    }
  }

  return results;
}

/**
 * Bitta aniq o'rnatilmani patch qilish
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
    result.errors.push('O\'rnatilma kompyuterda topilmadi');
    return result;
  }

  if (item.type === 'ide') {
    if (fs.existsSync(item.target)) {
      const jsRes = patchIdeMainJs(item.target);
      if (jsRes.ok) {
        result.success = true;
        result.alreadyDone = jsRes.alreadyDone;
        if (jsRes.alreadyDone) {
          result.details.push(`main.js — allaqachon patch qilingan`);
        } else {
          result.details.push(`main.js — muvaffaqiyatli patch qilindi`);
        }
      } else {
        result.errors.push(`main.js: ${jsRes.error}`);
      }
    }
    if (Array.isArray(item.extraTargets)) {
      for (const eb of item.extraTargets) {
        if (fs.existsSync(eb)) {
          if (eb.endsWith('.js')) {
            const r = patchIdeMainJs(eb);
            if (r.ok) result.details.push(`${path.basename(eb)} — ${r.alreadyDone ? 'allaqachon patch qilingan' : 'patch qilindi'}`);
          } else {
            const r = patchFile(eb, options);
            if (r.ok) {
              result.details.push(`${path.basename(eb)} — ${r.alreadyDone ? 'allaqachon patch qilingan' : 'patch qilindi'}`);
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
        if (bRes.alreadyDone) {
          result.details.push(`${path.basename(item.target)} — allaqachon patch qilingan`);
        } else {
          result.details.push(`${path.basename(item.target)} — muvaffaqiyatli patch qilindi`);
        }
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
          result.details.push(`${path.basename(j)} — ${r.alreadyDone ? 'allaqachon patch qilingan' : 'patch qilindi'}`);
        }
      }
      const binFiles = findBinaryTargets(item.target);
      for (const b of binFiles) {
        const r = patchFile(b, options);
        if (r.ok) {
          result.success = true;
          result.details.push(`${path.basename(b)} — ${r.alreadyDone ? 'allaqachon patch qilingan' : 'patch qilindi'}`);
        }
      }
    }
  }

  return result;
}

/**
 * Bitta aniq o'rnatilmani asliga qaytarish (unpatch)
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
    result.errors.push('O\'rnatilma kompyuterda topilmadi');
    return result;
  }

  if (item.type === 'ide') {
    if (fs.existsSync(item.target)) {
      const r = restoreJsFromBackup(item.target);
      if (r.ok) {
        result.success = true;
        result.details.push(`main.js — asl nusxadan tiklandi`);
      } else {
        result.details.push(`main.js — ${r.error || 'asl holatda'}`);
      }
    }
    if (Array.isArray(item.extraTargets)) {
      for (const eb of item.extraTargets) {
        if (fs.existsSync(eb)) {
          if (eb.endsWith('.js')) {
            restoreJsFromBackup(eb);
          } else {
            const r = unpatchFile(eb);
            if (r.ok) result.details.push(`${path.basename(eb)} — ${r.alreadyDone ? 'asl holatda' : 'asliga qaytarildi'}`);
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
        result.details.push(`${path.basename(item.target)} — ${r.alreadyDone ? 'asl holatda' : 'asliga qaytarildi'}`);
      } else {
        result.errors.push(r.error);
      }
    }
  }

  return result;
}

// ─── Kill affected processes before patching ───────────────────────────────────
function killAffectedProcesses() {
  if (os.platform() !== 'win32') return;
  const procs = ['agy.exe'];
  const { execSync } = require('child_process');
  for (const p of procs) {
    try {
      execSync(`taskkill /F /IM "${p}"`, { stdio: 'ignore', windowsHide: true });
    } catch (_) {}
  }
}

module.exports = {
  PROXY_VAR_NAME,
  PatchState,
  JS_PATCH_MARKER,
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
  getExeVersion,
  getCliVersion,
  detectInstallations,
  patchInstallation,
  unpatchInstallation,
};
