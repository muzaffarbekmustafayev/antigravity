/**
 * detector.js — Tizimdagi barcha Antigravity o'rnatilmalarini avtomatik qidirish va tahlil qilish
 * In-memory TTL kesh bilan optimallashtirilgan.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFileSync } = require('child_process');
const { PatchState } = require('./constants');
const { inspectFile, isBinaryPatched } = require('./binary');
const { isJsPatched } = require('./ide');
const Logger = require('../../logger');

const _versionCache = new Map();

let _discoveryCache = {
  roots: null,
  timestamp: 0,
};

let _detectInstallationsCache = {
  results: null,
  timestamp: 0,
};

const DISCOVERY_CACHE_TTL_MS = 25000; // 25 soniya kesh

function invalidateDetectionCache() {
  _discoveryCache.roots = null;
  _discoveryCache.timestamp = 0;
  _detectInstallationsCache.results = null;
  _detectInstallationsCache.timestamp = 0;
  Logger.debug('O\'rnatilmalar keshi tozalandi.');
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + ' MB';
  const kb = bytes / 1024;
  return kb.toFixed(1) + ' KB';
}

function getFastVersion(targetPath, pkgPath = null) {
  if (pkgPath && fs.existsSync(pkgPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (data && data.version) return data.version;
    } catch (_) {}
  }

  if (!targetPath || !fs.existsSync(targetPath)) return null;

  let stat;
  try { stat = fs.statSync(targetPath); } catch (_) { return null; }
  const cacheKey = `${targetPath}_${stat.mtimeMs}_${stat.size}`;
  if (_versionCache.has(cacheKey)) {
    return _versionCache.get(cacheKey);
  }

  let version = null;
  if (targetPath.endsWith('agy.exe')) {
    try {
      const out = execFileSync(targetPath, ['--version'], {
        encoding: 'utf8',
        timeout: 1000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const trimmed = out.trim();
      if (trimmed) version = trimmed.replace(/^agy\s*/i, '').trim();
    } catch (_) {}
  }

  _versionCache.set(cacheKey, version);
  return version;
}

function findBinaryTargets(installRoot) {
  const targets = new Set();
  try {
    if (fs.statSync(installRoot).isFile()) {
      return [installRoot];
    }
  } catch (_) {
    return [];
  }

  const isWin = os.platform() === 'win32';
  const ext = isWin ? '.exe' : '';

  const staticCandidates = [
    path.join(installRoot, `agy${ext}`),
    path.join(installRoot, 'bin', `agy${ext}`),
    path.join(installRoot, `language_server${ext}`),
    path.join(installRoot, 'bin', `language_server${ext}`),
    path.join(installRoot, `language_server_windows_x64${ext}`),
    path.join(installRoot, 'bin', `language_server_windows_x64${ext}`),
    path.join(installRoot, `language_server_windows_arm64${ext}`),
    path.join(installRoot, 'bin', `language_server_windows_arm64${ext}`),
    path.join(installRoot, 'resources', 'bin', `language_server${ext}`),
    path.join(installRoot, 'resources', 'bin', `language_server_windows_x64${ext}`),
    path.join(installRoot, 'resources', 'app', 'bin', `language_server${ext}`),
    path.join(installRoot, 'resources', 'app', 'bin', `language_server_windows_x64${ext}`),
    path.join(installRoot, 'resources', 'app', 'extensions', 'antigravity', 'bin', `language_server_windows_x64${ext}`),
    path.join(installRoot, 'resources', 'app', 'extensions', 'antigravity', 'bin', `language_server${ext}`),
    path.join(installRoot, 'resources', 'app', 'extensions', 'antigravity', 'bin', `language_server_windows_arm64${ext}`),
    path.join(installRoot, 'resources', 'app.asar.unpacked', 'extensions', 'antigravity', 'bin', `language_server_windows_x64${ext}`),
    path.join(installRoot, 'resources', 'app.asar.unpacked', 'extensions', 'antigravity', 'bin', `language_server${ext}`),
    path.join(installRoot, 'resources', 'app.asar.unpacked', 'bin', `language_server_windows_x64${ext}`),
    path.join(installRoot, 'resources', 'app.asar.unpacked', 'bin', `language_server${ext}`),
    path.join(installRoot, 'resources', 'app.asar.unpacked', 'out', `language_server_windows_x64${ext}`),
    path.join(installRoot, 'dist', `language_server_windows_x64${ext}`),
  ];

  for (const c of staticCandidates) {
    try {
      if (fs.statSync(c).isFile()) targets.add(path.resolve(c));
    } catch (_) {}
  }

  // Chuqur rekursiv skanerlash (barcha language_server*.exe larni aniqlash)
  function deepScan(dir, depth = 0) {
    if (depth > 6) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          const lower = item.name.toLowerCase();
          if (lower !== 'node_modules' && lower !== '.git' && lower !== 'locales') {
            deepScan(full, depth + 1);
          }
        } else if (item.isFile()) {
          const lower = item.name.toLowerCase();
          if (lower.startsWith('language_server') || lower === 'agy.exe' || lower === 'agy') {
            if (!lower.endsWith('.js') && !lower.endsWith('.json') && !lower.endsWith('.ag_backup') && !lower.endsWith('.ag_meta.json')) {
              targets.add(path.resolve(full));
            }
          }
        }
      }
    } catch (_) {}
  }

  deepScan(installRoot);
  return Array.from(targets);
}

