#!/usr/bin/env node
/**
 * cli.js — Antigravity Bypass & Regional Unlocker (Modular CLI Entrypoint)
 *
 * Standalone .exe sifatida ishga tushganda avtomatik Administrator huquqini
 * so'raydi va to'liq interaktiv menyuni ochadi.
 */

'use strict';

const readline = require('readline');
const patch    = require('./src/bypass/patch');
const bypass   = require('./src/bypass');
const dnsBypass = require('./src/bypass/dns-bypass');
const { getNetworkStatus } = require('./src/network');
const {
  C,
  cls,
  center,
  drawBanner,
  ensureAdminElevation,
  exitGracefully,
} = require('./src/ui/colors');
const {
  renderDiscoveryCards,
  renderInstalledList,
  renderMenuOptions,
  ask,
  waitEnter,
} = require('./src/ui/views');
const {
  handlePatchSingle,
  handlePatchAll,
  handleRestore,
  handleStatus,
  handleWatchdog,
} = require('./src/ui/handlers');

/**
 * Asosiy interaktiv boshqaruv sikli (npm start interfeysi)
 */
async function runInteractiveLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    cls();
    const netInfo = await getNetworkStatus();
    drawBanner(netInfo);

    // 1. O'rnatilmalarni aniqlash (kesh tufayli 0ms da bajariladi)
    const allInstalls = patch.detectInstallations();
    renderDiscoveryCards(allInstalls);

    // 2. Sizda borlari ro'yxati
    const installedOnly = allInstalls.filter(i => i.status === 'found');
    renderInstalledList(installedOnly);

    // 3. Menyu buyruqlari
    renderMenuOptions(installedOnly.length);

    // 4. User choice
    const answer = (await ask(rl, `  ${C.bold}Enter your choice [1-${installedOnly.length || 1}, A, R, S, W, Q]: ${C.reset}`)).toUpperCase();

    if (answer === 'Q' || answer === '0') {
      cls();
      console.log('');
      console.log(center(`${C.bold}${C.cyan}Goodbye! Antigravity will continue running smoothly. 👋${C.reset}`));
      console.log('');
      rl.close();
      exitGracefully(0);
      return;
    }

    if (answer === 'A') {
      await handlePatchAll(rl);
      continue;
    }

    if (answer === 'R') {
      await handleRestore(installedOnly, rl);
      continue;
    }

    if (answer === 'S') {
      const freshInstalls = patch.detectInstallations(true);
      await handleStatus(freshInstalls, rl);
      continue;
    }

    if (answer === 'W') {
      rl.close();
      handleWatchdog();
      return;
    }

    const selectedNum = parseInt(answer, 10);
    if (!isNaN(selectedNum) && selectedNum >= 1 && selectedNum <= installedOnly.length) {
      const selectedInst = installedOnly[selectedNum - 1];
      await handlePatchSingle(selectedInst, rl);
      continue;
    }

    console.log(`\n  ${C.yellow}⚠ Invalid choice: "${answer}". Please try again.${C.reset}`);
    await waitEnter(rl);
  }
}

/**
 * Direct CLI invocation or argument-driven execution
 */
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] ? args[0].toLowerCase() : '';

  // Request UAC elevation when modifying system, skip for read-only 'status'
  if (cmd !== 'status') {
    ensureAdminElevation();
  }

  if (cmd === 'patch' || cmd === 'unlock') {
    const num = parseInt(args[1], 10);
    const all = patch.detectInstallations();
    const installed = all.filter(i => i.status === 'found');

    if (!isNaN(num) && num >= 1 && num <= installed.length) {
      console.log(`⚡ Applying patch to: ${installed[num - 1].name}...`);
      const r = patch.patchInstallation(installed[num - 1], { force: true });
      console.log(r.success || r.alreadyDone ? '✅ Success!' : '❌ Error: ' + r.errors.join(', '));
    } else {
      console.log(`⚡ Patching all Antigravity installations...`);
      await bypass.enable({ force: true });
      console.log('✅ All installations patched successfully!');
    }
    exitGracefully(0);
    return;
  }

  if (cmd === 'status') {
    const all = patch.detectInstallations();
    const rlFake = { question: (_, cb) => cb('') };
    await handleStatus(all, rlFake);
    exitGracefully(0);
    return;
  }

  if (cmd === 'restore' || cmd === 'unpatch') {
    const all = patch.detectInstallations();
    const installed = all.filter(i => i.status === 'found');
    for (const inst of installed) patch.unpatchInstallation(inst);
    dnsBypass.teardown(true);
    console.log('✅ All installations restored to original state.');
    exitGracefully(0);
    return;
  }

  if (cmd === 'watchdog') {
    handleWatchdog();
    return;
  }

  // Default: run interactive CLI menu loop
  await runInteractiveLoop();
}

if (require.main === module) {
  main().catch(e => {
    console.error('Error:', e);
    exitGracefully(1);
  });
}

module.exports = { main };
