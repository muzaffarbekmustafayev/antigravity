#!/usr/bin/env node
/**
 * build-exe.js — Antigravity Bypass vositasini YOLG'IZ BITTA mustaqil .EXE faylga aylantirish
 *
 * Ishga tushirish:
 *   npm run build:exe
 *   yoki: node build-exe.js
 *
 * Natijada dist/ papkasida FAQATGINA BITTA `antigravity-bypass.exe` hosil bo'ladi.
 * Hech qanday boshqa fayl, skript yoki papka kerak bo'lmaydi.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('');
console.log('====================================================');
console.log(' 🚀  Antigravity Bypass — Standalone Single .EXE    ');
console.log('====================================================');
console.log('');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const OUTPUT_EXE = path.join(DIST_DIR, 'antigravity-bypass.exe');

// 1. Terminate any running instances of the executable to avoid Windows EPERM file locks
if (process.platform === 'win32') {
  try {
    const { execFileSync } = require('child_process');
    try {
      execFileSync('taskkill.exe', ['/F', '/IM', 'antigravity-bypass.exe'], { stdio: 'ignore', windowsHide: true });
    } catch (_) {}
    try {
      execFileSync('wmic.exe', ['process', 'where', "name='antigravity-bypass.exe'", 'call', 'terminate'], { stdio: 'ignore', windowsHide: true });
    } catch (_) {}
  } catch (_) {}
}

// 2. Prepare dist directory and clean old files
if (fs.existsSync(DIST_DIR)) {
  try {
    const files = fs.readdirSync(DIST_DIR);
    for (const f of files) {
      const p = path.join(DIST_DIR, f);
      try { fs.unlinkSync(p); } catch (_) {}
    }
  } catch (_) {}
} else {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// 2. Resolve pkg entrypoint directly to avoid shell: true security deprecation warning [DEP0190]
const localPkgScript = path.join(ROOT_DIR, 'node_modules', 'pkg', 'lib-es5', 'bin.js');
const localPkgBin = path.join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'pkg.cmd' : 'pkg'
);

let runCmd = process.execPath;
let runArgs = [];

if (fs.existsSync(localPkgScript)) {
  runCmd = process.execPath;
  runArgs = [localPkgScript];
} else if (fs.existsSync(localPkgBin)) {
  runCmd = localPkgBin;
  runArgs = [];
} else {
  runCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  runArgs = ['pkg'];
}

const buildArgs = [
  ...runArgs,
  'cli.js',
  '--targets', 'node18-win-x64',
  '--output', OUTPUT_EXE,
  '--public',
];

console.log('[1/2] Packaging all modules into a standalone .EXE...');
console.log(`      Command: ${path.basename(runCmd)} ${buildArgs.join(' ')}\n`);

const result = spawnSync(runCmd, buildArgs, {
  stdio: 'inherit',
  shell: false,
  cwd: ROOT_DIR,
});

if (result.status !== 0) {
  console.error('\n❌ Error occurred while creating .EXE!');
  console.error('Please verify that `npm install` has been completed.');
  process.exit(result.status || 1);
}

let sizeMb = 'Unknown';
if (fs.existsSync(OUTPUT_EXE)) {
  const stat = fs.statSync(OUTPUT_EXE);
  sizeMb = (stat.size / (1024 * 1024)).toFixed(1) + ' MB';
}

console.log('\n====================================================');
console.log(' ✅ STANDALONE SINGLE .EXE CREATED SUCCESSFULLY!');
console.log('====================================================');
console.log(` • Output: dist/antigravity-bypass.exe`);
console.log(` • Size:   ${sizeMb}`);
console.log('');
console.log('💡 All features (DNS, NRPT, Hosts, Patch, UI)');
console.log('   are fully bundled inside this single executable.');
console.log('   You can share `antigravity-bypass.exe` directly');
console.log('   without requiring Node.js on the target machine!');
console.log('====================================================\n');
