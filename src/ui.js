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
    [{ text: '🤖 Model' }, { text: '⚡ Tezlik' }, { text: '📊 Limit' }],
    [{ text: '📂 Sessiyalar' }, { text: '💾 Saqlash' }, { text: '📁 Fayllar' }],
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
    const label   = `${isAct ? '⭐ ' : ''}${sess.name} [${mInfo.emoji} ${effInfo.label}]${runTag}`;

    buttons.push([
      { text: label,             callback_data: 'sess_view_' + sid },
      { text: isAct ? '✅ Tanlangan' : '👉 O\'tish', callback_data: 'sess_sel_' + sid }
    ]);
  }

  buttons.push([
    { text: '➕ Yangi sessiya', callback_data: 'new_session' },
    { text: '🔄 Yangilash',     callback_data: 'refresh_sessions' }
  ]);

  return { inline_keyboard: buttons };
}

function buildSessionsListText(chatId) {
  const activeSid = activeSession.get(chatId.toString());
  if (sessions.size === 0) {
    return '📂 <b>Sessiyalar yo\'q.</b>';
  }

  const lines = [];
  for (const [sid, sess] of sessions) {
    const isAct   = sid === activeSid;
    const mInfo   = getModelInfo(sess.model);
    const effInfo = getEffortInfo(sess.effort);
    const runTag  = sess.proc ? ' ⚙️' : '';
    const mark    = isAct ? '⭐ ' : '';

    lines.push(
      `${mark}<b>${escapeHtml(sess.name)}</b> [${mInfo.emoji} ${effInfo.label}]${runTag}\n` +
      `📁 <code>${escapeHtml(shortPath(sess.cwd))}</code> · <b>${sess.cmdCount || sess.history.length} ta</b>`
    );
  }

  return `📂 <b>Sessiyalar:</b>\n\n${lines.join('\n\n')}`;
}

// ─── Aniq Sessiya Kartasi ─────────────────────────────────────────────────────
function buildSessionDetailText(sess, chatId) {
  const isAct   = sess.id === activeSession.get(chatId.toString());
  const mInfo   = getModelInfo(sess.model);
  const effInfo = getEffortInfo(sess.effort);
  const statusStr = sess.proc
    ? '⚙️ Bajarilmoqda'
    : isAct ? '⭐ Faol' : '💤 Kutmoqda';

  return (
    `📌 <b>${escapeHtml(sess.name)}</b> (${statusStr})\n\n` +
    `🤖 <b>Model:</b> ${mInfo.emoji} ${escapeHtml(mInfo.label)}\n` +
    `⚡ <b>Tezlik:</b> ${effInfo.label}\n` +
    `📁 <b>Jild:</b> <code>${escapeHtml(shortPath(sess.cwd))}</code>\n` +
    `📊 <b>Buyruqlar:</b> ${sess.cmdCount || sess.history.length} ta`
  );
}

function buildSessionDetailKeyboard(sess, chatId) {
  const isAct = sess.id === activeSession.get(chatId.toString());
  const rows  = [];

  // Tanlash
  if (!isAct) {
    rows.push([{ text: '⭐ Shu sessiyaga o\'tish', callback_data: 'sess_sel_' + sess.id }]);
  }

  // Model va Tezlik
  rows.push([
    { text: '🤖 Model',  callback_data: 'sess_model_' + sess.id },
    { text: '⚡ Tezlik', callback_data: 'sess_effort_' + sess.id },
  ]);

  // Papka va Yangilash
  rows.push([
    { text: '📁 Jild',   callback_data: 'sess_setcwd_' + sess.id },
    { text: '🔄 Tozalash', callback_data: 'sess_reset_' + sess.id },
  ]);

  // O'zgarishlarni saqlash va Nom
  rows.push([
    { text: '💾 Saqlash', callback_data: 'sess_save_' + sess.id },
    { text: '✏️ Nom',     callback_data: 'sess_rename_' + sess.id },
  ]);

  // Tarix
  rows.push([
    { text: '📜 So\'nggi buyruqlar', callback_data: 'sess_hist_' + sess.id },
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

  return (
    `🤖 <b>Model:</b> ${m.emoji} ${escapeHtml(m.label)}\n` +
    `⚡ <b>Tezlik:</b> ${eff.label}\n\n` +
    `Kerakli modelni tanlang:`
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

  return (
    `⚡ <b>Tezlik:</b> ${eff.emoji} ${escapeHtml(eff.label)}\n` +
    `🤖 <b>Model:</b> ${escapeHtml(m.label)}\n\n` +
    `Kerakli tezlikni tanlang:`
  );
}

// ─── 5-Soatlik Limit Ko'rsatkich Matni ─────────────────────────────────────────
function buildLimitText(chatId) {
  const sid   = activeSession.get(chatId.toString());
  const sess  = sessions.get(sid);
  const mid   = sess ? sess.model : config.getGlobalModel();
  const mInfo = getModelInfo(mid);
  const stats = get5HourStats(mid);
  const bar   = buildProgressBar(stats.total5h, stats.maxLimit, 8);

  let recovery = '';
  if (stats.nextRecovery) {
    recovery = `\n⏱ Tiklanish: <b>${stats.nextRecoveryMins} daqiqada</b>`;
  }

  return (
    `📊 <b>5-Soatlik Limit:</b> <b>${stats.total5h} / ${stats.maxLimit}</b>\n` +
    `<code>[${bar}]</code> · Qoldi: <b>${stats.remaining}</b>\n\n` +
    `🤖 <b>Model:</b> ${mInfo.emoji} ${escapeHtml(mInfo.label)}${recovery}\n` +
    `📅 <b>Bugun:</b> ${stats.todayTotal} ta so'rov`
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
    `💻 <b>Tizim:</b>\n` +
    `🖥️ ${escapeHtml(os.type())} (${escapeHtml(os.arch())})\n` +
    `🧠 CPU: ${cpus.length}x ${escapeHtml(cpus[0].model.trim())}\n` +
    `📊 RAM: ${usedMemMB}/${totalMemMB} MB (${memPct}%)\n` +
    `⏱️ Uptime: ${Math.round(process.uptime() / 60)} min`
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
