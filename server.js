/**
 * 🚀 Antigravity Remote Terminal Bot
 * Asosiy ishga tushiruvchi modul (Entry point)
 */

const config = require('./src/config');
const { initBot } = require('./src/bot');
const { startWebhookServer } = require('./src/webhook');
const { cleanupTunnel }      = require('./src/tunnel');
const bypass                 = require('./src/bypass');

const missingConfig = [];
if (!config.TOKEN) missingConfig.push('BOT_TOKEN');
if (!config.ADMIN_ID) missingConfig.push('ADMIN_CHAT_ID');

if (missingConfig.length > 0) {
  console.warn(
    `⚠️ Telegram sozlamalari topilmadi: ${missingConfig.join(', ')}.\n` +
    `Telegram bot kutish rejimida. Web Dashboard va REST API serveri http://0.0.0.0:${config.LOCAL_API_PORT} da faol ishlaydi.`
  );
}

// Global xatoliklarni ushlash
process.on('uncaughtException',  (e) => console.error('UncaughtException:',  e));
process.on('unhandledRejection', (e) => console.error('UnhandledRejection:', e));
process.on('SIGINT',  () => {
  if (bypass.isEnabled && bypass.isEnabled()) {
    try { bypass.disable(); } catch (_) {}
  }
  cleanupTunnel();
  process.exit(0);
});
process.on('SIGTERM', () => {
  if (bypass.isEnabled && bypass.isEnabled()) {
    try { bypass.disable(); } catch (_) {}
  }
  cleanupTunnel();
  process.exit(0);
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Antigravity Remote Terminal Bot ishga tushirilmoqda...');
console.log('👑 Admin ID: ' + config.ADMIN_ID);
console.log('🤖 AGY Binary: ' + config.AGY_BIN);
console.log('🎯 Standart model: ' + config.getGlobalModel());
console.log('⚡ Standart tezlik: ' + config.getGlobalEffort());
console.log('🌍 Hudud yorlig\'i (faqat ko\'rsatish): ' + config.getEffectiveCountry());
console.log('📁 Default jild: ' + (config.getDefaultCwd() || '(belgilanmagan)'));
console.log('⏱️ 5-Soatlik Limit: ' + config.getGlobalLimit() + ' ta so\'rov');

// Joriy IP va VPN holatini tekshirish
try {
  const { getNetworkStatus } = require('./src/network');
  getNetworkStatus().then((net) => {
    if (net.ok) {
      console.log(`🌐 Tashqi IP: ${net.ip} (${net.country}, ${net.city || ''}) ${net.isVpn ? '🛡️ [SOTA VPN FAOL]' : '⚠️ [MAHALLIY PROVAYDER]'}`);
    }
  });
} catch (_) {}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. Telegram botni ishga tushirish (faqat sozlamalar mavjud bo'lsa)
let bot = null;
if (config.TOKEN && config.ADMIN_ID) {
  try {
    bot = initBot();
    console.log('🤖 Telegram bot muvaffaqiyatli ulandi va buyruqlarni kutmoqda.');
  } catch (err) {
    console.error('❌ Telegram bot ishga tushirishda xato:', err.message);
  }
} else {
  console.log('ℹ️ Telegram bot nofaol (.env da BOT_TOKEN yoki ADMIN_CHAT_ID belgilanmagan).');
}

// 2. Mahalliy HTTP Webhook API va Web Dashboard serverini ishga tushirish
startWebhookServer(bot);

// 3. Telegram Menu tugmasini standart rejimga o'tkazish
if (bot && config.ADMIN_ID) {
  setTimeout(() => {
    bot.setChatMenuButton({
      chat_id: config.ADMIN_ID,
      menu_button: { type: 'default' }
    }).then(() => {
      console.log('📱 Telegram Menu tugmasi standart bot rejimiga qaytarildi.');
    }).catch(() => {});
  }, 2500);
}

// Qolgan tunnel jarayonlarini tozalash
cleanupTunnel();

console.log(`✅ Antigravity Remote Terminal faol: http://localhost:${config.LOCAL_API_PORT}`);
