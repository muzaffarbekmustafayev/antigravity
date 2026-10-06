const os     = require('os');
const config = require('./config');
const { AVAILABLE_MODELS, EFFORT_LEVELS, getModelInfo, getEffortInfo } = require('./models');
const { get5HourStats } = require('./limits');
const { sessions, activeSession } = require('./sessions');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shortPath(p) {
  try {
    return String(p).replace(os.homedir(), '~');
  } catch (_) {
    return String(p);
  }
}

function truncate(text, max = config.MAX_OUTPUT) {
  if (text.length > max)
    return text.substring(0, max) + '\n\n[... Qolgan natija qisqartirildi ...]';
  return text;
}

function buildProgressBar(used, max, length = 10) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const filled = Math.min(length, Math.floor((pct / 100) * length));
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${pct}%`;
}

// ─── Asosiy Doimiy Klaviatura (Reply Keyboard) ────────────────────────────────
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: '📂 Sessiyalar' }, { text: '🤖 Model' }, { text: '⚡ Tezlik' }],
    [{ text: '📊 5-Soatlik Limit' }, { text: '💾 Saqlash' }, { text: '📍 Papka (pwd)' }],
    [{ text: '📁 Fayllar (ls)' }, { text: '📜 Tarix' }, { text: '💻 Tizim' }],
    [{ text: '🛑 To\'xtatish' }, { text: '⚙️ Sozlamalar' }, { text: '❓ Yordam' }],
  ],
  resize_keyboard: true,
  persistent: true,
};

// ─── Sessiyalar Ro'yxati UI ───────────────────────────────────────────────────
function buildSessionsKeyboard(chatId) {
  const activeSid = activeSession.get(chatId.toString());
  const buttons   = [];

  for (const [sid, sess] of sessions) {
    const isAct   = sid === activeSid;
    const mInfo   = getModelInfo(sess.model);
    const effInfo = getEffortInfo(sess.effort);
    const runTag  = sess.proc ? ' ⚙️' : '';
    const label   = `${isAct ? '⭐ ' : ''}${sess.name} [${mInfo.emoji} ${effInfo.emoji}]${runTag}`;

    buttons.push([
      { text: label,             callback_data: 'sess_view_' + sid },
      { text: isAct ? '✅ Tanlangan' : '👉 O\'tish', callback_data: 'sess_sel_' + sid }
    ]);
  }

  buttons.push([
    { text: '➕ Yangi sessiya ochish', callback_data: 'new_session' },
    { text: '🔄 Yangilash',            callback_data: 'refresh_sessions' }
  ]);

  return { inline_keyboard: buttons };
}

function buildSessionsListText(chatId) {
  const activeSid = activeSession.get(chatId.toString());
  if (sessions.size === 0) {
    return '📋 <b>Sessiyalar yo\'q</b>\n\nYangi sessiya ochish uchun <b>➕ Yangi sessiya</b> tugmasini bosing.';
  }

  const lines = [];
  for (const [sid, sess] of sessions) {
    const isAct   = sid === activeSid;
    const mInfo   = getModelInfo(sess.model);
    const effInfo = getEffortInfo(sess.effort);
    const runTag  = sess.proc ? ' <i>(⚙️ bajarilmoqda)</i>' : '';
    const status  = isAct ? '⭐ <b>[FAOL]</b>' : '💤 [Kutmoqda]';

    lines.push(
      `${status} <b>${escapeHtml(sess.name)}</b> (ID: <code>${sid}</code>)${runTag}\n` +
      `   └ 🤖 <b>${escapeHtml(mInfo.label)}</b> | ⚡ <b>${escapeHtml(effInfo.label)}</b>\n` +
      `   └ 📁 <code>${escapeHtml(shortPath(sess.cwd))}</code> | 📊 Buyruqlar: <b>${sess.cmdCount || sess.history.length} ta</b>`
    );
  }

  return (
    '📋 <b>Mavjud Antigravity Sessiyalari:</b>\n' +
    '━'.repeat(26) + '\n\n' +
    lines.join('\n\n') + '\n\n' +
    '━'.repeat(26) + '\n' +
    '<i>Sessiyani boshqarish uchun uning tugmasini bosing.</i>'
  );
}

// ─── Aniq Sessiya Kartasi ─────────────────────────────────────────────────────
function buildSessionDetailText(sess, chatId) {
  const isAct   = sess.id === activeSession.get(chatId.toString());
  const mInfo   = getModelInfo(sess.model);
  const effInfo = getEffortInfo(sess.effort);
  const statusStr = sess.proc
    ? '⚙️ <b>Bajarilmoqda</b> (Jarayon faol)'
    : isAct ? '⭐ <b>Faol sessiya</b>' : '💤 <b>Kutish rejimida</b>';

  return (
    `📌 <b>Sessiya Tafsilotlari:</b> <code>${escapeHtml(sess.name)}</code>\n` +
    '━'.repeat(26) + '\n' +
    `🆔 <b>ID:</b> <code>${sess.id}</code>\n` +
    `📊 <b>Holat:</b> ${statusStr}\n` +
    `📁 <b>Ishchi jild:</b> <code>${escapeHtml(shortPath(sess.cwd))}</code>\n` +
    `🤖 <b>Model:</b> ${mInfo.emoji} <b>${escapeHtml(mInfo.label)}</b>\n` +
    `⚡ <b>Tezlik (Effort):</b> ${effInfo.emoji} <b>${escapeHtml(effInfo.label)}</b>\n` +
    `📝 <b>Jami buyruqlar:</b> <b>${sess.cmdCount || sess.history.length} ta</b>\n` +
    `⏱️ <b>Yaratilgan:</b> ${new Date(sess.createdAt).toLocaleTimeString('uz-UZ')}\n` +
    '━'.repeat(26) + '\n' +
    '<i>Quyidagi tugmalar orqali ushbu sessiyani to\'liq sozlang:</i>'
  );
}

function buildSessionDetailKeyboard(sess, chatId) {
  const isAct = sess.id === activeSession.get(chatId.toString());
  const rows  = [];

  // Tanlash
  if (!isAct) {
    rows.push([{ text: '⭐ Shu sessiyaga o\'tish (Faollashtirish)', callback_data: 'sess_sel_' + sess.id }]);
  }

  // Model va Tezlik
  rows.push([
    { text: '🤖 Modelni o\'zgartirish',  callback_data: 'sess_model_' + sess.id },
    { text: '⚡ Tezlikni o\'zgartirish', callback_data: 'sess_effort_' + sess.id },
  ]);

  // Papka va Yangilash
  rows.push([
    { text: '📁 Papkani o\'zgartirish', callback_data: 'sess_setcwd_' + sess.id },
    { text: '🔄 Suhbatni tozalash',     callback_data: 'sess_reset_' + sess.id },
  ]);

  // O'zgarishlarni saqlash
  rows.push([
    { text: '💾 O\'zgarishlarni saqlash', callback_data: 'sess_save_' + sess.id },
    { text: '✏️ Nomini o\'zgartirish',   callback_data: 'sess_rename_' + sess.id },
  ]);

  // Tarix
  rows.push([
    { text: '📜 So\'nggi buyruqlar',     callback_data: 'sess_hist_' + sess.id },
  ]);

  // Jarayon ishlayotgan bo'lsa
  if (sess.proc) {
    rows.push([{ text: '🛑 Jarayonni to\'xtatish', callback_data: 'kill_' + sess.id }]);
  }

  // Yopish va Ortga
  rows.push([
    { text: '❌ Sessiyani yopish', callback_data: 'sess_close_' + sess.id },
    { text: '🔙 Barcha sessiyalar', callback_data: 'open_sessions' },
  ]);

  return { inline_keyboard: rows };
}

// ─── Model Tanlash UI ─────────────────────────────────────────────────────────
function buildModelKeyboard(targetSid) {
  const rows = [];
  for (let i = 0; i < AVAILABLE_MODELS.length; i += 2) {
    const row = [];
    for (let j = i; j < Math.min(i + 2, AVAILABLE_MODELS.length); j++) {
      const m = AVAILABLE_MODELS[j];
      const cb = targetSid ? `set_sess_model_${targetSid}_${m.id}` : `setmodel_${m.id}`;
      row.push({
        text: `${m.emoji} ${m.label}`,
        callback_data: cb
      });
    }
    rows.push(row);
  }
  const backCb = targetSid ? `sess_view_${targetSid}` : 'model_close';
  rows.push([{ text: '🔙 Ortga', callback_data: backCb }]);
  return { inline_keyboard: rows };
}

function buildModelText(currentModelId, currentEffortId) {
  const m   = getModelInfo(currentModelId);
  const eff = getEffortInfo(currentEffortId);
  const lines = AVAILABLE_MODELS.map(x => {
    const isAct = x.id === currentModelId ? ' ✅' : '';
    const effortTag = x.supportsEffort ? ' [⚡ Tezlik tanlash mumkin]' : '';
    return `• <b>${x.emoji} ${escapeHtml(x.label)}</b>${isAct} — <i>${escapeHtml(x.desc)}</i>${effortTag}`;
  });

  return (
    '🤖 <b>Google Antigravity Modellari:</b>\n' +
    '━'.repeat(26) + '\n' +
    `🎯 <b>Hozirgi faol model:</b> ${m.emoji} <b>${escapeHtml(m.label)}</b>\n` +
    `⚡ <b>Hozirgi tezlik:</b> ${eff.emoji} <b>${escapeHtml(eff.label)}</b>\n\n` +
    '<b>Mavjud modellar ro\'yxati:</b>\n' +
    lines.join('\n') + '\n\n' +
    '━'.repeat(26) + '\n' +
    '<i>O\'zgartirish uchun kerakli model tugmasini bosing:</i>'
  );
}

// ─── Tezlik (Effort) UI ───────────────────────────────────────────────────────
function buildEffortKeyboard(targetSid) {
  const rows = EFFORT_LEVELS.map(e => {
    const cb = targetSid ? `set_sess_effort_${targetSid}_${e.id}` : `seteffort_${e.id}`;
    return [{
      text: `${e.emoji} ${e.label}`,
      callback_data: cb
    }];
  });

  const backCb = targetSid ? `sess_view_${targetSid}` : 'open_models';
  rows.push([{ text: '🔙 Ortga', callback_data: backCb }]);
  return { inline_keyboard: rows };
}

function buildEffortText(currentEffortId, currentModelId) {
  const eff = getEffortInfo(currentEffortId);
  const m   = getModelInfo(currentModelId);

  const lines = EFFORT_LEVELS.map(e => {
    const isAct = e.id === currentEffortId ? ' ✅' : '';
    return `• ${e.emoji} <b>${escapeHtml(e.label)}</b>${isAct}\n   └ <i>${escapeHtml(e.desc)}</i>`;
  });

  return (
    '⚡ <b>Model Ishlash Tezligi (Reasoning Effort):</b>\n' +
    '━'.repeat(26) + '\n' +
    `🤖 <b>Model:</b> ${m.emoji} <b>${escapeHtml(m.label)}</b>\n` +
    `🎯 <b>Hozirgi tezlik:</b> ${eff.emoji} <b>${escapeHtml(eff.label)}</b>\n\n` +
    '<b>Tezlik darajalari:</b>\n\n' +
    lines.join('\n\n') + '\n\n' +
    '━'.repeat(26) + '\n' +
    '<i>Tezlikni o\'zgartirish uchun quyidagi tugmalardan birini bosing:</i>'
  );
}

// ─── 5-Soatlik Limit Ko'rsatkich Matni ─────────────────────────────────────────
function buildLimitText(chatId) {
  const sid   = activeSession.get(chatId.toString());
  const sess  = sessions.get(sid);
  const mid   = sess ? sess.model : config.getGlobalModel();
  const mInfo = getModelInfo(mid);
  const stats = get5HourStats(mid);

  const bar = buildProgressBar(stats.total5h, stats.maxLimit, 12);

  let statusEmoji = '🟢 Yaxshi (Mo\'l limit)';
  if (stats.usedPct >= 90) statusEmoji = '🔴 Diqqat (Limit deyarli to\'lgan!)';
  else if (stats.usedPct >= 70) statusEmoji = '🟡 O\'rtacha (Limit sarflanmoqda)';

  let recoveryText = 'Limit to\'liq va foydalanishga tayyor.';
  if (stats.nextRecovery) {
    const timeStr = new Date(stats.nextRecovery).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    recoveryText = `Eng birinchi so'rov <b>${stats.nextRecoveryMins} daqiqadan so'ng</b> (soat <code>${timeStr}</code> da) oynadan chiqib, limit bo'shaydi.`;
  }

  const modelBreakdown = Object.entries(stats.byModel).map(([modId, cnt]) => {
    const inf = getModelInfo(modId);
    return `   • ${inf.emoji} ${escapeHtml(inf.label)}: <b>${cnt} ta</b>`;
  }).join('\n') || '   • <i>Hali so\'rov yuborilmadi</i>';

  return (
    '📊 <b>Antigravity 5-Soatlik Limit &amp; Statistika:</b>\n' +
    '━'.repeat(26) + '\n' +
    `🤖 <b>Aktiv Model:</b> ${mInfo.emoji} <b>${escapeHtml(mInfo.label)}</b>\n` +
    `⚡ <b>Tezlik (Effort):</b> ${getEffortInfo(sess ? sess.effort : config.getGlobalEffort()).emoji} <b>${escapeHtml(getEffortInfo(sess ? sess.effort : config.getGlobalEffort()).label)}</b>\n\n` +
    `⏳ <b>5-SOATLIK OYNA STATUSI:</b>\n` +
    `📈 Holat: <b>${statusEmoji}</b>\n` +
    `🔢 Ishlatilgan so'rovlar: <b>${stats.total5h} / ${stats.maxLimit} ta</b>\n` +
    `🔋 Qolgan so'rovlar: <b>${stats.remaining} ta</b>\n` +
    `📊 Oyna yuklanishi: <code>[${bar}]</code>\n\n` +
    `⏱️ <b>Limit tiklanishi:</b>\n` +
    `└ ${recoveryText}\n\n` +
    `🤖 <b>Modellar bo'yicha (so'nggi 5 soat):</b>\n` +
    modelBreakdown + '\n\n' +
    `⚡ <b>Tezlik bo'yicha:</b> High: <b>${stats.byEffort.high}</b> | Medium: <b>${stats.byEffort.medium}</b> | Low: <b>${stats.byEffort.low}</b>\n` +
    `📅 <b>Bugungi jami (24 soat):</b> <b>${stats.todayTotal} ta so'rov</b>\n` +
    '━'.repeat(26) + '\n' +
    '💡 <i>Limit har bir 5 soatlik sirg\'aluvchi (rolling window) oraliqda avtomatik tiklanadi.</i>'
  );
}

