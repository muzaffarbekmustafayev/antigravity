/**
 * 🚀 Antigravity Remote Terminal Bot
 * Asosiy bot initsializatsiyasi va modullarni bog'lovchi markaz.
 */

const TelegramBot = require('node-telegram-bot-api');
const https       = require('https');
const os          = require('os');
const config      = require('./config');

const { registerCommands }  = require('./handlers/commands');
const { registerCallbacks } = require('./handlers/callbacks');
const { registerMessages }  = require('./handlers/messages');

function initBot() {
  // Windows lock holatida (Win + L) jarayon muzlab qolmasligi uchun ustuvorlikni oshiramiz
  try {
    if (os.constants && os.constants.priority && os.constants.priority.PRIORITY_ABOVE_NORMAL) {
      os.setPriority(os.constants.priority.PRIORITY_ABOVE_NORMAL);
    }
  } catch (_) {}

  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.TELEGRAM_PROXY || null;

  // HTTPS Keep-Alive agent: Lock holatida socketlar uzilib ketishining oldini oladi
  const keepAliveAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    timeout: 15000,
    maxSockets: 10,
  });

  const requestOptions = {
    agent: keepAliveAgent,
    timeout: 25000,
  };

  if (proxyUrl) {
    requestOptions.proxy = proxyUrl;
  }

  const bot = new TelegramBot(config.TOKEN, {
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 20
      }
    },
    request: requestOptions
  });

  // Polling xatoliklarini qayta ishlash
  let _last409Time = 0;
  let hasAuthError = false;
  bot.on('polling_error', (err) => {
    const errMsg = err ? (err.message || String(err)) : '';

    if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
      if (!hasAuthError) {
        hasAuthError = true;
        console.warn('⚠️ Diqqat: Telegram Bot Token noto\'g\'ri (401 Unauthorized). Polling to\'xtatildi. .env faylida to\'g\'ri BOT_TOKEN kiriting.');
        try { bot.stopPolling(); } catch (_) {}
      }
      return;
    }

    if (errMsg.includes('409 Conflict')) {
      const now = Date.now();
      if (now - _last409Time > 5000) {
        _last409Time = now;
        console.warn('⚠️ Diqqat: Telegram sessiyalari to\'qnashuvi (409 Conflict). Avtomatik tiklanmoqda...');
      }
      return;
    }

    if (
      errMsg.includes('ECONNRESET') ||
      errMsg.includes('ECONNABORTED') ||
      errMsg.includes('EFATAL') ||
      errMsg.includes('ETIMEDOUT') ||
      errMsg.includes('ESOCKETTIMEDOUT') ||
      errMsg.includes('ENOTFOUND') ||
      errMsg.includes('EAI_AGAIN') ||
      errMsg.includes('socket hang up') ||
      errMsg.includes('network')
    ) {
      console.warn(`⚠️ Tarmoq/VPN almashinuvi (${errMsg}), soketlar yangilanmoqda...`);
      try { keepAliveAgent.destroy(); } catch (_) {}
      return;
    }

    console.error('Telegram polling xatosi:', errMsg);
  });

  // 🌐 SOTA VPN va IP o'zgarishini avtomatik kuzatuvchi
  try {
    const { startNetworkWatcher } = require('./network');
    startNetworkWatcher(6000, (curr, prev) => {
      console.log(`🔄 Tarmoq marshruti o'zgardi: ${curr.ip} (${curr.country}) [VPN: ${curr.isVpn ? 'HA' : 'YO\'Q'}]`);
      try { keepAliveAgent.destroy(); } catch (_) {}
    });
  } catch (_) {}

  // Watchdog taymeri: Polling to'xtab qolgan bo'lsa qayta tiklaydi
  setInterval(async () => {
    if (!bot.isPolling() && !hasAuthError) {
      console.log('🔄 Watchdog: Polling to\'xtab qolgan, qayta ishga tushirilmoqda...');
      try {
        await bot.startPolling();
        console.log('✅ Watchdog: Polling tiklandi.');
      } catch (e) {
        console.warn('Watchdog polling xatosi:', e.message);
      }
    }
  }, 10000);
  // Modullarni ro'yxatdan o'tkazish
  registerCommands(bot);
  registerCallbacks(bot);
  registerMessages(bot);

  return bot;
}

module.exports = {
  initBot
};
