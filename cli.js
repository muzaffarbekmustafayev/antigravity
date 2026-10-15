#!/usr/bin/env node
/**
 * cli.js — Antigravity Bypass & Regional Unlocker (v2.0)
 *
 * Google Antigravity (AGY) va Antigravity IDE uchun mintaqaviy cheklovlarni
 * olib tashlash, binar patch qo'llash va DNS marshrutlashni boshqarish vositasi.
 */

'use strict';

const readline = require('readline');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const bypass   = require('./src/bypass');
const patch    = require('./src/bypass/patch');
const dnsBypass = require('./src/bypass/dns-bypass');
const { getNetworkStatus } = require('./src/network');

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

// ─── Banner ────────────────────────────────────────────────────────────────────
function drawBanner(netInfo) {
  console.log('');
  console.log(center(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║         🚀  ANTIGRAVITY BYPASS & UNLOCKER  🚀            ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║       Mintaqaviy cheklovlardan to'liq ozod qilish        ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  if (netInfo && netInfo.ok) {
    const vpnBadge = netInfo.isVpn ? `${C.green}🛡️ [VPN FAOL: ${netInfo.country}]${C.reset}` : `${C.yellow}⚠️ [MAHALLIY INTERNET: ${netInfo.country}]${C.reset}`;
    console.log(center(`${C.dim}Tarmoq:${C.reset} ${netInfo.ip} (${netInfo.org || 'ISP'}) ${vpnBadge}`));
    console.log('');
  }
}

// ─── 1. Qidiruv kartochkalarini chiqarish (Searching for installations...) ────
function renderDiscoveryCards(allInstalls) {
  console.log(`] ${C.bold}Searching for installations...${C.reset}`);
  for (const inst of allInstalls) {
    const nameLine = `  ─ ${C.bold}${inst.name}${C.reset} ` + '─'.repeat(Math.max(4, 52 - inst.name.length));
    console.log(nameLine);
    console.log(`      Target:  ${inst.target === 'Not found' ? C.dim + 'Not found' + C.reset : C.cyan + inst.target + C.reset}`);
    
    let statusFormatted = C.red + 'not found' + C.reset;
    if (inst.status === 'found') {
      statusFormatted = C.green + 'found' + C.reset;
    }
    console.log(`      Status:  ${statusFormatted}`);

    if (inst.status === 'found') {
      let patchFormatted = C.red + 'not patched' + C.reset;
      if (inst.patch === 'already patched') {
        patchFormatted = C.green + 'already patched' + C.reset;
      }
      console.log(`      Patch:   ${patchFormatted}`);
      if (inst.version && inst.version !== 'N/A') {
        console.log(`      Version: ${inst.version}`);
      }
      if (inst.size && inst.size !== 'N/A') {
        console.log(`      Size:    ${inst.size}`);
      }
    }
    console.log('');
  }
}

// ─── 2. Sizda borlari ro'yxati (1 dan boshlanadi) ──────────────────────────────
function renderInstalledList(installedOnly) {
  console.log(DLINE);
  console.log(`  ${C.bold}${C.white}📦 SIZDA BORLARI (Mavjud o'rnatilmalar):${C.reset}`);
  console.log(DLINE);
  console.log('');

  if (installedOnly.length === 0) {
    console.log(warn('Kompyuteringizda Antigravity o\'rnatilmalari topilmadi.'));
    console.log('');
    return;
  }

  for (let i = 0; i < installedOnly.length; i++) {
    const inst = installedOnly[i];
    const num = `${C.bold}${C.yellow}[${i + 1}]${C.reset}`;
    const isP = inst.patch === 'already patched';
    const badge = isP ? `${C.green}[PATCHED ✓]${C.reset}` : `${C.red}[NOT PATCHED ✗]${C.reset}`;

    console.log(`  ${num} ${C.bold}${C.white}${inst.name}${C.reset}  ${badge}`);
    console.log(`      ${C.dim}Yo'l:${C.reset}    ${C.cyan}${inst.target}${C.reset}`);
    const metaParts = [];
    if (inst.version && inst.version !== 'N/A') metaParts.push(`Versiya: ${C.bold}${inst.version}${C.reset}`);
    if (inst.size && inst.size !== 'N/A') metaParts.push(`Hajm: ${inst.size}`);
    if (metaParts.length) {
      console.log(`      ${C.dim}Ma'lumot:${C.reset} ${metaParts.join('  │  ')}`);
    }
    console.log('');
  }
}

// ─── 3. Menyu variantlarini ko'rsatish ──────────────────────────────────────────
function renderMenuOptions(installedCount) {
  console.log(LINE);
  console.log(`  ${C.bold}${C.white}⚡ Buyruqlar:${C.reset}`);
  if (installedCount > 0) {
    console.log(`    ${C.bold}[1 - ${installedCount}]${C.reset}  Tanlangan o'rnatilmani patch qilish (Bypass & Patch)`);
    console.log(`    ${C.bold}[A]${C.reset}      BARCHASINI birvarakayiga patch qilish (${C.green}Tavsiya etiladi${C.reset})`);
    console.log(`    ${C.bold}[R]${C.reset}      Asliga qaytarish (Restore / Unpatch)`);
  }
  console.log(`    ${C.bold}[S]${C.reset}      Status & Diagnostika (Tarmoq, DNS, NRPT)`);
  console.log(`    ${C.bold}[W]${C.reset}      Watchdog avto-patch (fon rejimida kuzatuvchi)`);
  console.log(`    ${C.bold}[Q]${C.reset}      Chiqish`);
  console.log(LINE);
}

// ─── Readline bilan so'rov olish ───────────────────────────────────────────────
function ask(rl, promptText) {
  return new Promise(resolve => {
    rl.question(promptText, answer => {
      resolve((answer || '').trim());
    });
  });
}

function waitEnter(rl) {
  return new Promise(resolve => {
    rl.question(`\n  ${C.dim}Davom etish uchun Enter bosing...${C.reset}`, () => {
      resolve();
    });
  });
}

// ─── Bitta o'rnatilmani patch qilish ──────────────────────────────────────────
async function handlePatchSingle(inst, rl) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.yellow}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}║         ⚡  PATCH QILINMOQDA: ${inst.name.padEnd(23)} ║${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  console.log(info(`Fayl tekshirilmoqda: ${inst.target}`));

  const res = patch.patchInstallation(inst, { force: true });
  console.log('');

  if (res.success || res.alreadyDone) {
    console.log(ok(`${C.bold}${C.green}${inst.name}${C.reset} muvaffaqiyatli moslashtirildi!`));
    for (const d of res.details) {
      console.log(`   ${C.dim}• ${d}${C.reset}`);
    }
  } else {
    console.log(err(`${inst.name} patch qilishda muammo yuz berdi:`));
    for (const e of res.errors) {
      console.log(`   ${C.red}• ${e}${C.reset}`);
    }
  }

  // Tarmoq DNS moslashuvi
  const dnsRes = await dnsBypass.setup();
  console.log('');
  if (dnsRes && dnsRes.vpnActive) {
    console.log(ok(`${C.green}VPN aniqlandi: ${dnsRes.note}${C.reset}`));
  } else if (dnsRes && dnsRes.ok) {
    console.log(ok(`SmartDNS bypass faollashtirildi (${dnsRes.method}).`));
  }

  await waitEnter(rl);
}

