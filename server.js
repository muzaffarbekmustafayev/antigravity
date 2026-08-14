require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { exec }    = require('child_process');
const fs          = require('fs');
const path        = require('path');
const os          = require('os');
const http        = require('http');

// ─── Konfiguratsiya ───────────────────────────────────────────────────────────
const TOKEN          = process.env.BOT_TOKEN;
const ADMIN_ID       = process.env.ADMIN_CHAT_ID;
const MAX_OUTPUT     = 3500;
const LOCAL_API_PORT = parseInt(process.env.LOCAL_API_PORT || '7799');
let   currentDefaultCwd = process.env.DEFAULT_CWD || null;

if (!TOKEN || !ADMIN_ID) {
  console.error("BOT_TOKEN va ADMIN_CHAT_ID .env da bo'lishi shart!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Mavjud AGY modellari ─────────────────────────────────────────────────────
const AVAILABLE_MODELS = [
  { id: 'gemini-3.7-flash',   label: 'Gemini 3.7 Flash',   emoji: '\u26A1',    desc: 'Tez va aqlli (default)', effort: 'high' },
  { id: 'gemini-3.7-pro',     label: 'Gemini 3.7 Pro',     emoji: '\u{1F680}', desc: 'Eng kuchli (yangi)',       effort: 'high' },
  { id: 'gemini-3.6-flash',   label: 'Gemini 3.6 Flash',   emoji: '\u{1F525}', desc: 'Oldingi avlod, tez',       effort: 'high' },
  { id: 'gemini-3.1-pro',     label: 'Gemini 3.1 Pro',     emoji: '\u{1F9E0}', desc: 'Eng kuchli model',        effort: 'high' },
  { id: 'claude-sonnet-4.6',  label: 'Claude Sonnet 4.6',  emoji: '\u{1F916}', desc: 'Anthropic Thinking',      effort: 'high' },
  { id: 'claude-opus-4.6',    label: 'Claude Opus 4.6',    emoji: '\u{1F9BE}', desc: 'Anthropic Opus Thinking', effort: 'high' },
  { id: 'gpt-oss-120b',       label: 'GPT-OSS 120B',       emoji: '\u{1F7E2}', desc: 'Open Source 120B',       effort: 'medium' },
];

// Default limitlar (taxminiy, kunlik)
const MODEL_LIMITS = {
  'gemini-3.7-flash':  { rpm: 15,  rpd: 1500, tpm: '1,000,000' },
  'gemini-3.6-flash':  { rpm: 15,  rpd: 1500, tpm: '1,000,000' },
  'gemini-3.1-pro':    { rpm: 5,   rpd: 50,   tpm: '128,000'   },
  'claude-sonnet-4.6': { rpm: 5,   rpd: 100,  tpm: '64,000'    },
  'claude-opus-4.6':   { rpm: 2,   rpd: 20,   tpm: '32,000'    },
  'gpt-oss-120b':      { rpm: 10,  rpd: 200,  tpm: '128,000'   },
};

const DEFAULT_MODEL = 'gemini-3.7-flash';
let   globalModel   = process.env.DEFAULT_MODEL || DEFAULT_MODEL;

// ─── Sessiyalar ───────────────────────────────────────────────────────────────
const sessions      = new Map();
let   sessionCounter = 0;
const activeSession  = new Map(); // chatId -> sessionId

const createSession = (name) => {
  sessionCounter++;
  const id = 's' + sessionCounter;
  const session = {
    id,
    name:      name || ('Sessiya ' + sessionCounter),
    cwd:       currentDefaultCwd,
    history:   [],
    proc:      null,
    model:     globalModel,
    isNewConv: true,
    createdAt: new Date(),
  };
  sessions.set(id, session);
  return session;
};

// ─── Yordamchi funksiyalar ────────────────────────────────────────────────────
const isAdmin  = (id)   => id.toString() === ADMIN_ID.toString();
const escape   = (text) => String(text).replace(/[`*_[\]()~>#+=|{}.!\\-]/g, '\\$&');
const shortPath = (p)   => String(p).replace(os.homedir(), '~');
const BT = '\`'; // backtick — MarkdownV2 code span uchun

const truncate = (text) => {
  if (text.length > MAX_OUTPUT)
    return text.substring(0, MAX_OUTPUT) + '\n\n[Natija qisqartirildi]';
  return text;
};

const send = (chatId, text, options) =>
  bot.sendMessage(chatId, text, Object.assign({ parse_mode: 'MarkdownV2' }, options || {}))
    .catch(() => bot.sendMessage(chatId, text.replace(/[*_`[\]()~>#+=|{}.!\\-]/g, ''), options || {}));

const editMsg = (chatId, msgId, text, options) =>
  bot.editMessageText(text, Object.assign({
    chat_id: chatId, message_id: msgId, parse_mode: 'MarkdownV2'
  }, options || {})).catch(() => {});

// ─── Asosiy klaviatura ────────────────────────────────────────────────────────
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: '/start'    }, { text: '/sessions' }, { text: '/model'  }],
    [{ text: '/limit'    }, { text: '/ls'       }, { text: '/pwd'    }],
    [{ text: '/kill'     }, { text: '/history'  }, { text: '/sys'    }],
    [{ text: '/setcwd'   }, { text: '/get'      }, { text: '/help'   }],
  ],
  resize_keyboard: true,
  persistent: true,
};

