const fs = require('fs');
const path = require('path');
const os = require('os');

function clean() {
  console.log('[*] Cleaning cache and temporary files...');
  const targets = ['dist', '.cache'];
  targets.forEach(d => {
    if (fs.existsSync(d)) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
        console.log('[+] Removed: ' + d);
      } catch (_) {}
    }
  });

  // Clean orphan agtmp files in current working directory
  try {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd);
    for (const f of files) {
      if (f.endsWith('.agtmp')) {
        try {
          fs.unlinkSync(path.join(cwd, f));
          console.log('[+] Removed: ' + f);
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Clean temp powershell scripts
  try {
    const tmpDir = os.tmpdir();
    const tmpFiles = fs.readdirSync(tmpDir);
    for (const f of tmpFiles) {
      if (f.startsWith('ag_nrpt_') && f.endsWith('.ps1')) {
        try {
          fs.unlinkSync(path.join(tmpDir, f));
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Clean lingering relay port processes
  try {
    const { freeRelayPort } = require('./src/bypass/dns/relay');
    const killed = freeRelayPort();
    if (killed > 0) {
      console.log(`[+] Terminated ${killed} orphaned process(es) holding relay port.`);
    }
  } catch (_) {}

  // Clean hosts and NRPT bypass entries
  try {
    const { removeHostsEntries } = require('./src/bypass/dns/hosts');
    const { removeNrptRules } = require('./src/bypass/dns/nrpt');
    removeHostsEntries();
    removeNrptRules();
    console.log('[+] Cleaned hosts file and NRPT rules.');
  } catch (_) {}

  console.log('[+] Cleaning completed successfully.');
}

if (require.main === module) {
  clean();
}

module.exports = { clean };
