/**
 * ⚡ Bot Buyruqlari Moduli (Commands Handler)
 * Slash komandalar va asosiy klaviatura tugmalarini qayta ishlaydi.
 */

const fs     = require('fs');
const path   = require('path');
const config = require('../config');
const { getModelInfo, getEffortInfo } = require('../models');
const {
  getActiveSession,
  setActiveSession,
  createSession,
  getSession,
  saveSessions,
  clearSessionHistory
} = require('../sessions');
const { saveChanges } = require('../git-saver');
const ui = require('../ui');
const { sendHtml } = require('../utils');
const bypass = require('../bypass');

function registerCommands(bot) {
  // ─── /start ─────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return bot.sendMessage(msg.chat.id, 'Ruxsat yo\'q.');

    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    const mInfo  = getModelInfo(sess ? sess.model : config.getGlobalModel());
    const effInfo = getEffortInfo(sess ? sess.effort : config.getGlobalEffort());

    const welcome = (
      `🚀 <b>Antigravity Bot tayyor.</b>\n\n` +
      `🤖 <b>Model:</b> ${mInfo.emoji} ${ui.escapeHtml(mInfo.label)} (${effInfo.label})\n` +
      `📁 <code>${ui.escapeHtml(ui.shortPath(config.getDefaultCwd() || 'projects'))}</code>\n` +
      `📊 <b>Limit:</b> ${config.getGlobalLimit()} ta / 5 soat\n\n` +
      `<i>Xabar yozsangiz, AGY agenti bajaradi.</i>`
    );

    sendHtml(bot, chatId, welcome, { reply_markup: ui.getMainKeyboard() });
  });

  // ─── Sessiyalar ─────────────────────────────────────────────────────────────
  bot.onText(/\/sessions|^📂 Sessiyalar$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    sendHtml(bot, chatId, ui.buildSessionsListText(chatId), {
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

    sendHtml(bot, chatId, ui.buildModelText(curMod, curEff), {
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

    sendHtml(bot, chatId, ui.buildEffortText(curEff, curMod), {
      reply_markup: ui.buildEffortKeyboard(sess ? sess.id : null)
    });
  });

  // ─── 5-Soatlik Limit ────────────────────────────────────────────────────────
  bot.onText(/\/limit|^📊 Limit$|^📊 5-Soatlik Limit$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    sendHtml(bot, chatId, ui.buildLimitText(chatId), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Yangilash', callback_data: 'refresh_limit' },
            { text: '🤖 Model',     callback_data: 'open_models' },
            { text: '⚡ Tezlik',    callback_data: 'open_efforts' }
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
    sendHtml(bot, chatId, res.message);
  });

  // ─── Papka (pwd) ────────────────────────────────────────────────────────────
  bot.onText(/\/pwd|^📍 Papka \(pwd\)$|^📍 Papka$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    sendHtml(bot, chatId, `📍 <code>${ui.escapeHtml(sess.cwd)}</code>`);
  });

  // ─── Fayllar (ls) ───────────────────────────────────────────────────────────
  bot.onText(/\/ls|^📁 Fayllar$|^📁 Fayllar \(ls\)$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    try {
      const items = fs.readdirSync(sess.cwd, { withFileTypes: true });
      const dirs  = items.filter(i => i.isDirectory()).map(i => `📁 ${ui.escapeHtml(i.name)}/`);
      const files = items.filter(i => !i.isDirectory()).map(i => `📄 ${ui.escapeHtml(i.name)}`);
      const all   = [...dirs, ...files].join('\n');
      sendHtml(bot, chatId, `📁 <code>${ui.escapeHtml(ui.shortPath(sess.cwd))}</code>:\n\n<pre>${all || '(bo\'sh)'}</pre>`);
    } catch (e) {
      sendHtml(bot, chatId, `❌ <code>${ui.escapeHtml(e.message)}</code>`);
    }
  });

  // ─── Tarix ──────────────────────────────────────────────────────────────────
  bot.onText(/\/history|^📜 Tarix$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    if (!sess.history.length) return sendHtml(bot, chatId, `📜 Tarix bo'sh.`);

    const list = sess.history.slice(-15).map((c, i) => `${i + 1}. <code>${ui.escapeHtml(c)}</code>`).join('\n');
    sendHtml(bot, chatId, `📜 <b>Tarix:</b>\n\n${list}`);
  });

  // ─── Tarixni Tozalash (/clear) ──────────────────────────────────────────────
  bot.onText(/\/clear|^🗑️ Tarixni tozalash$|^🗑️ Tozalash$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    if (sess) {
      clearSessionHistory(sess.id);
      sendHtml(bot, chatId, `🗑️ <b>${ui.escapeHtml(sess.name)}</b> sessiyasi yozishmalar tarixi tozalandi!`);
    }
  });

  // ─── To'xtatish ─────────────────────────────────────────────────────────────
  bot.onText(/\/kill|^🛑 To'xtatish$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const sess   = getActiveSession(chatId);
    if (!sess.proc) return sendHtml(bot, chatId, `ℹ️ Ishlayotgan jarayon yo'q.`);

    try {
      process.kill(-sess.proc.pid);
      sess.proc = null;
      sendHtml(bot, chatId, `🛑 Jarayon to'xtatildi.`);
    } catch (e) {
      sendHtml(bot, chatId, `❌ Xatolik: <code>${ui.escapeHtml(e.message)}</code>`);
    }
  });

  // ─── Tizim ──────────────────────────────────────────────────────────────────
  bot.onText(/\/sys|^💻 Tizim$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    sendHtml(bot, msg.chat.id, ui.buildSysInfoText());
  });

  // ─── Sozlamalar ─────────────────────────────────────────────────────────────
  bot.onText(/\/settings|^⚙️ Sozlamalar$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const text = (
      `⚙️ <b>Sozlamalar:</b>\n\n` +
      `📁 <code>${ui.escapeHtml(ui.shortPath(config.getDefaultCwd() || 'projects'))}</code>\n` +
      `🤖 ${ui.escapeHtml(config.getGlobalModel())} (${ui.escapeHtml(config.getGlobalEffort())})\n` +
      `⏱️ Limit: ${config.getGlobalLimit()} ta / 5h`
    );

    sendHtml(bot, chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🤖 Model',  callback_data: 'open_models' },
            { text: '⚡ Tezlik', callback_data: 'open_efforts' }
          ],
          [
            { text: '📁 Jild',   callback_data: 'cfg_setcwd' },
            { text: '⏱️ Limit',  callback_data: 'cfg_setlimit' }
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
      return sendHtml(bot, chatId, '📥 <code>/get &lt;fayl_yo\'li&gt;</code>');
    }

    const sess     = getActiveSession(chatId);
    const baseCwd  = (sess && sess.cwd) || config.getDefaultCwd() || process.cwd();
    const filePath = path.isAbsolute(arg) ? arg : path.resolve(baseCwd, arg);

    if (!fs.existsSync(filePath))
      return sendHtml(bot, chatId, `❌ Fayl topilmadi:\n<code>${ui.escapeHtml(filePath)}</code>`);
    if (fs.statSync(filePath).isDirectory())
      return sendHtml(bot, chatId, `❌ Bu papka, fayl emas:\n<code>${ui.escapeHtml(filePath)}</code>`);

    const size = fs.statSync(filePath).size;
    if (size > 50 * 1024 * 1024)
      return sendHtml(bot, chatId, `❌ Fayl 50MB dan katta (${Math.round(size / 1024 / 1024)} MB).`);

    try {
      await bot.sendDocument(chatId, filePath, {
        caption: `📄 <code>${ui.escapeHtml(path.basename(filePath))}</code>`,
        parse_mode: 'HTML'
      });
    } catch (e) {
      sendHtml(bot, chatId, `❌ <code>${ui.escapeHtml(e.message)}</code>`);
    }
  });

  // ─── Yordam (/help) ─────────────────────────────────────────────────────────
  bot.onText(/\/help|^❓ Yordam$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const help = (
      '❓ <b>Buyruqlar:</b>\n\n' +
      '• <code>/model</code> — AI model tanlash\n' +
      '• <code>/effort</code> — Fikrlash tezligi\n' +
      '• <code>/limit</code> — 5-soatlik limit\n' +
      '• <code>/save</code> — Git ga saqlash\n' +
      '• <code>/sessions</code> — Sessiyalar\n' +
      '• <code>/ls</code> — Fayllar ro\'yxati\n' +
      '• <code>/get &lt;fayl&gt;</code> — Fayl yuklab olish\n' +
      '• <code>/clear</code> — Sessiya tarixini tozalash\n' +
      '• <code>/kill</code> — Jarayonni to\'xtatish\n\n' +
      '<i>Oddiy xabar yozsangiz, bot uni avtomatik tarzda bajaradi.</i>'
    );
    sendHtml(bot, msg.chat.id, help);
  });

  // Yangi sessiya ochish (/newsess <nom>)
  bot.onText(/^\/newsess(.*)$/, (msg, match) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const name   = (match[1] || '').trim();
    const sess   = createSession(name || undefined);
    setActiveSession(chatId, sess.id);
    sendHtml(bot, chatId, `✅ <b>${ui.escapeHtml(sess.name)}</b> yaratildi va faollashtirildi!`, {
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
      sendHtml(bot, chatId, `✅ <b>${ui.escapeHtml(s.name)}</b> ga o'tildi.`);
    } else {
      sendHtml(bot, chatId, `❌ Sessiya topilmadi: <code>${ui.escapeHtml(sid)}</code>`);
    }
  });

  // Ishchi jildni o'zgartirish (/setcwd <yo'l>)
  bot.onText(/^\/setcwd(.*)$/, (msg, match) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id.toString();
    const arg    = (match[1] || '').trim();

    if (!arg) {
      return sendHtml(bot, chatId,
        `📁 <b>Hozirgi default jild:</b>\n<code>${ui.escapeHtml(config.getDefaultCwd() || '(belgilanmagan)')}</code>\n\n` +
        '<i>O\'zgartirish uchun:</i> <code>/setcwd &lt;yangi_yo\'l&gt;</code>'
      );
    }

    const resolved = path.resolve(arg);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return sendHtml(bot, chatId, `❌ Papka topilmadi yoki bu papka emas:\n<code>${ui.escapeHtml(resolved)}</code>`);
    }

    const old = config.getDefaultCwd();
    config.setDefaultCwd(resolved);

    const sess = getActiveSession(chatId);
    if (sess) {
      sess.cwd = resolved;
      saveSessions();
    }

    sendHtml(bot, chatId,
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
      sendHtml(bot, msg.chat.id, `✅ 5-soatlik umumiy limit <b>${num} ta</b> qilib belgilandi.`);
    }
  });

  // ─── /bypass — DNS cheklovini ochish ──────────────────────────────────────
  bot.onText(/^\/bypass(?:\s+(force))?$|^🔓 Bypass$/, async (msg, match) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id;
    const isForce = Boolean(match && match[1] === 'force');

    if (config.SAFE_MODE && !config.ENABLE_SYSTEM_BYPASS && !isForce) {
      return sendHtml(bot, chatId,
        '🛡️ <b>Xavfsiz rejim (SAFE_MODE) faol!</b>\n\n' +
        'Tizim fayllari va DNS sozlamalarining tasodifiy o\'zgarishini oldini olish uchun avtomatik bypass himoyalangan.\n\n' +
        'Agar siz haqiqatan ham bypassni yoqmoqchi bo\'lsangiz:\n' +
        '• <code>/bypass force</code> buyrug\'ini yuboring\n' +
        '• Yoki <code>.env</code> faylida <code>ENABLE_SYSTEM_BYPASS=true</code> qiling.'
      );
    }

    const wait = await bot.sendMessage(chatId, '⏳ <b>Bypass sozlanmoqda...</b>\n\n' +
      '• Antigravity binary tekshirilmoqda\n' +
      '• DNS relay ishga tushirilmoqda\n' +
      '• NRPT qoidalari o\'rnatilmoqda', { parse_mode: 'HTML' });

    try {
      const result = await bypass.enable({ force: isForce });

      const patchOk   = result.patch.ok;
      const patchFail = result.patch.failed;
      const dnsOk     = result.dns.ok;
      const vpn       = result.dns.vpnActive;
      const iface     = result.dns.ifName;

      let lines = [''];
      lines.push(`<b>📦 Binary Patch:</b>`);
      lines.push(`  ✅ Muvaffaqiyatli: <b>${patchOk}</b> ta`);
      if (patchFail > 0) {
        lines.push(`  ⚠️ Xato: <b>${patchFail}</b> ta`);
        for (const e of result.patch.errors) lines.push(`  <code>${ui.escapeHtml(e)}</code>`);
      }
      lines.push(`  🔑 Proxy var: <b>${result.patch.proxyVar}</b> ta patched`);

      lines.push('');
      lines.push(`<b>🌐 DNS Bypass:</b>`);
      lines.push(dnsOk
        ? `  ✅ NRPT relay ishlamoqda (127.0.0.53:53)`
        : `  ❌ Xato: ${ui.escapeHtml(result.dns.error || 'noma\'lum')}`);

      if (vpn !== null) {
        lines.push(vpn
          ? `  🔒 VPN aktiv — ISP interfeysi orqali bypass: <b>${ui.escapeHtml(iface || '?')}</b>`
          : `  🟢 VPN yo'q — to'g'ridan-to'g'ri ulanish`);
      }

      lines.push('');
      lines.push('🐕 Watchdog yoqildi — AG yangilanishidan keyin ham patch saqlanadi.');

      await bot.editMessageText(
        (dnsOk && patchOk > 0
          ? '✅ <b>Bypass muvaffaqiyatli yoqildi!</b>'
          : '⚠️ <b>Bypass qisman yoqildi</b>') + lines.join('\n'),
        { chat_id: chatId, message_id: wait.message_id, parse_mode: 'HTML' }
      );
    } catch (e) {
      await bot.editMessageText(
        `❌ <b>Bypass xatosi:</b>\n<code>${ui.escapeHtml(e.message)}</code>`,
        { chat_id: chatId, message_id: wait.message_id, parse_mode: 'HTML' }
      );
    }
  });

  // ─── /unbypass — DNS bypassni o'chirish ───────────────────────────────────
  bot.onText(/^\/unbypass$|^🔒 Unbypass$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id;
    try {
      if (!bypass.isEnabled()) {
        return sendHtml(bot, chatId, 'ℹ️ <b>Bypass faol emas.</b> Tizim sozlamalari o\'zgartirilmadi.');
      }
      bypass.disable(true);
      sendHtml(bot, chatId,
        '🔒 <b>Bypass o\'chirildi.</b>\n\n' +
        '• DNS relay to\'xtatildi\n' +
        '• Bot NRPT qoidalari o\'chirildi\n' +
        '• hosts yozuvlari tozalandi\n' +
        '• Watchdog to\'xtatildi'
      );
    } catch (e) {
      sendHtml(bot, chatId, `❌ <b>Xato:</b> <code>${ui.escapeHtml(e.message)}</code>`);
    }
  });

  // ─── /bypassstatus — holat tekshirish ─────────────────────────────────────
  bot.onText(/^\/bypassstatus$/, (msg) => {
    if (!config.isAdmin(msg.chat.id)) return;
    const chatId = msg.chat.id;
    const st     = bypass.status();
    const insp   = bypass.inspect();

    let lines = ['<b>🔍 Bypass holati:</b>', ''];
    lines.push(`DNS Relay: ${st.dns.relayRunning ? '🟢 Ishlayapti' : '🔴 To\'xtatilgan'}`);
    lines.push(`NRPT qoidalari: ${st.dns.nrptApplied ? '🟢 O\'rnatilgan' : '🔴 Yo\'q'}`);
    lines.push(`VPN: ${st.dns.vpnActive === true ? '🔒 Aktiv' : st.dns.vpnActive === false ? '🟢 Yo\'q' : '❓ Noma\'lum'}`);
    if (st.dns.ifName) lines.push(`ISP Interface: <code>${ui.escapeHtml(st.dns.ifName)}</code>`);
    lines.push(`Watchdog: ${st.watchdog ? '🟢 Ishlayapti' : '🔴 To\'xtatilgan'}`);

    if (insp.length > 0) {
      lines.push('', '<b>📦 Binary holati:</b>');
      for (const { path: p, eligibility, proxyVar } of insp) {
        const eIcon = eligibility === 'PATCHED' ? '✅' : eligibility === 'UNPATCHED' ? '🔴' : '❓';
        const pIcon = proxyVar    === 'PATCHED' ? '✅' : proxyVar    === 'UNPATCHED' ? '🔴' : '❓';
        lines.push(`${eIcon}${pIcon} <code>${ui.escapeHtml(require('path').basename(p))}</code>`);
      }
    } else {
      lines.push('', '⚠️ Antigravity binaries topilmadi.');
    }

    sendHtml(bot, chatId, lines.join('\n'));
  });
}

module.exports = {
  registerCommands
};