function findIdeJsTargets(installRoot) {
  const candidates = [];
  try {
    if (fs.statSync(installRoot).isFile() && installRoot.endsWith('.js')) {
      return [installRoot];
    }
  } catch (_) {}

  candidates.push(path.join(installRoot, 'resources', 'app', 'out', 'main.js'));
  candidates.push(path.join(installRoot, 'app', 'out', 'main.js'));
  candidates.push(path.join(installRoot, 'out', 'main.js'));
  candidates.push(path.join(installRoot, 'main.js'));

  const vscodeExtDir = path.join(installRoot, 'resources', 'app', 'extensions', 'antigravity', 'dist');
  candidates.push(path.join(vscodeExtDir, 'extension.js'));
  candidates.push(path.join(installRoot, 'dist', 'extension.js'));

  return candidates.filter(p => {
    try { return fs.statSync(p).isFile(); } catch (_) { return false; }
  });
}

function discoverInstalls(force = false) {
  const now = Date.now();
  if (!force && _discoveryCache.roots && (now - _discoveryCache.timestamp < DISCOVERY_CACHE_TTL_MS)) {
    return _discoveryCache.roots;
  }

  const roots = [];
  const local = process.env.LOCALAPPDATA;
  const home  = os.homedir();
  const prog  = process.env.PROGRAMFILES || 'C:\\Program Files';
  const prog86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const appdata = process.env.APPDATA;

  const bases = [
    local,
    home ? path.join(home, 'AppData', 'Local') : null,
    home,
    prog,
    prog86,
    appdata
  ].filter(Boolean);

  for (const base of bases) {
    for (const name of ['agy', 'Antigravity']) {
      const p = path.join(base, name);
      try { if (fs.statSync(p).isDirectory()) roots.push(p); } catch (_) {}
    }
  }

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

  try {
    const isWin = os.platform() === 'win32';
    const out = isWin
      ? execFileSync('where.exe', ['agy.exe'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
      : execFileSync('which', ['agy'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

    for (const line of out.trim().split('\n')) {
      const p = line.trim();
      if (p && fs.existsSync(p)) {
        roots.push(p);
        roots.push(path.dirname(p));
        roots.push(path.dirname(path.dirname(p)));
      }
    }
  } catch (_) {}

  const uniqueRoots = Array.from(new Set(roots.filter(r => fs.existsSync(r))));
  _discoveryCache = { roots: uniqueRoots, timestamp: now };
  return uniqueRoots;
}

function getAllBinaryTargets(force = false) {
  const installs = discoverInstalls(force);
  const set = new Set();
  for (const root of installs) {
    for (const bin of findBinaryTargets(root)) {
      try { set.add(path.resolve(bin)); } catch (_) { set.add(bin); }
    }
  }
  return Array.from(set);
}

function getAllJsTargets(force = false) {
  const installs = discoverInstalls(force);
  const set = new Set();
  for (const root of installs) {
    for (const js of findIdeJsTargets(root)) {
      try { set.add(path.resolve(js)); } catch (_) { set.add(js); }
    }
  }
  return Array.from(set);
}

function detectInstallations(force = false) {
  const now = Date.now();
  if (!force && _detectInstallationsCache.results && (now - _detectInstallationsCache.timestamp < DISCOVERY_CACHE_TTL_MS)) {
    return _detectInstallationsCache.results;
  }

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
        const extraBins = findBinaryTargets(foundDir);
        const hasTarget = fs.existsSync(targetPath);
        let size = null;
        if (hasTarget) {
          try { size = formatSize(fs.statSync(targetPath).size); } catch (_) {}
        } else if (extraBins.length > 0) {
          try { size = formatSize(fs.statSync(extraBins[0]).size); } catch (_) {}
        }

        const pkgPath = d.pkgRel ? path.join(foundDir, d.pkgRel) : null;
        const ver = getFastVersion(targetPath, pkgPath);

        let patchStatus = 'not patched';
        if (hasTarget) {
          if (d.type === 'ide') {
            try {
              const content = fs.readFileSync(targetPath, 'utf8');
              const jsDone = isJsPatched(content);
              const binsDone = extraBins.length === 0 || extraBins.every(b => isBinaryPatched(b));
              patchStatus = (jsDone && binsDone) ? 'already patched' : 'not patched';
            } catch (_) {}
          } else {
            const st = inspectFile(targetPath);
            patchStatus = st.eligibility === PatchState.PATCHED ? 'already patched' : 'not patched';
          }
        } else if (extraBins.length > 0) {
          const binsDone = extraBins.every(b => isBinaryPatched(b));
          patchStatus = binsDone ? 'already patched' : 'not patched';
        }

        results.push({
          id: d.id,
          name: d.name,
          target: hasTarget ? targetPath : (extraBins.length > 0 ? extraBins[0] : 'Not found'),
          extraTargets: extraBins,
          status: (hasTarget || extraBins.length > 0) ? 'found' : 'not found',
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
        const ver = getFastVersion(d.target);
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
      const extDirs = [
        { editor: 'VS CODE', dir: path.join(home, '.vscode', 'extensions') },
        { editor: 'VS CODE INSIDERS', dir: path.join(home, '.vscode-insiders', 'extensions') },
        { editor: 'CURSOR', dir: path.join(home, '.cursor', 'extensions') },
        { editor: 'WINDSURF', dir: path.join(home, '.windsurf', 'extensions') },
        { editor: 'VSCODIUM', dir: path.join(home, '.vscodium', 'extensions') },
      ];

      const foundExtensions = [];
      for (const { editor, dir } of extDirs) {
        if (fs.existsSync(dir)) {
          try {
            const dirs = fs.readdirSync(dir);
            for (const item of dirs) {
              if (/antigravity/i.test(item) && !/python/i.test(item)) {
                foundExtensions.push({ editor, extPath: path.join(dir, item) });
              }
            }
          } catch (_) {}
        }
      }

      if (foundExtensions.length > 0) {
        for (const ext of foundExtensions) {
          const jsFiles = findIdeJsTargets(ext.extPath);
          const binFiles = findBinaryTargets(ext.extPath);

          let isPatched = false;
          for (const j of jsFiles) {
            try {
              const content = fs.readFileSync(j, 'utf8');
              if (isJsPatched(content)) { isPatched = true; break; }
            } catch (_) {}
          }
          if (!isPatched) {
            for (const b of binFiles) {
              if (isBinaryPatched(b)) { isPatched = true; break; }
            }
          }

          const pkgJson = path.join(ext.extPath, 'package.json');
          const ver = getFastVersion(null, pkgJson);

          results.push({
            id: `ext_${ext.editor.toLowerCase().replace(/\s+/g, '_')}`,
            name: `ANTIGRAVITY ${ext.editor} EXTENSION`,
            target: ext.extPath,
            extraTargets: [...jsFiles, ...binFiles],
            status: 'found',
            patch: isPatched ? 'already patched' : 'not patched',
            version: ver || 'N/A',
            size: 'N/A',
            type: 'extension'
          });
        }
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

  const catalogedTargets = new Set();
  for (const r of results) {
    if (r.target && r.target !== 'Not found') catalogedTargets.add(path.resolve(r.target).toLowerCase());
    if (Array.isArray(r.extraTargets)) {
      for (const et of r.extraTargets) catalogedTargets.add(path.resolve(et).toLowerCase());
    }
  }

  const allBins = getAllBinaryTargets(force);
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
        version: getFastVersion(b) || 'N/A',
        size: size || 'N/A',
        type: 'bin'
      });
    }
  }

  _detectInstallationsCache = { results, timestamp: now };
  return results;
}

module.exports = {
  formatSize,
  getFastVersion,
  findBinaryTargets,
  findIdeJsTargets,
  discoverInstalls,
  getAllBinaryTargets,
  getAllJsTargets,
  detectInstallations,
  invalidateDetectionCache,
};