// ─── Model ma'lumoti ──────────────────────────────────────────────────────────
const getModelInfo = (modelId) =>
  AVAILABLE_MODELS.find(m => m.id === modelId) ||
  { id: modelId, label: modelId, emoji: '\u{1F916}', desc: '?' };

// ─── Sessiya tugmalari ────────────────────────────────────────────────────────
const buildSessionKeyboard = (chatId) => {
  const activeSid = activeSession.get(chatId.toString());
  const buttons   = [];
  for (const [sid, sess] of sessions) {
    const isAct = sid === activeSid;
    const mInfo = getModelInfo(sess.model);
    const label = (isAct ? '\u2705 ' : '') + sess.name + ' [' + mInfo.emoji + ' ' + mInfo.label + ']';
    buttons.push([
      { text: label,       callback_data: 'sel_' + sid   },
      { text: '\u2716 Yopish', callback_data: 'close_' + sid }
    ]);
  }
  buttons.push([{ text: '\u2795 Yangi sessiya', callback_data: 'new_session' }]);
  return { inline_keyboard: buttons };
};

const sessionsText = (chatId) => {
  const activeSid = activeSession.get(chatId.toString());
  if (sessions.size === 0)
    return '\u{1F4CB} *Sessiyalar yo\'q*\n\nYangi sessiya yaratish uchun \u2795 tugmani bosing\\.';
  const lines = [];
  for (const [sid, sess] of sessions) {
    const isAct  = sid === activeSid;
    const status = isAct ? '\u2705 *aktiv*' : '\u{1F4A4} kutmoqda';
    const mInfo  = getModelInfo(sess.model);
    const run    = sess.proc ? ' \u2699\uFE0F _ishlayapti_' : '';
    lines.push(status + ' \u2014 ' + BT + escape(sess.name) + BT + ' \u{1F916} _' + escape(mInfo.emoji + ' ' + mInfo.label) + '_' + run);
  }
  return '\u{1F4CB} *Mavjud sessiyalar:*\n\n' + lines.join('\n');
};

// ─── Model klaviaturasi ───────────────────────────────────────────────────────
const buildModelKeyboard = (currentModel) => {
  const rows = [];
  for (let i = 0; i < AVAILABLE_MODELS.length; i += 2) {
    const row = [];
    for (let j = i; j < Math.min(i + 2, AVAILABLE_MODELS.length); j++) {
      const m   = AVAILABLE_MODELS[j];
      const isA = m.id === currentModel;
      row.push({
        text:          (isA ? '\u2705 ' : '') + m.emoji + ' ' + m.label,
        callback_data: 'setmodel_' + m.id
      });
    }
    rows.push(row);
  }
  rows.push([{ text: '\u274C Yopish', callback_data: 'model_close' }]);
  return { inline_keyboard: rows };
};

const modelText = (sess) => {
  const m = getModelInfo(sess.model);
  const lines = AVAILABLE_MODELS.map(x => {
    const active = x.id === sess.model ? ' \u2705' : '';
    return '\u2022 *' + escape(x.emoji + ' ' + x.label) + '*' + active + ' \u2014 _' + escape(x.desc) + '_';
  });
  return (
    '\u{1F916} *Model Tanlash*\n\n' +
    '*Hozirgi sessiya:* ' + BT + escape(sess.name) + BT + '\n' +
    '*Faol model:* ' + escape(m.emoji + ' ' + m.label) + ' \u2014 _' + escape(m.desc) + '_\n\n' +
    '*Barcha modellar:*\n' +
    lines.join('\n') + '\n\n' +
    '_Tanlash uchun tugmani bosing:_'
  );
};