// ─── Barchasini patch qilish ──────────────────────────────────────────────────
async function handlePatchAll(rl) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.yellow}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}║      ⚡  BARCHA O'RNATILMALARNI OCHISH & PATCH  ⚡       ║${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  console.log(info('Tizimdagi barcha Antigravity fayllari va tarmoq sozlanmoqda...'));
  console.log('');

  try {
    const res = await bypass.enable({ force: true });
    const { patch: pRes, dns: dRes } = res;

    console.log(`  ${C.bold}${C.cyan}NATIJALAR:${C.reset}`);
    if (pRes.ok > 0) {
      console.log(ok(`${pRes.ok} ta binar fayl patch qilindi.`));
    }
    if (pRes.jsPatched > 0) {
      console.log(ok(`${pRes.jsPatched} ta IDE/JS fayl moslashtirildi.`));
    }
    if (dRes && dRes.vpnActive) {
      console.log(ok(`${C.green}VPN faol: Tabiiy VPN marshruti orqali ishlamoqda.${C.reset}`));
    } else if (dRes && dRes.ok) {
      console.log(ok(`SmartDNS marshrutlash faollashtirildi.`));
    }

    if (pRes.details && pRes.details.length) {
      console.log('');
      console.log(`  ${C.bold}${C.cyan}BATAFSIL:${C.reset}`);
      for (const d of pRes.details) console.log(`  ${C.dim}${d}${C.reset}`);
    }

    console.log('');
    console.log(DLINE);
    console.log(center(`${C.bold}${C.green}✅ BARCHA ANTIGRAVITY O'RNATILMALARI TO'LIQ OCHILDI!${C.reset}`));
  } catch (e) {
    console.log(err(`Xatolik: ${e.message}`));
  }

  await waitEnter(rl);
}

