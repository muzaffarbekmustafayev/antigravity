#!/usr/bin/env node
/**
 * patcher.js — Antigravity to'liq geo-unlock va binary patch skripti
 */
const bypass = require('./src/bypass');

(async () => {
  console.log('⚡ Antigravity to\'liq patch boshlanmoqda (barcha hududlar uchun)...');
  try {
    const res = await bypass.enable({ force: true });
    console.log(`✅ Patch yakunlandi.`);
    console.log(`   Binary fayllar: ${res.patch.ok} ta`);
    console.log(`   IDE / JS fayllar: ${res.patch.jsPatched || 0} ta`);
    if (res.dns && res.dns.ok) {
      console.log('   DNS Bypass: faol');
    }
  } catch (err) {
    console.error('❌ Xatolik:', err.message);
  }
})();