// ─── Limit matni ──────────────────────────────────────────────────────────────
const buildLimitText = (chatId) => {
  const sid  = activeSession.get(chatId);
  const sess = sessions.get(sid);
  const mid  = sess ? sess.model : globalModel;
  const m    = getModelInfo(mid);
  const lim  = MODEL_LIMITS[mid] || { rpm: '?', rpd: '?', tpm: '?' };

  let totalCmds = 0;
  const sessLines = [];
  for (const [, s] of sessions) {
    totalCmds += s.history.length;
    const sm = getModelInfo(s.model);
    sessLines.push('\u2022 ' + BT + escape(s.name) + BT + ': ' + s.history.length + ' buyruq \u2014 ' + escape(sm.emoji + ' ' + sm.label));
  }

  const usedPct = typeof lim.rpd === 'number'
    ? Math.min(100, Math.round((totalCmds / lim.rpd) * 100)) : 0;
  const filled  = Math.floor(usedPct / 10);
  const bar     = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled) + ' ' + usedPct + '%';

  return (
    '\u{1F4CA} *AGY Limit \\& Statistika*\n' +
    '\u2501'.repeat(20) + '\n' +
    '\u{1F916} *Model:* ' + escape(m.emoji + ' ' + m.label) + '\n' +
    '_' + escape(m.desc) + '_\n\n' +
    '\u{1F4C8} *Taxminiy Limitlar \\(' + escape(mid) + '\\):*\n' +
    '\u26A1 RPM: ' + BT + String(lim.rpm) + BT + ' so\'rov/daqiqa\n' +
    '\u{1F4C5} RPD: ' + BT + String(lim.rpd) + BT + ' so\'rov/kun\n' +
    '\u{1F524} TPM: ' + BT + String(lim.tpm) + BT + ' token/daqiqa\n\n' +
    '\u{1F4CA} *Bugungi Ishlatish:*\n' +
    '\u{1F522} Jami buyruqlar: ' + BT + String(totalCmds) + BT + '\n' +
    '\u{1F9EE} Taxminiy tokenlar: ' + BT + '~' + String(totalCmds * 500) + BT + '\n' +
    '\u{1F4C9} Limit: ' + BT + '[' + bar + ']' + BT + '\n\n' +
    '\u{1F4BB} *Sessiyalar:*\n' +
    (sessLines.length > 0 ? sessLines.join('\n') : '_Sessiya yo\'q_') + '\n\n' +
    '\u26A0\uFE0F _Limitlar taxminiy\\. Haqiqiy limitlar farqli bo\'lishi mumkin_\n' +
    '\u2501'.repeat(20) + '\n' +
    '\u{1F4A1} Model o\'zgartirish: /model'
  );
};

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  if (!isAdmin(msg.chat.id)) return bot.sendMessage(msg.chat.id, 'Ruxsat yo\'q.');

  if (!currentDefaultCwd) {
    return send(msg.chat.id,
      '\u{1F916} *Antigravity Bot ishga tushdi\\!*\n\n\u26A0\uFE0F Ishchi jild belgilanmagan\\.\n/setcwd buyrug\'idan foydalaning:\n\n' +
      BT + '/setcwd C:\\\\Users\\\\muzaf\\\\Desktop\\\\loyiha' + BT
    );
  }

  if (sessions.size === 0) {
    const sess = createSession('Asosiy sessiya');
    activeSession.set(msg.chat.id.toString(), sess.id);
  }

  const sid   = activeSession.get(msg.chat.id.toString());
  const sess  = sessions.get(sid);
  const mInfo = getModelInfo(sess ? sess.model : globalModel);

  const statusLine = (
    '\n\u{1F916} *Antigravity Remote Terminal*\n' +
    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
    '\u{1F4C1} Jild: ' + BT + escape(shortPath(currentDefaultCwd)) + BT + '\n' +
    '\u{1F916} Model: ' + BT + escape(mInfo.emoji + ' ' + mInfo.label) + BT + '\n' +
    '\u{1F4BB} OS: ' + BT + escape(os.type()) + ' ' + escape(os.release()) + BT + '\n' +
    '\u{1F4CA} RAM: ' + BT + Math.round(os.freemem() / 1e6) + ' MB / ' + Math.round(os.totalmem() / 1e6) + ' MB' + BT + '\n' +
    '\u23F1 Uptime: ' + BT + Math.round(process.uptime()) + ' sek' + BT + '\n' +
    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n'
  );

  send(msg.chat.id, statusLine, { reply_markup: MAIN_KEYBOARD });
});