// ─── Asliga qaytarish (Restore) ───────────────────────────────────────────────
async function handleRestore(installedOnly, rl) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.magenta}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.magenta}║            ↩️  ASL HOLATIGA QAYTARISH  ↩️                ║${C.reset}`));
  console.log(center(`${C.bold}${C.magenta}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  console.log(`  Qaysi o'rnatilmani asliga qaytarmoqchisiz?`);
  for (let i = 0; i < installedOnly.length; i++) {
    console.log(`    [${i + 1}] ${installedOnly[i].name}`);
  }
  console.log(`    [A] Barchasini tiklash (Restore All)`);
  console.log(`    [B] Orqaga qaytish`);
  console.log('');

  const choice = (await ask(rl, `  Tanlovingizni kiriting [1-${installedOnly.length}, A, B]: `)).toUpperCase();

  if (choice === 'B' || choice === '') {
    return;
  }

  if (choice === 'A') {
    console.log('');
    console.log(info('Barcha o\'rnatilmalar va tarmoq qoidalari tiklanmoqda...'));
    for (const inst of installedOnly) {
      const res = patch.unpatchInstallation(inst);
      if (res.success || res.alreadyDone) {
        console.log(ok(`Tiklandi: ${inst.name}`));
      }
    }
    dnsBypass.teardown(true);
    console.log(ok('NRPT va DNS sozlamalari tozalandi.'));
    console.log('');
    console.log(DLINE);
    console.log(center(`${C.bold}${C.green}Barcha o'rnatilmalar asl holatiga qaytarildi.${C.reset}`));
  } else {
    const num = parseInt(choice, 10);
    if (!isNaN(num) && num >= 1 && num <= installedOnly.length) {
      const targetInst = installedOnly[num - 1];
      console.log('');
      console.log(info(`${targetInst.name} tiklanmoqda...`));
      const res = patch.unpatchInstallation(targetInst);
      if (res.success || res.alreadyDone) {
        console.log(ok(`Tiklandi: ${targetInst.name}`));
        for (const d of res.details) console.log(`   ${C.dim}• ${d}${C.reset}`);
      } else {
        console.log(err(`Xatolik: ${res.errors.join(', ')}`));
      }
    } else {
      console.log(warn('Noto\'g\'ri tanlov.'));
    }
  }

  await waitEnter(rl);
}

// ─── Status & Diagnostika ─────────────────────────────────────────────────────
async function handleStatus(allInstalls, rl) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║             🔍  TIZIM DIAGNOSTIKASI  🔍                  ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  const netInfo = await getNetworkStatus(true);
  console.log(`  ${C.bold}${C.cyan}TARMOQ VA VPN:${C.reset}`);
  console.log(`  • Tashqi IP: ${C.bold}${netInfo.ip}${C.reset} (${netInfo.country}, ${netInfo.city || ''})`);
  console.log(`  • Provayder: ${netInfo.org || 'Noma\'lum'}`);
  console.log(`  • VPN holati: ${netInfo.isVpn ? C.green + '🛡️ FAOL (SOTA yoki boshqa VPN)' : C.yellow + '⚠️ NOFAOL (Mahalliy provayder)'}${C.reset}`);
  console.log('');

  console.log(`  ${C.bold}${C.cyan}O'RNATILMALAR STATUSI:${C.reset}`);
  for (const inst of allInstalls) {
    const isFound = inst.status === 'found';
    const isP = inst.patch === 'already patched';
    const badge = !isFound ? `${C.dim}[TOPILMADI]${C.reset}` : (isP ? `${C.green}[PATCHED ✓]${C.reset}` : `${C.red}[NOT PATCHED ✗]${C.reset}`);
    console.log(`  • ${badge} ${C.bold}${inst.name}${C.reset}`);
    console.log(`    ${C.dim}${inst.target}${C.reset}`);
  }
  console.log('');

  const nrptApplied = dnsBypass.isNrptApplied();
  console.log(`  ${C.bold}${C.cyan}DNS & NRPT QOIDALARI:${C.reset}`);
  console.log(`  • NRPT holati: ${nrptApplied ? C.yellow + 'Faol (SmartDNS bypass)' : C.green + 'Toza (Standart/VPN)'}${C.reset}`);

  await waitEnter(rl);
}

