/**
 * 💬 Matnli Xabarlar Moduli (Messages Handler)
 * Foydalanuvchi xabarlarini, sessiya parametrlarini sozlash (nom/papka)
 * va AGY agentiga yuborishni muvofiqlashtiradi.
 */

const fs     = require('fs');
const path   = require('path');
const config = require('../config');
const {
  getSession,
  getActiveSession,
  saveSessions,
  renamePrompt,
  setcwdPrompt
} = require('../sessions');
const ui = require('../ui');
const { sendHtml } = require('../utils');
const { runAgy } = require('../runner');

const KNOWN_BUTTONS = [
  '📂 Sessiyalar', '🤖 Model', '⚡ Tezlik',
  '📊 5-Soatlik Limit', '📊 Limit', '💾 Saqlash',
  '💾 O\'zgarishlarni saqlash', '📍 Papka (pwd)', '📍 Papka',
  '📁 Fayllar (ls)', '📁 Fayllar', '📜 Tarix', '💻 Tizim',
  '🛑 To\'xtatish', '⚙️ Sozlamalar', '❓ Yordam', '📥 Fayl olish',
  '🌐 Veb Interfeys', '🌐 Veb'
];

function registerMessages(bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    if (!config.isAdmin(chatId)) return;

    const text = (msg.text || '').trim();
    if (!text || text.startsWith('/')) return;
    if (KNOWN_BUTTONS.includes(text)) return;

    // 1. Sessiya nomini o'zgartirish kutilayotgan bo'lsa
    if (renamePrompt.has(chatId)) {
      const sid = renamePrompt.get(chatId);
      renamePrompt.delete(chatId);
      const targetSess = getSession(sid);
      if (targetSess) {
        targetSess.name = text;
        saveSessions();
        return sendHtml(bot, chatId, `✅ Sessiya nomi <b>${ui.escapeHtml(text)}</b> ga o'zgartirildi!`);
      }
    }

    // 2. Jild yo'lini kiritish kutilayotgan bo'lsa
    if (setcwdPrompt.has(chatId)) {
      const sid = setcwdPrompt.get(chatId);
      setcwdPrompt.delete(chatId);
      const resolved = path.resolve(text);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        const targetSess = getSession(sid);
        if (targetSess) {
          targetSess.cwd = resolved;
          saveSessions();
          return sendHtml(bot, chatId, `✅ <b>${ui.escapeHtml(targetSess.name)}</b> jildi <code>${ui.escapeHtml(resolved)}</code> ga o'zgartirildi!`);
        }
      } else {
        return sendHtml(bot, chatId, `❌ Bunday papka topilmadi: <code>${ui.escapeHtml(resolved)}</code>`);
      }
    }

    const sess = getActiveSession(chatId);

    // 3. Ishchi jild tekshiruvi
    if (!config.getDefaultCwd() && (!sess || !sess.cwd)) {
      return sendHtml(bot, chatId,
        '⚠️ <b>Ishchi jild belgilanmagan!</b>\n' +
        'Iltimos, avval <code>/setcwd &lt;papka_yo\'li&gt;</code> orqali loyiha papkasini kiriting.'
      );
    }

    // 4. "cd <papka>" maxsus buyrug'i
    if (text.startsWith('cd ')) {
      const target   = text.substring(3).trim();
      const resolved = path.resolve(sess.cwd, target);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        sess.cwd = resolved;
        saveSessions();
        return sendHtml(bot, chatId, `📁 <b>${ui.escapeHtml(sess.name)}</b>: papka o'zgardi\n<code>${ui.escapeHtml(sess.cwd)}</code>`);
      } else {
        return sendHtml(bot, chatId, `❌ Papka topilmadi: <code>${ui.escapeHtml(resolved)}</code>`);
      }
    }

    // 5. Asosiy AGY vazifasini ishga tushirish
    await runAgy({
      bot,
      chatId,
      sess,
      text,
      replyToMsgId: msg.message_id
    });
  });
}

module.exports = {
  registerMessages
};