// ─── /sessions ────────────────────────────────────────────────────────────────
bot.onText(/\/sessions/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const chatId = msg.chat.id.toString();
  bot.sendMessage(chatId, sessionsText(chatId), {
    parse_mode:   'MarkdownV2',
    reply_markup: buildSessionKeyboard(chatId)
  });
});

// ─── /model ───────────────────────────────────────────────────────────────────
bot.onText(/\/model/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const chatId = msg.chat.id.toString();
  let sid  = activeSession.get(chatId);
  let sess = sessions.get(sid);
  if (!sess) {
    sess = createSession('Asosiy sessiya');
    activeSession.set(chatId, sess.id);
  }
  bot.sendMessage(chatId, modelText(sess), {
    parse_mode:   'MarkdownV2',
    reply_markup: buildModelKeyboard(sess.model)
  });
});

// ─── /limit ───────────────────────────────────────────────────────────────────
bot.onText(/\/limit/, async (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const chatId = msg.chat.id.toString();
  send(chatId, buildLimitText(chatId), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '\u{1F504} Yangilash',   callback_data: 'refresh_limit' },
          { text: '\u{1F916} Model tanlash', callback_data: 'open_models'   },
        ]
      ]
    }
  });
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const help = (
    '\u{1F680} *Antigravity Remote Terminal Bot*\n\n' +
    '*Asosiy buyruqlar:*\n' +
    BT + '/start' + BT + '    \u2014 Botni boshlash \\& holat\n' +
    BT + '/sessions' + BT + ' \u2014 Sessiyalar ro\'yxati\n' +
    BT + '/model' + BT + '    \u2014 AI modelni tanlash \u2B50\n' +
    BT + '/limit' + BT + '    \u2014 Limit \\& statistika \u{1F4CA}\n' +
    BT + '/setcwd' + BT + '   \u2014 Ishchi jildni o\'zgartirish\n' +
    BT + '/get' + BT + '      \u2014 Faylni Telegram orqali yuborish\n\n' +
    '*Sessiya buyruqlari:*\n' +
    BT + '/pwd' + BT + '      \u2014 Aktiv papka\n' +
    BT + '/ls' + BT + '       \u2014 Papka mazmuni\n' +
    BT + '/history' + BT + '  \u2014 So\'nggi buyruqlar\n' +
    BT + '/kill' + BT + '     \u2014 Aktiv jarayonni to\'xtatish\n' +
    BT + '/sys' + BT + '      \u2014 Tizim ma\'lumotlari\n\n' +
    '_Xabar yuborsangiz, aktiv sessiyaga AGY orqali yuboriladi_\n' +
    '_Model: /model orqali har sessiya uchun alohida tanlang_'
  );
  send(msg.chat.id, help);
});

// ─── /setcwd ──────────────────────────────────────────────────────────────────
bot.onText(/^\/setcwd(.*)$/, (msg, match) => {
  if (!isAdmin(msg.chat.id)) return;
  const chatId = msg.chat.id.toString();
  const arg    = (match[1] || '').trim();

  if (!arg) {
    return send(chatId,
      '\u{1F4C1} *Hozirgi default jild:*\n' + BT + escape(currentDefaultCwd || '(belgilanmagan)') + BT + '\n\n_O\'zgartirish uchun: /setcwd <yangi yo\'l>_'
    );
  }

  const resolved = path.resolve(arg);
  if (!fs.existsSync(resolved))
    return send(chatId, '\u274C Papka topilmadi:\n' + BT + escape(resolved) + BT);
  if (!fs.statSync(resolved).isDirectory())
    return send(chatId, '\u274C Bu papka emas:\n' + BT + escape(resolved) + BT);

  const old         = currentDefaultCwd;
  currentDefaultCwd = resolved;

  send(chatId,
    '\u2705 *Default jild o\'zgartirildi\\!*\n\n' +
    '\u{1F4C1} Eski: ' + BT + escape(shortPath(old || '?')) + BT + '\n' +
    '\u{1F4C1} Yangi: ' + BT + escape(shortPath(currentDefaultCwd)) + BT + '\n\n' +
    '_Yangi sessiyalar shu jilddan boshlanadi\\._'
  );
});

