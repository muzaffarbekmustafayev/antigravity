/**
 * handlers.js — CLI foydalanuvchi buyruqlari boshqaruvchilari
 */

'use strict';

const { C, DLINE, LINE, cls, center, ok, err, info, warn } = require('./colors');
const { ask, waitEnter } = require('./views');
const bypass = require('../bypass');
const patch = require('../bypass/patch');
const dnsBypass = require('../bypass/dns-bypass');
const { getNetworkStatus } = require('../network');

async function handlePatchSingle(inst, rl) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.yellow}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}║         ⚡  APPLYING PATCH: ${inst.name.padEnd(25)} ║${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  console.log(info(`Inspecting target: ${inst.target}`));

  const res = patch.patchInstallation(inst, { force: true });
  console.log('');

  if (res.success || res.alreadyDone) {
    console.log(ok(`${C.bold}${C.green}${inst.name}${C.reset} successfully patched!`));
    for (const d of res.details) {
      console.log(`   ${C.dim}• ${d}${C.reset}`);
    }
  } else {
    console.log(err(`Failed to patch ${inst.name}:`));
    for (const e of res.errors) {
      console.log(`   ${C.red}• ${e}${C.reset}`);
    }
  }

  const dnsRes = await dnsBypass.setup();
  console.log('');
  if (dnsRes && dnsRes.ok) {
    console.log(ok(`SmartDNS bypass activated (${dnsRes.method}).`));
  } else if (dnsRes && dnsRes.error) {
    console.log(warn(`SmartDNS note: ${dnsRes.error}`));
  }

  await waitEnter(rl);
}

async function handlePatchAll(rl) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.yellow}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}║      ⚡  UNLOCK & PATCH ALL INSTALLATIONS  ⚡           ║${C.reset}`));
  console.log(center(`${C.bold}${C.yellow}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  console.log(info('Configuring all Antigravity files and network settings...'));
  console.log('');

  try {
    const res = await bypass.enable({ force: true });
    const { patch: pRes, dns: dRes } = res;

    console.log(`  ${C.bold}${C.cyan}RESULTS:${C.reset}`);
    if (pRes.ok > 0) {
      console.log(ok(`${pRes.ok} binary file(s) patched.`));
    }
    if (pRes.jsPatched > 0) {
      console.log(ok(`${pRes.jsPatched} IDE/JS file(s) patched.`));
    }
    if (dRes && dRes.ok) {
      console.log(ok(`SmartDNS routing activated (${dRes.method || 'active'}).`));
    } else if (dRes && dRes.error) {
      console.log(warn(`SmartDNS: ${dRes.error}`));
    }

    if (pRes.details && pRes.details.length) {
      console.log('');
      console.log(`  ${C.bold}${C.cyan}DETAILS:${C.reset}`);
      for (const d of pRes.details) console.log(`  ${C.dim}${d}${C.reset}`);
    }

    console.log('');
    console.log(DLINE);
    console.log(center(`${C.bold}${C.green}✅ ALL ANTIGRAVITY INSTALLATIONS FULLY UNLOCKED!${C.reset}`));
  } catch (e) {
    console.log(err(`Error: ${e.message}`));
  }

  await waitEnter(rl);
}

async function handleRestore(installedOnly, rl) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.magenta}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.magenta}║            ↩️  RESTORE ORIGINAL STATE  ↩️                ║${C.reset}`));
  console.log(center(`${C.bold}${C.magenta}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  console.log(`  Which installation would you like to restore?`);
  for (let i = 0; i < installedOnly.length; i++) {
    console.log(`    [${i + 1}] ${installedOnly[i].name}`);
  }
  console.log(`    [A] Restore all installations (Restore All)`);
  console.log(`    [B] Back to main menu`);
  console.log('');

  const choice = (await ask(rl, `  Enter your choice [1-${installedOnly.length}, A, B]: `)).toUpperCase();

  if (choice === 'B' || choice === '') {
    return;
  }

  if (choice === 'A') {
    console.log('');
    console.log(info('Restoring all installations and network rules...'));
    for (const inst of installedOnly) {
      const res = patch.unpatchInstallation(inst);
      if (res.success || res.alreadyDone) {
        console.log(ok(`Restored: ${inst.name}`));
      }
    }
    dnsBypass.teardown(true);
    console.log(ok('NRPT rules and DNS configuration cleared.'));
    console.log('');
    console.log(DLINE);
    console.log(center(`${C.bold}${C.green}All installations restored to original state.${C.reset}`));
  } else {
    const num = parseInt(choice, 10);
    if (!isNaN(num) && num >= 1 && num <= installedOnly.length) {
      const targetInst = installedOnly[num - 1];
      console.log('');
      console.log(info(`Restoring ${targetInst.name}...`));
      const res = patch.unpatchInstallation(targetInst);
      if (res.success || res.alreadyDone) {
        console.log(ok(`Restored: ${targetInst.name}`));
        for (const d of res.details) console.log(`   ${C.dim}• ${d}${C.reset}`);
      } else {
        console.log(err(`Error: ${res.errors.join(', ')}`));
      }
    } else {
      console.log(warn('Invalid choice.'));
    }
  }

  await waitEnter(rl);
}