// ─── Watchdog (Fon rejimi) ────────────────────────────────────────────────────
async function handleWatchdog(rl) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.blue}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.blue}║          🛡️  WATCHDOG AVTO-NAZORATCHI  🛡️                ║${C.reset}`));
  console.log(center(`${C.bold}${C.blue}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');
  console.log(info('Watchdog xizmati faol.'));
  console.log(info('Google Antigravity har yangilanganda, avtomatik qayta patch qilinadi.'));
  console.log(`  ${C.dim}To'xtatish uchun: ${C.bold}Ctrl+C${C.reset} bosing.${C.reset}`);
  console.log(LINE);

  const { Watchdog } = require('./src/bypass/watchdog');
  const wd = new Watchdog();
  wd.on('repatched', ({ bin }) => console.log(ok(`Yangilanish sezildi va qayta patch qilindi: ${bin}`)));
  wd.on('failed', ({ bin }) => console.log(err(`Qayta patch qilishda xato: ${bin}`)));
  wd.start();
}

// ─── Asosiy interaktiv sikl ───────────────────────────────────────────────────
async function runInteractiveLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    cls();
    const netInfo = await getNetworkStatus();
    drawBanner(netInfo);

    // 1. O'rnatilmalarni aniqlash
    const allInstalls = patch.detectInstallations();
    renderDiscoveryCards(allInstalls);

    // 2. Sizda borlari ro'yxati (1 dan boshlanadi)
    const installedOnly = allInstalls.filter(i => i.status === 'found');
    renderInstalledList(installedOnly);

    // 3. Menyu buyruqlari
    renderMenuOptions(installedOnly.length);

    // 4. Foydalanuvchidan son/buyruq tanlashni so'rash
    const answer = (await ask(rl, `  ${C.bold}Tanlovingizni kiriting [1-${installedOnly.length || 1}, A, R, S, W, Q]: ${C.reset}`)).toUpperCase();

    if (answer === 'Q' || answer === '0') {
      cls();
      console.log('');
      console.log(center(`${C.bold}${C.cyan}Xayr! Antigravity muvaffaqiyatli ishlashda davom etadi. 👋${C.reset}`));
      console.log('');
      rl.close();
      process.exit(0);
    }

    if (answer === 'A' || answer === 'B') {
      await handlePatchAll(rl);
      continue;
    }

    if (answer === 'R') {
      await handleRestore(installedOnly, rl);
      continue;
    }

    if (answer === 'S') {
      await handleStatus(allInstalls, rl);
      continue;
    }

    if (answer === 'W') {
      rl.close();
      await handleWatchdog();
      return;
    }

    const selectedNum = parseInt(answer, 10);
    if (!isNaN(selectedNum) && selectedNum >= 1 && selectedNum <= installedOnly.length) {
      const selectedInst = installedOnly[selectedNum - 1];
      await handlePatchSingle(selectedInst, rl);
      continue;
    }

    // Agar noma'lum buyruq kiritilgan bo'lsa
    console.log(`\n  ${C.yellow}⚠ Noto'g'ri tanlov kiritildi: "${answer}". Qaytadan urinib ko'ring.${C.reset}`);
    await waitEnter(rl);
  }
}

// ─── CLI Parametrlar orqali chaqirilganda ──────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] ? args[0].toLowerCase() : '';

  if (cmd === 'patch' || cmd === 'unlock') {
    const num = parseInt(args[1], 10);
    const all = patch.detectInstallations();
    const installed = all.filter(i => i.status === 'found');

    if (!isNaN(num) && num >= 1 && num <= installed.length) {
      console.log(`⚡ Patch qo'llanilmoqda: ${installed[num - 1].name}...`);
      const r = patch.patchInstallation(installed[num - 1], { force: true });
      console.log(r.success || r.alreadyDone ? '✅ Muvaffaqiyatli!' : '❌ Xato: ' + r.errors.join(', '));
    } else {
      console.log(`⚡ Barcha Antigravity o'rnatilmalari patch qilinmoqda...`);
      await bypass.enable({ force: true });
      console.log('✅ Barchasi patch qilindi!');
    }
    process.exit(0);
  }

  if (cmd === 'status') {
    const all = patch.detectInstallations();
    const rlFake = { question: (_, cb) => cb('') };
    await handleStatus(all, rlFake);
    process.exit(0);
  }

  if (cmd === 'restore' || cmd === 'unpatch') {
    const all = patch.detectInstallations();
    const installed = all.filter(i => i.status === 'found');
    for (const inst of installed) patch.unpatchInstallation(inst);
    dnsBypass.teardown(true);
    console.log('✅ Barcha o\'rnatilmalar asl holatiga qaytarildi.');
    process.exit(0);
  }

  if (cmd === 'watchdog') {
    await handleWatchdog();
    return;
  }

  // Standart: interaktiv menyu
  await runInteractiveLoop();
}

if (require.main === module) {
  main().catch(e => {
    console.error('Xatolik:', e);
    process.exit(1);
  });
}

module.exports = { main };