// ─── /pwd ─────────────────────────────────────────────────────────────────────
bot.onText(/\/pwd/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const chatId = msg.chat.id.toString();
  const sess   = sessions.get(activeSession.get(chatId));
  if (!sess) return send(chatId, '\u26A0\uFE0F Aktiv sessiya yo\'q\\. /sessions orqali tanlang\\.');
  send(chatId, '\u{1F4C1} *' + escape(sess.name) + '* papkasi:\n' + BT + escape(sess.cwd) + BT);
});

// ─── /ls ──────────────────────────────────────────────────────────────────────
bot.onText(/\/ls/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const chatId = msg.chat.id.toString();
  const sess   = sessions.get(activeSession.get(chatId));
  if (!sess) return send(chatId, '\u26A0\uFE0F Aktiv sessiya yo\'q\\. /sessions orqali tanlang\\.');
  try {
    const items = fs.readdirSync(sess.cwd, { withFileTypes: true });
    const dirs  = items.filter(i => i.isDirectory()).map(i => '\u{1F4C1} ' + i.name);
    const files = items.filter(i => !i.isDirectory()).map(i => '\u{1F4C4} ' + i.name);
    const all   = [...dirs, ...files].join('\n');
    send(chatId, '\u{1F4C1} *' + escape(shortPath(sess.cwd)) + '*\n\n' + escape(all || '(bo\'sh)'));
  } catch (e) {
    send(chatId, '\u274C ' + BT + escape(e.message) + BT);
  }
});

// ─── /sys ─────────────────────────────────────────────────────────────────────
bot.onText(/\/sys/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const cpus = os.cpus();
  send(msg.chat.id,
    '\u2699\uFE0F *Tizim Ma\'lumotlari*\n' +
    '\u{1F5A5} OS: ' + BT + escape(os.type()) + ' ' + escape(os.release()) + BT + '\n' +
    '\u{1F9E0} CPU: ' + BT + escape(cpus[0].model) + BT + ' \\(' + cpus.length + ' yadroli\\)\n' +
    '\u{1F4CA} RAM: ' + BT + Math.round(os.freemem() / 1e6) + ' MB bo\'sh / ' + Math.round(os.totalmem() / 1e6) + ' MB jami' + BT + '\n' +
    '\u{1F464} User: ' + BT + escape(os.userInfo().username) + BT + '\n' +
    '\u{1F3E0} Home: ' + BT + escape(os.homedir()) + BT + '\n' +
    '\u23F1 Uptime: ' + BT + Math.round(os.uptime() / 60) + ' daqiqa' + BT
  );
});

// ─── /history ─────────────────────────────────────────────────────────────────
bot.onText(/\/history/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const chatId = msg.chat.id.toString();
  const sess   = sessions.get(activeSession.get(chatId));
  if (!sess) return send(chatId, '\u26A0\uFE0F Aktiv sessiya yo\'q\\.');
  if (!sess.history.length) return send(chatId, '\u{1F4DC} *' + escape(sess.name) + '*: tarix bo\'sh\\.');
  const list = sess.history.slice(-20).map((c, i) => (i + 1) + '\\. ' + BT + escape(c) + BT).join('\n');
  send(chatId, '\u{1F4DC} *' + escape(sess.name) + ' \u2014 So\'nggi buyruqlar:*\n\n' + list);
});

// ─── /kill ────────────────────────────────────────────────────────────────────
bot.onText(/\/kill/, (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const chatId = msg.chat.id.toString();
  const sess   = sessions.get(activeSession.get(chatId));
  if (!sess)      return send(chatId, '\u26A0\uFE0F Aktiv sessiya yo\'q\\.');
  if (!sess.proc) return send(chatId, '\u26A0\uFE0F *' + escape(sess.name) + '*: ishlayotgan jarayon yo\'q\\.');
  try {
    process.kill(-sess.proc.pid);
    sess.proc = null;
    send(chatId, '\u{1F6D1} *' + escape(sess.name) + '*: jarayon to\'xtatildi\\.');
  } catch (e) {
    send(chatId, '\u274C To\'xtatib bo\'lmadi: ' + BT + escape(e.message) + BT);
  }
});

