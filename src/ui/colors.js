/**
 * colors.js — Terminal formatlash, ANSI ranglar, banner va UAC admin boshqaruvi
 */

'use strict';

const os = require('os');
const { execSync } = require('child_process');

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  white:   '\x1b[97m',
};

const W = Math.min(process.stdout.columns || 64, 76);
const LINE = C.dim + '─'.repeat(W) + C.reset;
const DLINE = C.dim + '═'.repeat(W) + C.reset;

function cls() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[H\x1b[J');
  } else {
    console.log('\n--- ANTIGRAVITY BYPASS ---\n');
  }
}

function center(str) {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad   = Math.max(0, Math.floor((W - plain.length) / 2));
  return ' '.repeat(pad) + str;
}

function ok(msg)   { return `  ${C.green}✓${C.reset}  ${msg}`; }
function err(msg)  { return `  ${C.red}✗${C.reset}  ${msg}`; }
function info(msg) { return `  ${C.cyan}ℹ${C.reset}  ${msg}`; }
function warn(msg) { return `  ${C.yellow}⚠${C.reset}  ${msg}`; }

/**
 * Windows-da Administrator huquqi bilan ishga tushganligini tekshirish
 */
function isWindowsAdmin() {
  if (os.platform() !== 'win32') return true;
  try {
    execSync('net session', { stdio: 'ignore', windowsHide: true });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Standalone .exe da foydalanuvchi oddiy bosganda ham avtomatik UAC so'rash
 */
function ensureAdminElevation() {
  if (os.platform() !== 'win32') return true;
  if (isWindowsAdmin()) return true;

  const isPkg = typeof process.pkg !== 'undefined';

  // Standalone .exe (double-click) auto-request UAC elevation
  if (isPkg) {
    console.log('\n' + center(`${C.bold}${C.yellow}🔒 Administrator privileges required...${C.reset}`));
    console.log(center(`${C.dim}Please click "Yes" in the User Account Control (UAC) prompt...${C.reset}\n`));

    try {
      const targetFile = process.execPath;
      const args = process.argv.slice(1);
      const argList = args.length ? `@(${args.map(a => `"${a.replace(/"/g, '`"')}"`).join(',')})` : '@()';
      const script = `Start-Process -FilePath "${targetFile.replace(/"/g, '`"')}" -ArgumentList ${argList} -Verb RunAs`;

      const encoded = Buffer.from(`[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ${script}`, 'utf16le').toString('base64');
      const { execFileSync } = require('child_process');
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
        windowsHide: true,
        stdio: 'ignore',
      });

      process.exit(0);
    } catch (_) {
      console.log(`  ${C.yellow}⚠ Administrator privileges were not granted. Running in limited mode.${C.reset}\n`);
      return false;
    }
  }

  // Developer mode (node cli.js): inform the user without terminating
  console.log(`\n  ${C.yellow}⚠ NOTICE: Program is running without Administrator privileges.${C.reset}`);
  console.log(`  ${C.dim}To apply DNS NRPT rules properly, please launch terminal with ${C.bold}"Run as administrator"${C.reset}${C.dim}.${C.reset}\n`);
  return false;
}

function exitGracefully(code = 0) {
  const hasArgs = process.argv.slice(2).length > 0;
  if (typeof process.pkg !== 'undefined' && !hasArgs && process.stdout.isTTY) {
    console.log(`\n  ${C.dim}Press Enter to close the program...${C.reset}`);
    try {
      execSync('pause', { stdio: 'inherit' });
    } catch (_) {}
  }
  process.exit(code);
}

function drawBanner(netInfo) {
  console.log('');
  console.log(center(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║         🚀  ANTIGRAVITY BYPASS & UNLOCKER  🚀            ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║        Complete Regional Restrictions Bypass             ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  const isAdmin = isWindowsAdmin();
  const adminBadge = isAdmin
    ? `${C.green}[Admin: Yes ✓]${C.reset}`
    : `${C.yellow}[Admin: No]${C.reset}`;

  if (netInfo && netInfo.ok) {
    const locBadge = `${C.green}🌐 [${netInfo.country}${netInfo.city ? ', ' + netInfo.city : ''}]${C.reset}`;
    console.log(center(`${C.dim}Network:${C.reset} ${netInfo.ip} (${netInfo.org || 'Internet'}) ${locBadge}  ${adminBadge}`));
    console.log('');
  }
}

module.exports = {
  C,
  W,
  LINE,
  DLINE,
  cls,
  center,
  ok,
  err,
  info,
  warn,
  isWindowsAdmin,
  ensureAdminElevation,
  exitGracefully,
  drawBanner,
};
