#!/usr/bin/env node
/**
 * patcher.js — Antigravity to'liq geo-unlock va binary patch skripti
 */
const bypass = require('./src/bypass');

(async () => {
  console.log('⚡ Starting Antigravity regional unlock and binary patch...');
  try {
    const res = await bypass.enable({ force: true });
    console.log(`✅ Patch completed successfully.`);
    console.log(`   Binary files: ${res.patch.ok}`);
    console.log(`   IDE / JS files: ${res.patch.jsPatched || 0}`);
    if (res.dns && res.dns.ok) {
      console.log('   SmartDNS Bypass: Active');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
