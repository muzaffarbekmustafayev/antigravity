#!/usr/bin/env node
/**
 * cli.js — Antigravity interaktiv boshqaruv paneli (v2)
 *
 * npm start qilganda 3 ta tanlov chiqadi:
 *   1. Patch — Antigravity'ni barcha hududlarda ishlaydigan qilish
 *   2. Telegram Bot — Masofaviy terminal botni ishga tushirish
 *   3. Chiqish — Terminalni yopish
 */

'use strict';

const readline = require('readline');
const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── ANSI ranglar ──────────────────────────────────────────────────────────────
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
  bgCyan:  '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgRed:   '\x1b[41m',
};

const W = Math.min(process.stdout.columns || 64, 76);
const LINE = C.dim + '─'.repeat(W) + C.reset;
const DLINE = C.dim + '═'.repeat(W) + C.reset;

// ─── Yordamchi funksiyalar ─────────────────────────────────────────────────────
function cls() { process.stdout.write('\x1b[H\x1b[J'); }

function center(str) {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad   = Math.max(0, Math.floor((W - plain.length) / 2));
  return ' '.repeat(pad) + str;
}

function ok(msg)   { return `  ${C.green}✓${C.reset}  ${msg}`; }
function err(msg)  { return `  ${C.red}✗${C.reset}  ${msg}`; }
function info(msg) { return `  ${C.cyan}ℹ${C.reset}  ${msg}`; }
function warn(msg) { return `  ${C.yellow}⚠${C.reset}  ${msg}`; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Banner ────────────────────────────────────────────────────────────────────
function drawBanner() {
  console.log('');
  console.log(center(`${C.bold}${C.cyan}╔═══════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║                                               ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║   🚀  ANTIGRAVITY MANAGER  🚀                 ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║   Barcha hududlarda ishlash uchun              ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║                                               ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}╚═══════════════════════════════════════════════╝${C.reset}`));
  console.log('');
}

// ─── Menyu ─────────────────────────────────────────────────────────────────────
let selectedIdx = 0;

const MENU_ITEMS = [
  {
    key: '1',
    icon: '⚡',
    label: 'Patch — Barcha hududlarda ishlash',
    desc: 'Binary va IDE fayllarini patch qilish + DNS bypass o\'rnatish',
    color: C.yellow,
  },
  {
    key: '2',
    icon: '🤖',
    label: 'Telegram Bot — Masofaviy terminal',
    desc: 'Telegram orqali buyruqlar yuborish va AGY boshqarish',
    color: C.green,
  },
  {
    key: '3',
    icon: '🚪',
    label: 'Chiqish',
    desc: 'Terminalni yopish',
    color: C.red,
  },
];

function drawMenu() {
  console.log(LINE);
  console.log(`  ${C.bold}${C.white}Tanlang:${C.reset}`);
  console.log('');

  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i];
    const isSel = i === selectedIdx;
    const num = `${C.bold}[${item.key}]${C.reset}`;

    if (isSel) {
      console.log(`  ${C.bold}${C.cyan}▸${C.reset} ${num}  ${item.icon}  ${C.bold}${item.color}${item.label}${C.reset}`);
    } else {
      console.log(`    ${num}  ${item.icon}  ${C.white}${item.label}${C.reset}`);
    }
  }

  console.log('');
  console.log(LINE);

  const curItem = MENU_ITEMS[selectedIdx];
  console.log(`  ${C.cyan}ℹ${C.reset}  ${C.dim}${curItem.desc}${C.reset}`);
  console.log(`  ${C.dim}↑↓ harakat  │  Enter tanlash  │  1-3 tezkor tanlash${C.reset}`);
}

function render() {
  process.stdout.write('\x1b[?25l'); // kursorni yashirish
  cls();
  drawBanner();
  drawMenu();
}