// ─── /get ─────────────────────────────────────────────────────────────────────
bot.onText(/^\/get(.*)$/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) return;
  const chatId = msg.chat.id.toString();
  const arg    = (match[1] || '').trim();

  if (!arg) {
    const base = currentDefaultCwd ? shortPath(currentDefaultCwd) : '~';
    return send(chatId,
      '\u{1F4E4} *Fayl yuborish:*\n\n' + BT + '/get <fayl yo\'li>' + BT +
      '\n\n_Nisbiy yo\'l uchun asos: ' + BT + escape(base) + BT + '_'
    );
  }

  const sid     = activeSession.get(chatId);
  const sess    = sessions.get(sid);
  const baseCwd = (sess && sess.cwd) || currentDefaultCwd || process.cwd();
  const filePath = path.isAbsolute(arg) ? arg : path.resolve(baseCwd, arg);

  if (!fs.existsSync(filePath))
    return send(chatId, '\u274C Fayl topilmadi:\n' + BT + escape(filePath) + BT);
  if (fs.statSync(filePath).isDirectory())
    return send(chatId, '\u274C Bu papka, fayl emas:\n' + BT + escape(filePath) + BT);

  const size = fs.statSync(filePath).size;
  if (size > 50 * 1024 * 1024)
    return send(chatId, '\u274C Fayl juda katta \\(' + Math.round(size / 1024 / 1024) + ' MB\\)\\. Telegram 50MB gacha\\.');

  try {
    await bot.sendDocument(chatId, filePath, {
      caption:    '\u{1F4C4} ' + BT + escape(path.basename(filePath)) + BT + '\n\u{1F4C1} ' + BT + escape(shortPath(filePath)) + BT,
      parse_mode: 'MarkdownV2'
    });
  } catch (e) {
    send(chatId, '\u274C Yuborishda xato: ' + BT + escape(e.message) + BT);
  }
});

// ─── Asosiy xabarlar ──────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  if (!isAdmin(chatId))
    return bot.sendMessage(chatId, 'Kechirasiz, siz bu botdan foydalana olmaysiz.');

  const text = (msg.text || '').trim();
  if (!text || text.startsWith('/')) return;

  let sid  = activeSession.get(chatId);
  let sess = sessions.get(sid);

  if (!sess) {
    sess = createSession('Asosiy sessiya');
    activeSession.set(chatId, sess.id);
    sid = sess.id;
  }

  if (!currentDefaultCwd)
    return send(chatId, '\u26A0\uFE0F Ishchi jild belgilanmagan\\. /setcwd buyrug\'ini ishlating\\.');

  // cd
  if (text.startsWith('cd ')) {
    const target   = text.substring(3).trim();
    const resolved = path.resolve(sess.cwd, target);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      sess.cwd = resolved;
      send(chatId, '\u{1F4C1} *' + escape(sess.name) + '*: papka o\'zgardi\n' + BT + escape(sess.cwd) + BT);
    } else {
      send(chatId, '\u274C Papka topilmadi:\n' + BT + escape(resolved) + BT);
    }
    return;
  }

  const currentModel = sess.model || globalModel;
  const mInfo        = getModelInfo(currentModel);
  const effortVal    = mInfo.effort || 'high';
  const modelFlag    = '--model "' + currentModel + '" --effort ' + effortVal;

  const agyContinue  = !sess.isNewConv;
  sess.isNewConv     = false;

  const safeText    = text.replace(/\\/g, '/').replace(/"/g, '\\"');
  const safeCwd     = sess.cwd.replace(/\\/g, '/');
  const execCommand = (
    'agy ' + (agyContinue ? '-c ' : '') +
    modelFlag +
    ' --dangerously-skip-permissions --mode accept-edits --print-timeout 15m' +
    ' -p "MUHIM: Faqat AMAL qil. Reja tuzma. Ishchi jild: ' + safeCwd + '.' +
    ' TELEGRAM API: curl.exe -s \\"http://127.0.0.1:' + LOCAL_API_PORT + '/send-file\\"' +
    ' -G --data-urlencode \\"file=TO\'LIQ_YO\'L\\".' +
    ' Xabar: curl.exe -s \\"http://127.0.0.1:' + LOCAL_API_PORT + '/send-msg\\"' +
    ' -G --data-urlencode \\"text=XABAR\\".' +
    ' Foydalanuvchi: ' + safeText + '"'
  );

  const modelBadge = escape(mInfo.emoji + ' ' + mInfo.label);
  const statusText = '\u23F3 *' + escape(sess.name) + '* \\[' + modelBadge + '\\]: bajarilmoqda\\.\\.\\.';

  bot.sendMessage(chatId, statusText, {
    parse_mode:          'MarkdownV2',
    reply_to_message_id: msg.message_id,
    reply_markup: {
      inline_keyboard: [[
        { text: '\u{1F6D1} To\'xtatish', callback_data: 'kill_' + sid     },
        { text: '\u{1F916} Model',       callback_data: 'open_models'      },
        { text: '\u{1F4CA} Limit',       callback_data: 'refresh_limit'    },
      ]]
    }
  }).then(sentMsg => {
    sess.history.push(text);
    if (sess.history.length > 50) sess.history.shift();

    const child = exec(execCommand, {
      cwd:     sess.cwd,
      timeout: 900000,
      detached: true
    }, (error, stdout, stderr) => {
      sess.proc = null;

      let output = '';
      if (stdout)           output += stdout;
      if (stderr)           output += (stdout ? '\nSTDERR:\n' : '') + stderr;
      if (!output && error) output  = 'Exit code: ' + (error.code || '?');
      if (!output)          output  = 'Bajarildi (natija qaytmadi).';

      output = truncate(output);
      editMsg(chatId, sentMsg.message_id, statusText);

      const reply = '\u2705 *' + escape(sess.name) + ' \\[' + modelBadge + '\\] \u2014 Natija:*\n```\n' + escape(output) + '\n```';
      send(chatId, reply, { reply_to_message_id: msg.message_id }).catch(() =>
        bot.sendMessage(chatId, 'Natija:\n\n' + output.substring(0, 3500))
      );
    });

    if (child && child.pid) sess.proc = child;
  }).catch(e => console.error('Xabar yuborishda xato:', e));
});