async function handleStatus(allInstalls, rl) {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}║             🔍  SYSTEM DIAGNOSTICS  🔍                   ║${C.reset}`));
  console.log(center(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');

  const netInfo = await getNetworkStatus(true);
  console.log(`  ${C.bold}${C.cyan}NETWORK STATUS:${C.reset}`);
  console.log(`  • Public IP: ${C.bold}${netInfo.ip}${C.reset} (${netInfo.country}, ${netInfo.city || ''})`);
  console.log(`  • Provider:  ${netInfo.org || 'Internet'}`);
  console.log('');

  console.log(`  ${C.bold}${C.cyan}INSTALLATIONS STATUS:${C.reset}`);
  for (const inst of allInstalls) {
    const isFound = inst.status === 'found';
    const isP = inst.patch === 'already patched';
    const badge = !isFound ? `${C.dim}[NOT FOUND]${C.reset}` : (isP ? `${C.green}[PATCHED ✓]${C.reset}` : `${C.red}[NOT PATCHED ✗]${C.reset}`);
    console.log(`  • ${badge} ${C.bold}${inst.name}${C.reset}`);
    console.log(`    ${C.dim}${inst.target}${C.reset}`);
  }
  console.log('');

  const dnsStat = dnsBypass.status(true);
  console.log(`  ${C.bold}${C.cyan}DNS & NETWORK ROUTING:${C.reset}`);
  if (dnsStat.hostsApplied) {
    console.log(`  • Bypass Mode:   ${C.green}Hosts File (Active ✓ - VPN Safe, Port 53 Free)${C.reset}`);
  } else if (dnsStat.nrptApplied) {
    console.log(`  • Bypass Mode:   ${C.yellow}NRPT / SmartDNS (Active)${C.reset}`);
  } else {
    console.log(`  • Bypass Mode:   ${C.dim}Clean / Default${C.reset}`);
  }
  console.log(`  • Port 53 Relay: ${dnsStat.relayRunning ? C.yellow + 'Active' : C.green + 'Free (Zero conflict with VPN)'}${C.reset}`);

  await waitEnter(rl);
}

function handleWatchdog() {
  cls();
  console.log('');
  console.log(center(`${C.bold}${C.blue}╔══════════════════════════════════════════════════════════╗${C.reset}`));
  console.log(center(`${C.bold}${C.blue}║          🛡️  WATCHDOG AUTO-OBSERVER  🛡️                  ║${C.reset}`));
  console.log(center(`${C.bold}${C.blue}╚══════════════════════════════════════════════════════════╝${C.reset}`));
  console.log('');
  console.log(info('Watchdog daemon service started.'));
  console.log(info('When Google Antigravity auto-updates, patches will be reapplied automatically.'));
  console.log(`  ${C.dim}To stop: press ${C.bold}Ctrl+C${C.reset}.${C.reset}`);
  console.log(LINE);

  const { Watchdog } = require('../bypass/watchdog');
  const wd = new Watchdog({ keepAlive: true });
  wd.on('repatched', ({ bin }) => console.log(ok(`Update detected and repatched: ${bin}`)));
  wd.on('failed', ({ bin }) => console.log(err(`Failed to repatch: ${bin}`)));
  wd.start();

  process.on('SIGINT', () => {
    console.log('\n' + info('Stopping Watchdog...'));
    wd.stop();
    process.exit(0);
  });
}

module.exports = {
  handlePatchSingle,
  handlePatchAll,
  handleRestore,
  handleStatus,
  handleWatchdog,
};