// ─── Patch amaliyoti ───────────────────────────────────────────────────────────
async function actionPatch(interactive = true) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}  ⚡ TO'LIQ PATCH — BARCHA HUDUDLAR UCHUN${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`));
  console.log('');

  const steps = [
    { label: 'Binary fayllar qidirilmoqda...', icon: '🔍' },
    { label: 'Binary patch qilinmoqda (ineligible → inexigible)...', icon: '🔧' },
    { label: 'Proxy var almashtirilmoqda (https_proxy → AG_LS_PROXY)...', icon: '🔗' },
    { label: 'IDE main.js patch qilinmoqda...', icon: '📝' },
    { label: 'DNS bypass o\'rnatilmoqda...', icon: '🌐' },
    { label: 'DNS kesh tozalanmoqda...', icon: '🧹' },
  ];

  // Animate steps
  for (let i = 0; i < 3; i++) {
    console.log(`  ${C.dim}[${i+1}/6]${C.reset} ${steps[i].icon}  ${steps[i].label}`);
    await sleep(300);
  }

  // Execute patch
  let patchResult = { ok: 0, failed: 0, proxyVar: 0, jsPatched: 0, jsFailed: 0, errors: [], details: [] };
  let dnsResult = { ok: false };

  try {
    const bypass = require('./src/bypass');

    // Kill CLI processes first
    bypass.patch.killAffectedProcesses();
    await sleep(400);

    // Run all patches
    patchResult = bypass.patch.patchAllInstalls({ force: true });

    console.log(`  ${C.dim}[4/6]${C.reset} ${steps[3].icon}  ${steps[3].label}`);
    await sleep(200);

    // DNS bypass
    console.log(`  ${C.dim}[5/6]${C.reset} ${steps[4].icon}  ${steps[4].label}`);
    try {
      dnsResult = await bypass.dns.setup({ force: true });
    } catch (e) {
      dnsResult = { ok: false, error: e.message };
    }

    console.log(`  ${C.dim}[6/6]${C.reset} ${steps[5].icon}  ${steps[5].label}`);
    try { bypass.dns.flushDnsCache(); } catch (_) {}
  } catch (e) {
    patchResult.errors.push(e.message);
  }

  await sleep(300);

  // Show results
  console.log('');
  console.log(DLINE);
  console.log('');
  console.log(center(`${C.bold}${C.cyan}── NATIJALAR ──${C.reset}`));
  console.log('');

  // Binary results
  const totalBin = patchResult.ok + patchResult.failed;
  if (totalBin > 0) {
    console.log(`  ${C.bold}${C.cyan}BINARY FAYLLAR:${C.reset}`);
    if (patchResult.ok > 0) {
      console.log(ok(`${C.bold}${C.green}${patchResult.ok}${C.reset} ta binary muvaffaqiyatli patch qilindi`));
    }
    if (patchResult.proxyVar > 0) {
      console.log(ok(`${patchResult.proxyVar} ta proxy var almashtirildi`));
    }
    if (patchResult.failed > 0) {
      console.log(err(`${patchResult.failed} ta binary patch bo'lmadi`));
    }
  } else {
    console.log(warn('Binary fayllar topilmadi. Antigravity o\'rnatilganligini tekshiring.'));
  }

  console.log('');

  // JS results
  const totalJs = (patchResult.jsPatched || 0) + (patchResult.jsFailed || 0);
  if (totalJs > 0) {
    console.log(`  ${C.bold}${C.cyan}IDE / EXTENSION FAYLLAR:${C.reset}`);
    if (patchResult.jsPatched > 0) {
      console.log(ok(`${C.bold}${C.green}${patchResult.jsPatched}${C.reset} ta JS fayl patch qilindi`));
    }
    if (patchResult.jsFailed > 0) {
      console.log(err(`${patchResult.jsFailed} ta JS fayl patch bo'lmadi`));
    }
  }

  console.log('');

  // DNS results
  console.log(`  ${C.bold}${C.cyan}DNS BYPASS:${C.reset}`);
  if (dnsResult.ok) {
    console.log(ok(`${C.bold}${C.green}DNS Bypass muvaffaqiyatli o'rnatildi!${C.reset}`));
    if (dnsResult.vpnActive) {
      console.log(info(`VPN aktiv — ISP interfeysi: ${dnsResult.ifName || '?'}`));
    }
  } else {
    console.log(warn(`DNS bypass: ${dnsResult.error || 'Administrator huquqi kerak bo\'lishi mumkin'}`));
    console.log(info('DNS bypass uchun terminalni Administrator sifatida ishga tushiring.'));
  }

  // Show details
  if (patchResult.details && patchResult.details.length) {
    console.log('');
    console.log(`  ${C.bold}${C.cyan}BATAFSIL:${C.reset}`);
    for (const d of patchResult.details) {
      console.log(`  ${C.dim}${d}${C.reset}`);
    }
  }

  // Show errors
  if (patchResult.errors.length) {
    console.log('');
    console.log(`  ${C.bold}${C.red}XATOLIKLAR:${C.reset}`);
    for (const e of patchResult.errors) {
      console.log(err(e));
    }
  }

  console.log('');

  // Final verdict
  if (patchResult.ok > 0 || (patchResult.jsPatched || 0) > 0) {
    console.log(DLINE);
    console.log('');
    console.log(center(`${C.bold}${C.green}✅ PATCH MUVAFFAQIYATLI!${C.reset}`));
    console.log(center(`${C.dim}Antigravity endi barcha hududlarda ishlaydi.${C.reset}`));
    console.log(center(`${C.dim}VPN kerak emas — to'g'ridan-to'g'ri provayder orqali.${C.reset}`));
  } else if (totalBin === 0 && totalJs === 0) {
    console.log(DLINE);
    console.log('');
    console.log(center(`${C.bold}${C.yellow}⚠ Antigravity o'rnatilmagan yoki topilmadi.${C.reset}`));
    console.log(center(`${C.dim}Avval Antigravity IDE yoki CLI o'rnating.${C.reset}`));
  }

  if (interactive && process.stdin.isTTY) {
    console.log('');
    console.log(`  ${C.dim}Davom etish uchun har qanday tugmani bosing...${C.reset}`);
    await waitForKey();
  }
}

