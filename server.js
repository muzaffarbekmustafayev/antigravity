/**
 * 🚀 Antigravity Remote Terminal Bot
 * Asosiy ishga tushiruvchi modul (Entry point)
 */

const config = require('./src/config');
const { initBot } = require('./src/bot');
const { startWebhookServer } = require('./src/webhook');

// Global xatoliklarni ushlash
process.on('uncaughtException',  (e) => console.error('UncaughtException:',  e));
process.on('unhandledRejection', (e) => console.error('UnhandledRejection:', e));
process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Antigravity Remote Terminal Bot ishga tushirilmoqda...');
console.log('👑 Admin ID: ' + config.ADMIN_ID);
console.log('🤖 AGY Binary: ' + config.AGY_BIN);
console.log('🎯 Standart model: ' + config.getGlobalModel());
console.log('⚡ Standart tezlik: ' + config.getGlobalEffort());
console.log('📁 Default jild: ' + (config.getDefaultCwd() || '(belgilanmagan)'));
console.log('⏱️ 5-Soatlik Limit: ' + config.getGlobalLimit() + ' ta so\'rov');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. Telegram botni ishga tushirish
const bot = initBot();

// 2. Mahalliy HTTP Webhook API serverini ishga tushirish
startWebhookServer(bot);

console.log('✅ Bot muvaffaqiyatli ishga tushdi va buyruqlarni kutmoqda.');