// ─── Tizim Ma'lumotlari Matni ─────────────────────────────────────────────────
function buildSysInfoText() {
  const cpus = os.cpus();
  const freeMemMB  = Math.round(os.freemem() / 1024 / 1024);
  const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
  const usedMemMB  = totalMemMB - freeMemMB;
  const memPct     = Math.round((usedMemMB / totalMemMB) * 100);

  return (
    '💻 <b>Tizim va Server Diagnostikasi:</b>\n' +
    '━'.repeat(26) + '\n' +
    `🖥️ <b>OS:</b> <code>${escapeHtml(os.type())} ${escapeHtml(os.release())} (${os.arch()})</code>\n` +
    `🧠 <b>CPU:</b> <code>${escapeHtml(cpus[0].model)}</code> (${cpus.length} yadro)\n` +
    `📊 <b>RAM:</b> <code>${usedMemMB} MB / ${totalMemMB} MB (${memPct}%)</code>\n` +
    `👤 <b>Foydalanuvchi:</b> <code>${escapeHtml(os.userInfo().username)}</code>\n` +
    `📁 <b>Home:</b> <code>${escapeHtml(os.homedir())}</code>\n` +
    `⏱️ <b>Server Uptime:</b> <b>${Math.round(process.uptime() / 60)} daqiqa</b>\n` +
    `🤖 <b>AGY CLI:</b> <code>${escapeHtml(config.AGY_BIN)}</code>\n` +
    '━'.repeat(26)
  );
}

module.exports = {
  escapeHtml,
  shortPath,
  truncate,
  buildProgressBar,
  MAIN_KEYBOARD,
  buildSessionsKeyboard,
  buildSessionsListText,
  buildSessionDetailText,
  buildSessionDetailKeyboard,
  buildModelKeyboard,
  buildModelText,
  buildEffortKeyboard,
  buildEffortText,
  buildLimitText,
  buildSysInfoText
};