// ─── Callback tugmalar ────────────────────────────────────────────────────────
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id.toString();
  if (!isAdmin(chatId))
    return bot.answerCallbackQuery(query.id, { text: 'Ruxsat yo\'q!', show_alert: true });

  const data = query.data;

  // Yangi sessiya
  if (data === 'new_session') {
    const sess = createSession();
    activeSession.set(chatId, sess.id);
    bot.answerCallbackQuery(query.id, { text: sess.name + ' yaratildi!' });
    return bot.editMessageText(sessionsText(chatId), {
      chat_id: chatId, message_id: query.message.message_id,
      parse_mode: 'MarkdownV2', reply_markup: buildSessionKeyboard(chatId)
    }).catch(() => {});
  }

  // Sessiya tanlash
  if (data.startsWith('sel_')) {
    const sid = data.substring(4);
    if (!sessions.has(sid))
      return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!', show_alert: true });
    activeSession.set(chatId, sid);
    const sess = sessions.get(sid);
    bot.answerCallbackQuery(query.id, { text: sess.name + ' tanlandi' });
    return bot.editMessageText(sessionsText(chatId), {
      chat_id: chatId, message_id: query.message.message_id,
      parse_mode: 'MarkdownV2', reply_markup: buildSessionKeyboard(chatId)
    }).catch(() => {});
  }

  // Sessiyani yopish
  if (data.startsWith('close_')) {
    const sid  = data.substring(6);
    const sess = sessions.get(sid);
    if (!sess)
      return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!', show_alert: true });
    if (sess.proc) { try { process.kill(-sess.proc.pid); } catch (_) {} }
    const name = sess.name;
    sessions.delete(sid);
    if (activeSession.get(chatId) === sid) {
      const first = sessions.keys().next().value;
      first ? activeSession.set(chatId, first) : activeSession.delete(chatId);
    }
    bot.answerCallbackQuery(query.id, { text: name + ' yopildi' });
    return bot.editMessageText(sessionsText(chatId), {
      chat_id: chatId, message_id: query.message.message_id,
      parse_mode: 'MarkdownV2', reply_markup: buildSessionKeyboard(chatId)
    }).catch(() => {});
  }

  // Jarayonni to'xtatish
  if (data.startsWith('kill_')) {
    const sid  = data.substring(5);
    const sess = sessions.get(sid);
    if (!sess)
      return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!', show_alert: true });
    if (!sess.proc)
      return bot.answerCallbackQuery(query.id, { text: 'Jarayon tugagan.', show_alert: true });
    try {
      process.kill(-sess.proc.pid);
      sess.proc = null;
      bot.answerCallbackQuery(query.id, { text: 'Jarayon to\'xtatildi!' });
      editMsg(chatId, query.message.message_id,
        (query.message.text || '') + '\n\nJARAYON TO\'XTATILDI'
      );
    } catch (e) {
      bot.answerCallbackQuery(query.id, { text: 'Xato: ' + e.message, show_alert: true });
    }
    return;
  }

  // Model oynasini ochish
  if (data === 'open_models') {
    let sid  = activeSession.get(chatId);
    let sess = sessions.get(sid);
    if (!sess) {
      sess = createSession('Asosiy sessiya');
      activeSession.set(chatId, sess.id);
    }
    bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId, modelText(sess), {
      parse_mode:   'MarkdownV2',
      reply_markup: buildModelKeyboard(sess.model)
    });
  }

  // Model o'rnatish
  if (data.startsWith('setmodel_')) {
    const modelId = data.substring(9);
    const mInfo   = AVAILABLE_MODELS.find(m => m.id === modelId);
    if (!mInfo)
      return bot.answerCallbackQuery(query.id, { text: 'Model topilmadi!', show_alert: true });

    let sid  = activeSession.get(chatId);
    let sess = sessions.get(sid);
    if (!sess) {
      sess = createSession('Asosiy sessiya');
      activeSession.set(chatId, sess.id);
    }

    sess.model  = modelId;
    globalModel = modelId;

    bot.answerCallbackQuery(query.id, { text: mInfo.emoji + ' ' + mInfo.label + ' tanlandi!' });
    return bot.editMessageText(modelText(sess), {
      chat_id:      chatId,
      message_id:   query.message.message_id,
      parse_mode:   'MarkdownV2',
      reply_markup: buildModelKeyboard(sess.model)
    }).catch(() => {
      send(chatId, '\u2705 *Model o\'zgartirildi\\!*\n' + escape(mInfo.emoji + ' ' + mInfo.label) + ' \u2014 _' + escape(mInfo.desc) + '_');
    });
  }

  // Model yopish
  if (data === 'model_close') {
    bot.answerCallbackQuery(query.id);
    return bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
  }

  // Limit yangilash
  if (data === 'refresh_limit') {
    bot.answerCallbackQuery(query.id, { text: 'Yangilanmoqda...' });
    return bot.editMessageText(buildLimitText(chatId), {
      chat_id:    chatId,
      message_id: query.message.message_id,
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[
          { text: '\u{1F504} Yangilash',     callback_data: 'refresh_limit' },
          { text: '\u{1F916} Model tanlash', callback_data: 'open_models'   },
        ]]
      }
    }).catch(() => {});
  }
});

