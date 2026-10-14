/**
 * 🎛️ Callback Queries Router Moduli
 * Barcha inline tugmalar (sessiyalar, modellar, tezlik, limitlar va sozlamalar) harakatlarini boshqaradi.
 */

const fs     = require('fs');
const config = require('../config');
const { getModelInfo, getEffortInfo } = require('../models');
const {
  getActiveSession,
  setActiveSession,
  createSession,
  getSession,
  closeSession,
  saveSessions,
  clearSessionHistory,
  renamePrompt,
  setcwdPrompt
} = require('../sessions');
const { saveChanges } = require('../git-saver');
const ui = require('../ui');
const { sendHtml, editHtml } = require('../utils');

function registerCallbacks(bot) {
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
      return editHtml(bot, chatId, msgId, ui.buildSessionsListText(chatId), {
        reply_markup: ui.buildSessionsKeyboard(chatId)
      });
    }

    // Sessiya kartasini ko'rish
    if (data.startsWith('sess_view_')) {
      const sid = data.substring(10);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      bot.answerCallbackQuery(query.id);
      return editHtml(bot, chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
        reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
      });
    }

    // Sessiyani tanlash
    if (data.startsWith('sess_sel_')) {
      const sid = data.substring(9);
      if (setActiveSession(chatId, sid)) {
        const sess = getSession(sid);
        bot.answerCallbackQuery(query.id, { text: `⭐ ${sess.name} tanlandi!` });
        return editHtml(bot, chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
          reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
        });
      }
    }

    // Yangi sessiya
    if (data === 'new_session') {
      const sess = createSession();
      setActiveSession(chatId, sess.id);
      bot.answerCallbackQuery(query.id, { text: `✅ ${sess.name} yaratildi!` });
      return editHtml(bot, chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
        reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
      });
    }

    // Sessiyani saqlash (Git commit)
    if (data.startsWith('sess_save_')) {
      const sid = data.substring(10);
      bot.answerCallbackQuery(query.id, { text: 'O\'zgarishlar saqlanmoqda...' });
      const res = await saveChanges(chatId, sid);
      return sendHtml(bot, chatId, res.message);
    }

    // Sessiyani yopish
    if (data.startsWith('sess_close_')) {
      const sid = data.substring(11);
      const name = closeSession(sid, chatId);
      if (!name) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      bot.answerCallbackQuery(query.id, { text: `🗑️ ${name} yopildi.` });
      return editHtml(bot, chatId, msgId, ui.buildSessionsListText(chatId), {
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
      return editHtml(bot, chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
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
      return sendHtml(bot, chatId, `✏️ <b>${ui.escapeHtml(sess.name)}</b> uchun yangi nom yuboring:`);
    }

    // Sessiya papkasini o'zgartirish
    if (data.startsWith('sess_setcwd_')) {
      const sid = data.substring(12);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      setcwdPrompt.set(chatId, sid);
      bot.answerCallbackQuery(query.id);
      return sendHtml(bot, chatId, `📁 <b>${ui.escapeHtml(sess.name)}</b> uchun yangi papka yo'lini yuboring:`);
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

      return sendHtml(bot, chatId, `📜 <b>${ui.escapeHtml(sess.name)}</b> so'nggi buyruqlari:\n\n${list}`);
    }

    // Sessiya tarixini tozalash
    if (data.startsWith('sess_clear_hist_')) {
      const sid = data.substring(16);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      clearSessionHistory(sid);
      bot.answerCallbackQuery(query.id, { text: '🗑️ Tarix tozalandi!' });
      return editHtml(bot, chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
        reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
      });
    }

    // Sessiya model tanlash oynasi
    if (data.startsWith('sess_model_')) {
      const sid = data.substring(11);
      const sess = getSession(sid);
      if (!sess) return bot.answerCallbackQuery(query.id, { text: 'Sessiya topilmadi!' });

      bot.answerCallbackQuery(query.id);
      return editHtml(bot, chatId, msgId, ui.buildModelText(sess.model, sess.effort), {
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
        return editHtml(bot, chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
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
      return editHtml(bot, chatId, msgId, ui.buildEffortText(sess.effort, sess.model), {
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
        return editHtml(bot, chatId, msgId, ui.buildSessionDetailText(sess, chatId), {
          reply_markup: ui.buildSessionDetailKeyboard(sess, chatId)
        });
      }
    }

    // Global modellar oynasi
    if (data === 'open_models') {
      const sess = getActiveSession(chatId);
      bot.answerCallbackQuery(query.id);
      return editHtml(bot, chatId, msgId, ui.buildModelText(sess ? sess.model : config.getGlobalModel(), sess ? sess.effort : config.getGlobalEffort()), {
        reply_markup: ui.buildModelKeyboard(sess ? sess.id : null)
      });
    }

    // Global tezlik oynasi
    if (data === 'open_efforts') {
      const sess = getActiveSession(chatId);
      bot.answerCallbackQuery(query.id);
      return editHtml(bot, chatId, msgId, ui.buildEffortText(sess ? sess.effort : config.getGlobalEffort(), sess ? sess.model : config.getGlobalModel()), {
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
      return editHtml(bot, chatId, msgId, ui.buildModelText(config.getGlobalModel(), sess ? sess.effort : config.getGlobalEffort()), {
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
      return editHtml(bot, chatId, msgId, ui.buildEffortText(config.getGlobalEffort(), sess ? sess.model : config.getGlobalModel()), {
        reply_markup: ui.buildEffortKeyboard(sess ? sess.id : null)
      });
    }

    // Limit yangilash
    if (data === 'refresh_limit') {
      bot.answerCallbackQuery(query.id, { text: 'Limitlar yangilandi' });
      return editHtml(bot, chatId, msgId, ui.buildLimitText(chatId), {
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
        return sendHtml(bot, chatId, `📁 <b>${ui.escapeHtml(ui.shortPath(sess.cwd))}</b>:\n\n<pre>${all || '(bo\'sh)'}</pre>`);
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
      return sendHtml(bot, chatId, '📁 Yangi ishchi jild to\'liq yo\'lini yuboring:');
    }

    // Limitni o'zgartirish
    if (data === 'cfg_setlimit') {
      bot.answerCallbackQuery(query.id);
      return sendHtml(bot, chatId, '⏱️ 5-soatlik limitni o\'zgartirish uchun: <code>/setlimit &lt;soni&gt;</code> yuboring (masalan: <code>/setlimit 200</code>).');
    }
  });
}

module.exports = {
  registerCallbacks
};