// ─── Telegram Bot ──────────────────────────────────────────────────────────────
async function actionBot() {
  teardownKeyboard();
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.cyan}╔══════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║    🤖  TELEGRAM BOT ISHGA TUSHMOQDA  🤖  ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}╚══════════════════════════════════════════╝${C.reset}`));
  console.log('');

  // Check .env configuration
  try {
    require('dotenv').config();
  } catch (_) {}

  const token = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_CHAT_ID;

  if (!token || !adminId) {
    console.log(warn('⚠️ .env faylida BOT_TOKEN yoki ADMIN_CHAT_ID belgilanmagan.'));
    console.log(info(`Server Web Dashboard rejimida ishga tushirilmoqda (http://localhost:${process.env.PORT || '3000'})...`));
    console.log(info('Telegram botni to\'liq ulash uchun .env fayliga BOT_TOKEN va ADMIN_CHAT_ID kiriting.'));
    console.log('');
    console.log(`  ${C.dim}Server ishlamoqda. Chiqish uchun: ${C.bold}Ctrl+C${C.reset}${C.dim} bosing.${C.reset}`);
    console.log(LINE);
    console.log('');
    require('./server.js');
    return;
  }

  console.log(info(`Bot Token: ${C.dim}...${token.slice(-8)}${C.reset}`));
  console.log(info(`Admin ID: ${C.dim}${adminId}${C.reset}`));
  console.log('');
  console.log(`  ${C.dim}Bot ishlamoqda. Chiqish uchun: ${C.bold}Ctrl+C${C.reset}${C.dim} bosing.${C.reset}`);
  console.log(LINE);
  console.log('');

  // Start the bot server
  require('./server.js');
}

// ─── Chiqish ───────────────────────────────────────────────────────────────────
function actionExit() {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.cyan}Xayr! 👋${C.reset}`));
  console.log('');
  if (process.stdin.isTTY) try { process.stdin.setRawMode(false); } catch (_) {}
  process.stdout.write('\x1b[?25h');
  process.exit(0);
}

// ─── Keyboard ──────────────────────────────────────────────────────────────────
let dataListener = null;

function teardownKeyboard() {
  process.stdin.removeAllListeners('keypress');
  if (dataListener) {
    process.stdin.removeListener('data', dataListener);
    dataListener = null;
  }
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch (_) {}
  }
  process.stdout.write('\x1b[?25h');
}

function waitForKey() {
  return new Promise(resolve => {
    const onData = () => {
      process.stdin.removeListener('data', onData);
      resolve();
    };
    process.stdin.once('data', onData);
  });
}

async function handleSelect(key) {
  switch (key) {
    case '1': await actionPatch();       break;
    case '2': await actionBot();         return; // bot takes over
    case '3': actionExit();              return;
    default:  break;
  }
  render();
}

function setupKeyboard() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(true); } catch (_) {}
  }
  try { process.stdin.resume(); } catch (_) {}

  // Remove existing listeners to prevent duplicates
  teardownKeyboard();
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(true); } catch (_) {}
  }

  dataListener = (chunk) => {
    const s = chunk.toString().trim();
    if (['1', '2', '3'].includes(s)) {
      selectedIdx = parseInt(s, 10) - 1;
      handleSelect(s);
    }
  };
  process.stdin.on('data', dataListener);

  process.stdin.on('keypress', (str, key) => {
    if (!key) return;

    if (key.ctrl && key.name === 'c') {
      actionExit();
      return;
    }

    if (key.name === 'up') {
      selectedIdx = (selectedIdx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
      render();
      return;
    }
    if (key.name === 'down') {
      selectedIdx = (selectedIdx + 1) % MENU_ITEMS.length;
      render();
      return;
    }
    if (key.name === 'return' || key.name === 'enter') {
      handleSelect(MENU_ITEMS[selectedIdx].key);
      return;
    }

    // 1-3 direct select
    if (str && /^[1-3]$/.test(str)) {
      selectedIdx = parseInt(str, 10) - 1;
      handleSelect(str);
    }
  });
}

// ─── Entry point ───────────────────────────────────────────────────────────────
(async () => {
  // CLI argument support
  const arg = process.argv[2];
  if (arg) {
    if (['1', 'patch', 'unlock'].includes(arg)) {
      await actionPatch(false);
      process.exit(0);
    }
    if (['2', 'bot', 'server'].includes(arg)) {
      await actionBot();
      return;
    }
    if (['3', 'exit', 'quit'].includes(arg)) {
      process.exit(0);
    }
  }

  render();
  setupKeyboard();
})();