// ─── Global xatoliklar ────────────────────────────────────────────────────────
process.on('uncaughtException',  (e) => console.error('UncaughtException:',  e));
process.on('unhandledRejection', (e) => console.error('UnhandledRejection:', e));

// ─── Local HTTP API ───────────────────────────────────────────────────────────
const localApiServer = http.createServer(async (req, res) => {
  const parsed   = new URL(req.url, 'http://127.0.0.1:' + LOCAL_API_PORT);
  const endpoint = parsed.pathname;
  const params   = Object.fromEntries(parsed.searchParams);

  res.setHeader('Content-Type', 'application/json');

  if (endpoint === '/send-file') {
    const filePath = params.file;
    if (!filePath) { res.writeHead(400); return res.end(JSON.stringify({ ok: false, error: 'file parametri yo\'q' })); }
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(currentDefaultCwd || process.cwd(), filePath);
    if (!fs.existsSync(absPath)) { res.writeHead(404); return res.end(JSON.stringify({ ok: false, error: 'Fayl topilmadi: ' + absPath })); }
    try {
      await bot.sendDocument(ADMIN_ID, absPath, { caption: params.caption || path.basename(absPath) });
      res.writeHead(200); res.end(JSON.stringify({ ok: true, sent: absPath }));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (endpoint === '/send-msg') {
    const text = params.text || '(xabar yo\'q)';
    try {
      await bot.sendMessage(ADMIN_ID, text);
      res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  res.writeHead(404); res.end(JSON.stringify({ ok: false, error: 'Noma\'lum endpoint' }));
});

localApiServer.listen(LOCAL_API_PORT, '127.0.0.1', () =>
  console.log('Local API: http://127.0.0.1:' + LOCAL_API_PORT)
);

console.log('Antigravity Multi-Session Bot ishga tushdi');
console.log('Admin ID: ' + ADMIN_ID);
console.log('Default model: ' + globalModel);
console.log('Default jild: ' + (currentDefaultCwd || '(belgilanmagan)'));

if (!currentDefaultCwd) {
  setTimeout(() => {
    bot.sendMessage(ADMIN_ID,
      'Antigravity Bot ishga tushdi!\n\nDEFAULT_CWD belgilanmagan.\n/setcwd buyrug\'i bilan ishchi jildni kiriting.'
    ).catch(() => {});
  }, 2000);
}
