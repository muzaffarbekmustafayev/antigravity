/**
 * views.js — Interaktiv menyu va o'rnatilmalar ro'yxatini chizish
 */

'use strict';

const { C, LINE, DLINE, warn } = require('./colors');

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

function renderInstalledList(installedOnly) {
  console.log(DLINE);
  console.log(`  ${C.bold}${C.white}📦 DETECTED INSTALLATIONS:${C.reset}`);
  console.log(DLINE);
  console.log('');

  if (installedOnly.length === 0) {
    console.log(warn('No Antigravity installations found on your computer.'));
    console.log('');
    return;
  }

  for (let i = 0; i < installedOnly.length; i++) {
    const inst = installedOnly[i];
    const num = `${C.bold}${C.yellow}[${i + 1}]${C.reset}`;
    const isP = inst.patch === 'already patched';
    const badge = isP ? `${C.green}[PATCHED ✓]${C.reset}` : `${C.red}[NOT PATCHED ✗]${C.reset}`;

    console.log(`  ${num} ${C.bold}${C.white}${inst.name}${C.reset}  ${badge}`);
    console.log(`      ${C.dim}Path:${C.reset}    ${C.cyan}${inst.target}${C.reset}`);
    const metaParts = [];
    if (inst.version && inst.version !== 'N/A') metaParts.push(`Version: ${C.bold}${inst.version}${C.reset}`);
    if (inst.size && inst.size !== 'N/A') metaParts.push(`Size: ${inst.size}`);
    if (metaParts.length) {
      console.log(`      ${C.dim}Info:${C.reset}    ${metaParts.join('  │  ')}`);
    }
    console.log('');
  }
}

function renderMenuOptions(installedCount) {
  console.log(LINE);
  console.log(`  ${C.bold}${C.white}⚡ Available Commands:${C.reset}`);
  if (installedCount > 0) {
    console.log(`    ${C.bold}[1 - ${installedCount}]${C.reset}  Patch selected installation`);
    console.log(`    ${C.bold}[A]${C.reset}      Patch ALL detected installations (${C.green}Recommended${C.reset})`);
    console.log(`    ${C.bold}[R]${C.reset}      Restore original files (Restore / Unpatch)`);
  }
  console.log(`    ${C.bold}[O]${C.reset}      Open Web Dashboard (http://localhost:3000)`);
  console.log(`    ${C.bold}[S]${C.reset}      System status & diagnostics (Network, DNS, NRPT)`);
  console.log(`    ${C.bold}[W]${C.reset}      Start Watchdog daemon (Auto-repatch background observer)`);
  console.log(`    ${C.bold}[Q]${C.reset}      Quit`);
  console.log(LINE);
}

function ask(rl, promptText) {
  return new Promise(resolve => {
    rl.question(promptText, answer => {
      resolve((answer || '').trim());
    });
  });
}

function waitEnter(rl) {
  return new Promise(resolve => {
    rl.question(`\n  ${C.dim}Press Enter to continue...${C.reset}`, () => {
      resolve();
    });
  });
}

module.exports = {
  renderDiscoveryCards,
  renderInstalledList,
  renderMenuOptions,
  ask,
  waitEnter,
};
