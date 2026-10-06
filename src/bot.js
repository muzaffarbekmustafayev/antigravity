const TelegramBot = require('node-telegram-bot-api');
const { exec }    = require('child_process');
const fs          = require('fs');
const path        = require('path');
const config      = require('./config');
const { getModelInfo, getEffortInfo } = require('./models');
const { recordRequest, get5HourStats } = require('./limits');
const {
  sessions,
  activeSession,
  renamePrompt,
  setcwdPrompt,
  createSession,
  getSession,
  getActiveSession,
  setActiveSession,
  closeSession,
  saveSessions
} = require('./sessions');
const { saveChanges } = require('./git-saver');
const ui = require('./ui');

function initBot() {
  const bot = new TelegramBot(config.TOKEN, { polling: true });

  bot.on('polling_error', (err) => {
    if (err && err.message && err.message.includes('409 Conflict')) {
      console.warn('⚠️ Diqqat: Boshqa bot instansiyasi ishga tushgan (409 Conflict). Faqat bitta bot instansiyasi ishlashi kerak.');
    } else {
      console.error('Telegram polling xatosi:', err.message);
    }
  });

  const sendHtml = (chatId, text, options) =>
    bot.sendMessage(chatId, text, Object.assign({ parse_mode: 'HTML' }, options || {}))
      .catch((err) => {
        console.error('sendHtml xatosi:', err.message);
        const clean = text.replace(/<[^>]*>/g, '');
        return bot.sendMessage(chatId, clean, options || {});
      });

  const editHtml = (chatId, msgId, text, options) =>
    bot.editMessageText(text, Object.assign({
      chat_id: chatId, message_id: msgId, parse_mode: 'HTML'
    }, options || {})).catch(() => {});

  // ─── /start ─────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return bot.sendMessage(msg.chat.id, 'Ruxsat yo\'q.');

    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    const mInfo  = getModelInfo(sess ? sess.model : config.getGlobalModel());
    const effInfo = getEffortInfo(sess ? sess.effort : config.getGlobalEffort());

    const welcome = (
      '🚀 <b>Antigravity Remote Terminal Bot ishga tushdi!</b>\n' +
      '━'.repeat(26) + '\n' +
      `⭐ <b>Faol Sessiya:</b> <code>${ui.escapeHtml(sess ? sess.name : 'Asosiy')}</code>\n` +
      `📁 <b>Ishchi jild:</b> <code>${ui.escapeHtml(ui.shortPath(config.getDefaultCwd() || '(belgilanmagan)'))}</code>\n` +
      `🤖 <b>Model:</b> ${mInfo.emoji} <b>${ui.escapeHtml(mInfo.label)}</b>\n` +
      `⚡ <b>Tezlik (Effort):</b> ${effInfo.emoji} <b>${ui.escapeHtml(effInfo.label)}</b>\n` +
      `⏱️ <b>5-Soatlik Limit:</b> <b>${config.getGlobalLimit()} ta so'rov</b>\n` +
      '━'.repeat(26) + '\n\n' +
      '💡 <i>Xabar yozing — bot uni Google Antigravity (AGY) agenti orqali tezda bajaradi!</i>\n' +
      '<i>Quyidagi klaviaturadan foydalanib sessiya, model va saqlashni boshqaring.</i>'
    );

    sendHtml(chatId, welcome, { reply_markup: ui.MAIN_KEYBOARD });
  });

  // ─── Sessiyalar ─────────────────────────────────────────────────────────────
  bot.onText(/\/sessions|^📂 Sessiyalar$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    sendHtml(chatId, ui.buildSessionsListText(chatId), {
      reply_markup: ui.buildSessionsKeyboard(chatId)
    });
  });

  // ─── Model ──────────────────────────────────────────────────────────────────
  bot.onText(/\/model|^🤖 Model$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    const curMod = sess ? sess.model : config.getGlobalModel();
    const curEff = sess ? sess.effort : config.getGlobalEffort();

    sendHtml(chatId, ui.buildModelText(curMod, curEff), {
      reply_markup: ui.buildModelKeyboard(sess ? sess.id : null)
    });
  });

  // ─── Tezlik (Effort) ────────────────────────────────────────────────────────
  bot.onText(/\/effort|\/speed|^⚡ Tezlik$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    const curMod = sess ? sess.model : config.getGlobalModel();
    const curEff = sess ? sess.effort : config.getGlobalEffort();

    sendHtml(chatId, ui.buildEffortText(curEff, curMod), {
      reply_markup: ui.buildEffortKeyboard(sess ? sess.id : null)
    });
  });

  // ─── 5-Soatlik Limit ────────────────────────────────────────────────────────
  bot.onText(/\/limit|^📊 5-Soatlik Limit$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    sendHtml(chatId, ui.buildLimitText(chatId), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Yangilash',     callback_data: 'refresh_limit' },
            { text: '🤖 Model tanlash', callback_data: 'open_models' },
            { text: '⚡ Tezlik',        callback_data: 'open_efforts' }
          ]
        ]
      }
    });
  });

  // ─── O'zgarishlarni Saqlash (Git Commit / Save) ──────────────────────────────
  bot.onText(/\/save|^💾 Saqlash$|^💾 O'zgarishlarni saqlash$/, async (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const res = await saveChanges(chatId);
    sendHtml(chatId, res.message);
  });

  // ─── Papka (pwd) ────────────────────────────────────────────────────────────
  bot.onText(/\/pwd|^📍 Papka \(pwd\)$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    sendHtml(chatId, `📍 <b>${ui.escapeHtml(sess.name)}</b> ishchi jildi:\n<code>${ui.escapeHtml(sess.cwd)}</code>`);
  });

  // ─── Fayllar (ls) ───────────────────────────────────────────────────────────
  bot.onText(/\/ls|^📁 Fayllar \(ls\)$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    try {
      const items = fs.readdirSync(sess.cwd, { withFileTypes: true });
      const dirs  = items.filter(i => i.isDirectory()).map(i => `📁 ${ui.escapeHtml(i.name)}/`);
      const files = items.filter(i => !i.isDirectory()).map(i => `📄 ${ui.escapeHtml(i.name)}`);
      const all   = [...dirs, ...files].join('\n');
      sendHtml(chatId, `📁 <b>${ui.escapeHtml(ui.shortPath(sess.cwd))}</b> mazmuni:\n\n<pre>${all || '(bo\'sh jild)'}</pre>`);
    } catch (e) {
      sendHtml(chatId, `❌ Xatolik: <code>${ui.escapeHtml(e.message)}</code>`);
    }
  });

  // ─── Tarix ──────────────────────────────────────────────────────────────────
  bot.onText(/\/history|^📜 Tarix$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    if (!sess.history.length) return sendHtml(chatId, `📜 <b>${ui.escapeHtml(sess.name)}</b>: buyruqlar tarixi bo'sh.`);

    const list = sess.history.slice(-20).map((c, i) => `${i + 1}. <code>${ui.escapeHtml(c)}</code>`).join('\n');
    sendHtml(chatId, `📜 <b>${ui.escapeHtml(sess.name)} — So'nggi buyruqlar:</b>\n\n${list}`);
  });

  // ─── To'xtatish ─────────────────────────────────────────────────────────────
  bot.onText(/\/kill|^🛑 To'xtatish$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    if (!sess.proc) return sendHtml(chatId, `ℹ️ <b>${ui.escapeHtml(sess.name)}</b>: hozir ishlayotgan jarayon yo'q.`);

    try {
      process.kill(-sess.proc.pid);
      sess.proc = null;
      sendHtml(chatId, `🛑 <b>${ui.escapeHtml(sess.name)}</b>: jarayon to'xtatildi.`);
    } catch (e) {
      sendHtml(chatId, `❌ Jarayonni to'xtatib bo'lmadi: <code>${ui.escapeHtml(e.message)}</code>`);
    }
  });

  // ─── Tizim ──────────────────────────────────────────────────────────────────
  bot.onText(/\/sys|^💻 Tizim$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    sendHtml(msg.chat.id, ui.buildSysInfoText());
  });

  // ─── Sozlamalar ─────────────────────────────────────────────────────────────
  bot.onText(/\/settings|^⚙️ Sozlamalar$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);

    const text = (
      '⚙️ <b>Bot Sozlamalari:</b>\n' +
      '━'.repeat(26) + '\n' +
      `📁 <b>Default Ishchi Jild:</b> <code>${ui.escapeHtml(ui.shortPath(config.getDefaultCwd() || '(belgilanmagan)'))}</code>\n` +
      `🤖 <b>Default Model:</b> <code>${ui.escapeHtml(config.getGlobalModel())}</code>\n` +
      `⚡ <b>Default Tezlik:</b> <code>${ui.escapeHtml(config.getGlobalEffort())}</code>\n` +
      `⏱️ <b>5-Soatlik Limit:</b> <b>${config.getGlobalLimit()} ta so'rov</b>\n` +
      `🔌 <b>Local Webhook API:</b> <code>http://127.0.0.1:${config.LOCAL_API_PORT}</code>\n` +
      `🤖 <b>AGY CLI yo'li:</b> <code>${ui.escapeHtml(config.AGY_BIN)}</code>\n` +
      '━'.repeat(26)
    );

    sendHtml(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💾 Saqlash (Git / Holat)', callback_data: 'sess_save_' + (sess ? sess.id : 's1') },
            { text: '📁 Jildni o\'zgartirish',   callback_data: 'cfg_setcwd' }
          ],
          [
            { text: '🤖 Model tanlash',         callback_data: 'open_models' },
            { text: '⚡ Tezlik tanlash',        callback_data: 'open_efforts' }
          ],
          [
            { text: '⏱️ Limitni o\'zgartirish',  callback_data: 'cfg_setlimit' }
          ]
        ]
      }
    });
  });

  // ─── Fayl olish (/get) ──────────────────────────────────────────────────────
  bot.onText(/^\/get(.*)$|^📥 Fayl olish$/, async (msg, match) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const arg    = (match && match[1] ? match[1] : '').trim();

    if (!arg) {
      const base = config.getDefaultCwd() ? ui.shortPath(config.getDefaultCwd()) : '~';
      return sendHtml(chatId,
        '📥 <b>Fayl yuklab olish:</b>\n\n' +
        '<code>/get &lt;fayl_yo\'li&gt;</code> ko\'rinishida yuboring.\n' +
        `<i>Nisbiy yo'l uchun asos:</i> <code>${ui.escapeHtml(base)}</code>`
      );
    }

    const sess     = getActiveSession(chatId);
    const baseCwd  = (sess && sess.cwd) || config.getDefaultCwd() || process.cwd();
    const filePath = path.isAbsolute(arg) ? arg : path.resolve(baseCwd, arg);

    if (!fs.existsSync(filePath))
      return sendHtml(chatId, `❌ Fayl topilmadi:\n<code>${ui.escapeHtml(filePath)}</code>`);
    if (fs.statSync(filePath).isDirectory())
      return sendHtml(chatId, `❌ Bu papka, fayl emas:\n<code>${ui.escapeHtml(filePath)}</code>`);

    const size = fs.statSync(filePath).size;
    if (size > 50 * 1024 * 1024)
      return sendHtml(chatId, `❌ Fayl juda katta (${Math.round(size / 1024 / 1024)} MB). Telegram 50MB gacha ruxsat beradi.`);

    try {
      await bot.sendDocument(chatId, filePath, {
        caption: `📄 <b>${ui.escapeHtml(path.basename(filePath))}</b>\n📁 <code>${ui.escapeHtml(ui.shortPath(filePath))}</code>`,
        parse_mode: 'HTML'
      });
    } catch (e) {
      sendHtml(chatId, `❌ Yuborishda xato: <code>${ui.escapeHtml(e.message)}</code>`);
    }
  });

  // ─── Yordam (/help) ─────────────────────────────────────────────────────────
  bot.onText(/\/help|^❓ Yordam$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const help = (
      '🚀 <b>Antigravity Remote Bot Qo\'llanmasi:</b>\n\n' +
      '<b>Asosiy buyruqlar:</b>\n' +
      '• <code>/start</code> — Botni boshlash va holat\n' +
      '• <code>/sessions</code> — Barcha sessiyalar va boshqaruv\n' +
      '• <code>/model</code> — AI modelni tanlash\n' +
      '• <code>/effort</code> — Model tezligi (Low, Medium, High)\n' +
      '• <code>/limit</code> — 5-soatlik limit va statistika\n' +
      '• <code>/save</code> — Barcha o\'zgarishlarni saqlash (Git commit)\n' +
      '• <code>/newsess &lt;nom&gt;</code> — Yangi sessiya ochish\n' +
      '• <code>/switch &lt;id&gt;</code> — Sessiyaga o\'tish\n' +
      '• <code>/setcwd &lt;yo\'l&gt;</code> — Ishchi jildni o\'zgartirish\n' +
      '• <code>/get &lt;fayl&gt;</code> — Faylni Telegramga yuklab olish\n' +
      '• <code>/pwd</code> — Aktiv sessiya jildini ko\'rish\n' +
      '• <code>/ls</code> — Jild mazmunini ko\'rish\n' +
      '• <code>/history</code> — So\'nggi 20 ta buyruq\n' +
      '• <code>/kill</code> — Jarayonni majburiy to\'xtatish\n' +
      '• <code>/sys</code> — Server tizim parametrlari\n\n' +
      '💡 <i>Xabar yozsangiz, bot uni avtomatik tarzda Google Antigravity agentiga yuboradi va natijani terminal kod bloki ko\'rinishida qaytaradi.</i>'
    );
    sendHtml(msg.chat.id, help);
  });

  // Yangi sessiya ochish (/newsess <nom>)
  bot.onText(/^\/newsess(.*)$/, (msg, match) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const name   = (match[1] || '').trim();
    const sess   = createSession(name || undefined);
    setActiveSession(chatId, sess.id);
    sendHtml(chatId, `✅ <b>${ui.escapeHtml(sess.name)}</b> yaratildi va faollashtirildi!`, {
      reply_markup: ui.buildSessionsKeyboard(chatId)
    });
  });

  // Sessiyaga o'tish (/switch <id>)
  bot.onText(/^\/switch\s+(\S+)$/, (msg, match) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sid    = match[1].trim();
    if (setActiveSession(chatId, sid)) {
      const s = getSession(sid);
      sendHtml(chatId, `✅ <b>${ui.escapeHtml(s.name)}</b> ga o'tildi.`);
    } else {
      sendHtml(chatId, `❌ Sessiya topilmadi: <code>${ui.escapeHtml(sid)}</code>`);
    }
  });

  // Ishchi jildni o'zgartirish (/setcwd <yo'l>)
  bot.onText(/^\/setcwd(.*)$/, (msg, match) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const arg    = (match[1] || '').trim();

    if (!arg) {
      return sendHtml(chatId,
        `📁 <b>Hozirgi default jild:</b>\n<code>${ui.escapeHtml(config.getDefaultCwd() || '(belgilanmagan)')}</code>\n\n` +
        '<i>O\'zgartirish uchun:</i> <code>/setcwd &lt;yangi_yo\'l&gt;</code>'
      );
    }

    const resolved = path.resolve(arg);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return sendHtml(chatId, `❌ Papka topilmadi yoki bu papka emas:\n<code>${ui.escapeHtml(resolved)}</code>`);
    }

    const old = config.getDefaultCwd();
    config.setDefaultCwd(resolved);

    const sess = getActiveSession(chatId);
    if (sess) {
      sess.cwd = resolved;
      saveSessions();
    }

    sendHtml(chatId,
      `✅ <b>Ishchi jild muvaffaqiyatli o'zgartirildi!</b>\n\n` +
      `📁 Eski: <code>${ui.escapeHtml(ui.shortPath(old || '?'))}</code>\n` +
      `📁 Yangi: <code>${ui.escapeHtml(ui.shortPath(resolved))}</code>`
    );
  });

  // Limit belgilash (/setlimit <soni>)
  bot.onText(/^\/setlimit\s+(\d+)$/, (msg, match) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const num = parseInt(match[1]);
    if (num > 0) {
      config.setGlobalLimit(num);
      sendHtml(msg.chat.id, `✅ 5-soatlik umumiy limit <b>${num} ta</b> qilib belgilandi.`);
    }
  });

  // ─── Asosiy Xabar Qabul Qiluvchi (AGY Runner) ───────────────────────────────
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    if (!config.isAdmin(chatId)) return;

    const text = (msg.text || '').trim();
    if (!text || text.startsWith('/')) return;

    const knownButtons = [
      '📂 Sessiyalar', '🤖 Model', '⚡ Tezlik',
      '📊 5-Soatlik Limit', '💾 Saqlash', '📍 Papka (pwd)',
      '📁 Fayllar (ls)', '📜 Tarix', '💻 Tizim',
      '🛑 To\'xtatish', '⚙️ Sozlamalar', '❓ Yordam', '📥 Fayl olish'
    ];
    if (knownButtons.includes(text)) return;

    // Nomini o'zgartirish kutilayotgan bo'lsa
    if (renamePrompt.has(chatId)) {
      const sid = renamePrompt.get(chatId);
      renamePrompt.delete(chatId);
      const targetSess = getSession(sid);
      if (targetSess) {
        targetSess.name = text;
        saveSessions();
        return sendHtml(chatId, `✅ Sessiya nomi <b>${ui.escapeHtml(text)}</b> ga o'zgartirildi!`);
      }
    }

    // Jild yo'lini kiritish kutilayotgan bo'lsa
    if (setcwdPrompt.has(chatId)) {
      const sid = setcwdPrompt.get(chatId);
      setcwdPrompt.delete(chatId);
      const resolved = path.resolve(text);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        const targetSess = getSession(sid);
        if (targetSess) {
          targetSess.cwd = resolved;
          saveSessions();
          return sendHtml(chatId, `✅ <b>${ui.escapeHtml(targetSess.name)}</b> jildi <code>${ui.escapeHtml(resolved)}</code> ga o'zgartirildi!`);
        }
      } else {
        return sendHtml(chatId, `❌ Bunday papka topilmadi: <code>${ui.escapeHtml(resolved)}</code>`);
      }
    }

    const sess = getActiveSession(chatId);

    if (!config.getDefaultCwd() && !sess.cwd) {
      return sendHtml(chatId,
        '⚠️ <b>Ishchi jild belgilanmagan!</b>\n' +
        'Iltimos, avval <code>/setcwd &lt;papka_yo\'li&gt;</code> orqali loyiha papkasini kiriting.'
      );
    }

    // "cd <papka>"
    if (text.startsWith('cd ')) {
      const target   = text.substring(3).trim();
      const resolved = path.resolve(sess.cwd, target);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        sess.cwd = resolved;
        saveSessions();
        return sendHtml(chatId, `📁 <b>${ui.escapeHtml(sess.name)}</b>: papka o'zgardi\n<code>${ui.escapeHtml(sess.cwd)}</code>`);
      } else {
        return sendHtml(chatId, `❌ Papka topilmadi: <code>${ui.escapeHtml(resolved)}</code>`);
      }
    }

    const currentModel  = sess.model  || config.getGlobalModel();
    const currentEffort = sess.effort || config.getGlobalEffort();
    const mInfo         = getModelInfo(currentModel);
    const effInfo       = getEffortInfo(currentEffort);

    let modelArgs = `--model "${currentModel}"`;
    if (mInfo.supportsEffort) {
      modelArgs += ` --effort ${currentEffort}`;
    }

    const agyContinue = !sess.isNewConv;
    sess.isNewConv    = false;

    const safeText = text.replace(/\\/g, '/').replace(/"/g, '\\"');
    const safeCwd  = sess.cwd.replace(/\\/g, '/');

    const execCommand = (
      `${config.AGY_BIN} ${agyContinue ? '-c ' : ''}${modelArgs} ` +
      `--dangerously-skip-permissions --mode accept-edits --print-timeout 15m ` +
      `-p "MUHIM: Faqat AMAL qil. Reja tuzma. Ishchi jild: ${safeCwd}. ` +
      `TELEGRAM API: curl.exe -s \\"http://127.0.0.1:${config.LOCAL_API_PORT}/send-file\\" ` +
      `-G --data-urlencode \\"file=TO'LIQ_YO'L\\". ` +
      `Xabar: curl.exe -s \\"http://127.0.0.1:${config.LOCAL_API_PORT}/send-msg\\" ` +
      `-G --data-urlencode \\"text=XABAR\\". ` +
      `Foydalanuvchi: ${safeText}\"`
    );

    const modelBadge = `${mInfo.emoji} ${mInfo.label} [${effInfo.emoji} ${effInfo.label}]`;
    const statusText = (
      `⏳ <b>${ui.escapeHtml(sess.name)}</b>: bajarilmoqda...\n` +
      `🤖 Model: <b>${ui.escapeHtml(modelBadge)}</b>\n` +
      `📁 Jild: <code>${ui.escapeHtml(ui.shortPath(sess.cwd))}</code>`
    );

    const startTime = Date.now();

    try {
      const sentMsg = await bot.sendMessage(chatId, statusText, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        reply_markup: {
          inline_keyboard: [[
            { text: '🛑 To\'xtatish',   callback_data: 'kill_' + sess.id },
            { text: '📊 5-Soatlik Limit', callback_data: 'refresh_limit' }
          ]]
        }
      });

      sess.history.push(text);
      sess.cmdCount = (sess.cmdCount || 0) + 1;
      if (sess.history.length > 50) sess.history.shift();
      saveSessions();

      const typingInterval = setInterval(() => {
        bot.sendChatAction(chatId, 'typing').catch(() => {});
      }, 4500);

      const child = exec(execCommand, {
        cwd: sess.cwd,
        timeout: 900000,
        detached: true
      }, (error, stdout, stderr) => {
        clearInterval(typingInterval);
        sess.proc = null;

        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

        recordRequest(currentModel, currentEffort, sess.id);
        const curStats = get5HourStats(currentModel);

        let output = '';
        if (stdout)           output += stdout;
        if (stderr)           output += (stdout ? '\nSTDERR:\n' : '') + stderr;
        if (!output && error) output  = 'Exit code: ' + (error.code || '?');
        if (!output)          output  = 'Bajarildi (chiqish natijasi yo\'q).';

        output = ui.truncate(output);

        bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});

        const resultHeader = (
          `✅ <b>${ui.escapeHtml(sess.name)}</b> — Bajarildi (${durationSec}s)\n` +
          `🤖 <b>${ui.escapeHtml(modelBadge)}</b> | 📊 5-soatlik: <b>${curStats.total5h}/${curStats.maxLimit}</b>\n\n` +
          `<pre>${ui.escapeHtml(output)}</pre>`
        );

        sendHtml(chatId, resultHeader, {
          reply_to_message_id: msg.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💾 Saqlash', callback_data: 'sess_save_' + sess.id },
                { text: '📁 ls',      callback_data: 'sess_run_ls_' + sess.id },
                { text: '📊 Limit',   callback_data: 'refresh_limit' },
              ]
            ]
          }
        });
      });

      if (child && child.pid) sess.proc = child;

    } catch (e) {
      console.error('Xabar yuborishda xato:', e.message);
    }
  });

  // ─── Callback Queries Router ────────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();
    if (!config.isAdmin(chatId)) {
      return bot.answerCallbackQuery(query.id, { text: 'Ruxsat yo\'q!', show_alert: true });
    }

    const data  = query.data;
    const msgId = query.message.message_id;

    // Sessiyalar ro'yxati
    if (data === 'open_sessions' || data === 'refresh_sessions') {
      bot.answerCallbackQuery(query.id, { text: 'Sessiyalar yangilandi' });
      return editHtml(chatId, msgId, ui.buildSessionsListText(chatId), {
        reply_markup: ui.buildSessionsKeyboard(chatId)
      });
    }

    // Sessiya kartasini ko'rish
    if (data.startsWith('sess_view_')) {
      const sid = data.substring(10);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      bot.answerCallbackQuery(query.id);
      return editHtml(chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
        reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
      });
    }

    // Sessiyani tanlash
    if (data.startsWith('sess_sel_')) {
      const sid = data.substring(9);
      if (setActiveSession(chatId, sid)) {
        const sess = getSession(sid);
        bot.answerCallbackQuery(query.id, { text: `⭐ ${sess.name} tanlandi!` });
        return editHtml(chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
          reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
        });
      }
    }

    // Yangi sessiya
    if (data === 'new_session') {
      const sess = createSession();
      setActiveSession(chatId, sess.id);
      bot.answerCallbackQuery(query.id, { text: `✅ ${sess.name} yaratildi!` });
      return editHtml(chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
        reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
      });
    }

    // Sessiyani saqlash (Git commit)
    if (data.startsWith('sess_save_')) {
      const sid = data.substring(10);
      bot.answerCallbackQuery(query.id, { text: 'O\'zgarishlar saqlanmoqda...' });
      const res = await saveChanges(chatId, sid);
      return sendHtml(chatId, res.message);
    }

    // Sessiyani yopish
    if (data.startsWith('sess_close_')) {
      const sid = data.substring(11);
      const name = closeSession(sid, chatId);
      if (!name) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      bot.answerCallbackQuery(query.id, { text: `🗑️ ${name} yopildi.` });
      return editHtml(chatId, msgId, ui.buildSessionsListText(chatId), {
        reply_markup: ui.buildSessionsKeyboard(chatId)
      });
    }

    // Sessiya suhbatini tozalash (Reset)
    if (data.startsWith('sess_reset_')) {
      const sid = data.substring(11);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      sess.isNewConv = true;
      bot.answerCallbackQuery(query.id, { text: '🔄 Suhbat konteksti yangilandi!' });
      return editHtml(chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
        reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
      });
    }

    // Sessiya nomini o'zgartirish
    if (data.startsWith('sess_rename_')) {
      const sid = data.substring(12);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      renamePrompt.set(chatId, sid);
      bot.answerCallbackQuery(query.id);
      return sendHtml(chatId, `✏️ <b>${ui.escapeHtml(sess.name)}</b> uchun yangi nom yuboring:`);
    }

    // Sessiya papkasini o'zgartirish
    if (data.startsWith('sess_setcwd_')) {
      const sid = data.substring(12);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      setcwdPrompt.set(chatId, sid);
      bot.answerCallbackQuery(query.id);
      return sendHtml(chatId, `📁 <b>${ui.escapeHtml(sess.name)}</b> uchun yangi papka yo'lini yuboring:`);
    }

    // Sessiya tarixi
    if (data.startsWith('sess_hist_')) {
      const sid = data.substring(10);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      bot.answerCallbackQuery(query.id);
      const list = sess.history.length > 0
        ? sess.history.slice(-15).map((c, i) => `${i + 1}. <code>${ui.escapeHtml(c)}</code>`).join('\n')
        : '<i>Buyruqlar tarixi bo\'sh.</i>';

      return sendHtml(chatId, `📜 <b>${ui.escapeHtml(sess.name)}</b> so'nggi buyruqlari:\n\n${list}`);
    }

    // Sessiya model tanlash oynasi
    if (data.startsWith('sess_model_')) {
      const sid = data.substring(11);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      bot.answerCallbackQuery(query.id);
      return editHtml(chatId, msgId, ui.buildModelText(sess.model, sess.effort), {
        reply_markup: ui.buildModelKeyboard(sid)
      });
    }

    // Sessiyaga model o'rnatish
    if (data.startsWith('set_sess_model_')) {
      const parts   = data.split('_');
      const sid     = parts[3];
      const modelId = parts.slice(4).join('_');
      const sess    = getSession(sid);
      const mInfo   = getModelInfo(modelId);

      if (sess) {
        sess.model = modelId;
        config.setGlobalModel(modelId);
        saveSessions();
        bot.answerCallbackQuery(query.id, { text: `${mInfo.label} tanlandi!` });
        return editHtml(chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
          reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
        });
      }
    }

    // Sessiya tezlik oynasi
    if (data.startsWith('sess_effort_')) {
      const sid = data.substring(12);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      bot.answerCallbackQuery(query.id);
      return editHtml(chatId, msgId, ui.buildEffortText(sess.effort, sess.model), {
        reply_markup: ui.buildEffortKeyboard(sid)
      });
    }

    // Sessiyaga tezlik o'rnatish
    if (data.startsWith('set_sess_effort_')) {
      const parts    = data.split('_');
      const sid      = parts[3];
      const effortId = parts[4];
      const sess     = getSession(sid);
      const effInfo  = getEffortInfo(effortId);

      if (sess) {
        sess.effort = effortId;
        config.setGlobalEffort(effortId);
        saveSessions();
        bot.answerCallbackQuery(query.id, { text: `⚡ Tezlik: ${effInfo.label} belgilandi!` });
        return editHtml(chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
          reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
        });
      }
    }

    // Global modellar oynasi
    if (data === 'open_models') {
      const sess = getActiveSession(chatId);
      bot.answerCallbackQuery(query.id);
      return editHtml(chatId, msgId, ui.buildModelText(sess ? sess.model : config.getGlobalModel(), sess ? sess.effort : config.getGlobalEffort()), {
        reply_markup: ui.buildModelKeyboard(sess ? sess.id : null)
      });
    }

    // Global tezlik oynasi
    if (data === 'open_efforts') {
      const sess = getActiveSession(chatId);
      bot.answerCallbackQuery(query.id);
      return editHtml(chatId, msgId, ui.buildEffortText(sess ? sess.effort : config.getGlobalEffort(), sess ? sess.model : config.getGlobalModel()), {
        reply_markup: ui.buildEffortKeyboard(sess ? sess.id : null)
      });
    }

    // Faol sessiyaga model o'rnatish
    if (data.startsWith('setmodel_')) {
      const modelId = data.substring(9);
      const mInfo   = getModelInfo(modelId);
      const sess    = getActiveSession(chatId);

      if (sess) sess.model = modelId;
      config.setGlobalModel(modelId);
      saveSessions();

      bot.answerCallbackQuery(query.id, { text: `🤖 ${mInfo.label} tanlandi!` });
      return editHtml(chatId, msgId, ui.buildModelText(config.getGlobalModel(), sess ? sess.effort : config.getGlobalEffort()), {
        reply_markup: ui.buildModelKeyboard(sess ? sess.id : null)
      });
    }

    // Faol sessiyaga tezlik o'rnatish
    if (data.startsWith('seteffort_')) {
      const effortId = data.substring(10);
      const effInfo  = getEffortInfo(effortId);
      const sess     = getActiveSession(chatId);

      if (sess) sess.effort = effortId;
      config.setGlobalEffort(effortId);
      saveSessions();

      bot.answerCallbackQuery(query.id, { text: `⚡ ${effInfo.label} tanlandi!` });
      return editHtml(chatId, msgId, ui.buildEffortText(config.getGlobalEffort(), sess ? sess.model : config.getGlobalModel()), {
        reply_markup: ui.buildEffortKeyboard(sess ? sess.id : null)
      });
    }

    // Limit yangilash
    if (data === 'refresh_limit') {
      bot.answerCallbackQuery(query.id, { text: 'Limitlar yangilandi' });
      return editHtml(chatId, msgId, ui.buildLimitText(chatId), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Yangilash',     callback_data: 'refresh_limit' },
              { text: '🤖 Model tanlash', callback_data: 'open_models' },
              { text: '⚡ Tezlik',        callback_data: 'open_efforts' }
            ]
          ]
        }
      });
    }

    // Jarayonni to'xtatish
    if (data.startsWith('kill_')) {
      const sid  = data.substring(5);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });
      if (!sess.proc) return bot.answerCallbackQuery(query.id, { text: 'Jarayon allaqachon tugagan.' });

      try {
        process.kill(-sess.proc.pid);
        sess.proc = null;
        bot.answerCallbackQuery(query.id, { text: '🛑 Jarayon to\'xtatildi!' });
      } catch (e) {
        bot.answerCallbackQuery(query.id, { text: 'Xatolik: ' + e.message, show_alert: true });
      }
      return;
    }

    // ls chiqarish
    if (data.startsWith('sess_run_ls_')) {
      const sid  = data.substring(12);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });
      try {
        const items = fs.readdirSync(sess.cwd, { withFileTypes: true });
        const dirs  = items.filter(i => i.isDirectory()).map(i => `📁 ${ui.escapeHtml(i.name)}/`);
        const files = items.filter(i => !i.isDirectory()).map(i => `📄 ${ui.escapeHtml(i.name)}`);
        const all   = [...dirs, ...files].join('\n');
        bot.answerCallbackQuery(query.id);
        return sendHtml(chatId, `📁 <b>${ui.escapeHtml(ui.shortPath(sess.cwd))}</b>:\n\n<pre>${all || '(bo\'sh)'}</pre>`);
      } catch (e) {
        return bot.answerCallbackQuery(query.id, { text: e.message, show_alert: true });
      }
    }

    // Oynani yopish
    if (data === 'model_close' || data === 'close_menu') {
      bot.answerCallbackQuery(query.id);
      return bot.deleteMessage(chatId, msgId).catch(() => {});
    }

    // Jildni o'zgartirish
    if (data === 'cfg_setcwd') {
      const sess = getActiveSession(chatId);
      setcwdPrompt.set(chatId, sess ? sess.id : 's1');
      bot.answerCallbackQuery(query.id);
      return sendHtml(chatId, '📁 Yangi ishchi jild to\'liq yo\'lini yuboring:');
    }

    // Limitni o'zgartirish
    if (data === 'cfg_setlimit') {
      bot.answerCallbackQuery(query.id);
      return sendHtml(chatId, '⏱️ 5-soatlik limitni o\'zgartirish uchun: <code>/setlimit &lt;soni&gt;</code> yuboring (masalan: <code>/setlimit 200</code>).');
    }
  });

  return bot;
}

module.exports = {
  initBot
};
