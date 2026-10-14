/**
 * 🤖 AGY CLI Runner Moduli
 * Antigravity agentini terminalda xavfsiz ishga tushirish,
 * xatoliklarni filtrlash va natijani Telegram va Web interfeysga qaytarish.
 */

const { exec }   = require('child_process');
const config     = require('./config');
const { getModelInfo, getEffortInfo } = require('./models');
const { recordRequest, get5HourStats } = require('./limits');
const { saveSessions } = require('./sessions');
const ui         = require('./ui');
const { sendHtml, cleanEncodingArtifacts, filterDiagnosticStderr } = require('./utils');

/**
 * Universal AGY buyruq bajaruvchi funksiya (Telegram va Web uchun umumiy)
 */
function executeAgy({ sess, text, onProgress }) {
  return new Promise((resolve) => {
    const currentModel  = sess.model  || config.getGlobalModel();
    const currentEffort = sess.effort || config.getGlobalEffort();
    const mInfo         = getModelInfo(currentModel);

    let modelArgs = `--model "${currentModel}"`;
    if (mInfo.supportsEffort) {
      modelArgs += ` --effort ${currentEffort}`;
    }

    const agyContinue = !sess.isNewConv;
    sess.isNewConv    = false;

    const safeText = text.replace(/\\/g, '/').replace(/"/g, '\\"');
    const safeCwd  = sess.cwd.replace(/\\/g, '/');

    // AGY uchun ko'rsatma: xatoliklarsiz, aniq va tez ishlash
    const promptInstruction = (
      `MUHIM: Faqat AMAL qil. Reja tuzma. Ishchi jild: ${safeCwd}. ` +
      `TELEGRAM API: ` +
      `Fayl: curl.exe -s -X POST \\"http://127.0.0.1:${config.LOCAL_API_PORT}/send-file\\" -H \\"Content-Type: application/json\\" -d \\"{\\\\\\"file\\\\\\":\\\\\\"TO'LIQ_YO'L\\\\\\"}\\" ` +
      `(yoki GET --data-urlencode \\"file=TO'LIQ_YO'L\\"). ` +
      `Xabar: curl.exe -s -X POST \\"http://127.0.0.1:${config.LOCAL_API_PORT}/send-msg\\" -H \\"Content-Type: application/json; charset=utf-8\\" -d \\"{\\\\\\"text\\\\\\":\\\\\\"XABAR\\\\\\"}\\". ` +
      `DIQQAT: Windows konsolida belgilar (??) buzilib qolmasligi uchun xabarlarda emojilardan saqlan, faqat toza matn yubor! ` +
      `Foydalanuvchi: ${safeText}`
    );

    const execCommand = (
      `${config.AGY_BIN} ${agyContinue ? '-c ' : ''}${modelArgs} ` +
      `--dangerously-skip-permissions --mode accept-edits --print-timeout 15m ` +
      `-p "${promptInstruction}"`
    );

    sess.history.push(text);
    sess.cmdCount = (sess.cmdCount || 0) + 1;
    if (sess.history.length > 50) sess.history.shift();
    saveSessions();

    const startTime = Date.now();
    let progressInterval = null;
    if (typeof onProgress === 'function') {
      progressInterval = setInterval(onProgress, 4500);
    }

    const child = exec(execCommand, {
      cwd: sess.cwd,
      timeout: 900000,
      detached: true,
      encoding: 'utf8',
      env: Object.assign({}, process.env, {
        PYTHONIOENCODING: 'utf-8',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8'
      })
    }, (error, stdout, stderr) => {
      if (progressInterval) clearInterval(progressInterval);
      sess.proc = null;

      const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

      recordRequest(currentModel, currentEffort, sess.id);
      const curStats = get5HourStats(currentModel);

      // Stderr dagi ichki xabarlarni filtrlash
      const filteredStderr = filterDiagnosticStderr(stderr);

      let output = (stdout || '').trim();
      if (!output && filteredStderr) {
        output = filteredStderr;
      } else if (error && filteredStderr) {
        output += '\n\n⚠️ Xatolik:\n' + filteredStderr;
      }

      if (!output && error) {
        output = 'Exit code: ' + (error.code || '?');
      }
      if (!output) {
        output = 'Bajarildi.';
      }

      output = cleanEncodingArtifacts(output);
      output = ui.truncate(output.trim());

      resolve({
        success: !error,
        output,
        durationSec,
        curStats,
        error: error ? error.message : null
      });
    });

    if (child && child.pid) {
      sess.proc = child;
    }
  });
}

/**
 * Telegram bot orqali AGY agentini ishga tushirish funksiyasi
 */
async function runAgy({ bot, chatId, sess, text, replyToMsgId }) {
  const currentModel  = sess.model  || config.getGlobalModel();
  const currentEffort = sess.effort || config.getGlobalEffort();
  const mInfo         = getModelInfo(currentModel);
  const effInfo       = getEffortInfo(currentEffort);

  const modelBadge = `${mInfo.emoji} ${mInfo.label} [${effInfo.emoji} ${effInfo.label}]`;
  const statusText = (
    `⏳ <b>${ui.escapeHtml(sess.name)}</b>: bajarilmoqda...\n` +
    `🤖 Model: <b>${ui.escapeHtml(modelBadge)}</b>\n` +
    `📁 Jild: <code>${ui.escapeHtml(ui.shortPath(sess.cwd))}</code>`
  );

  try {
    const sentMsg = await bot.sendMessage(chatId, statusText, {
      parse_mode: 'HTML',
      reply_to_message_id: replyToMsgId,
      reply_markup: {
        inline_keyboard: [[
          { text: '🛑 To\'xtatish',     callback_data: 'kill_' + sess.id },
          { text: '📊 5-Soatlik Limit', callback_data: 'refresh_limit' }
        ]]
      }
    });

    const result = await executeAgy({
      sess,
      text,
      onProgress: () => bot.sendChatAction(chatId, 'typing').catch(() => {})
    });

    bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});

    const footer = `\n\n<i>⚡ ${result.durationSec}s · ${result.curStats.total5h}/${result.curStats.maxLimit}</i>`;
    const resultMsg = `${ui.escapeHtml(result.output)}${footer}`;

    sendHtml(bot, chatId, resultMsg, {
      reply_to_message_id: replyToMsgId
    });

  } catch (e) {
    console.error('AGY runner xatosi:', e.message);
  }
}

module.exports = {
  executeAgy,
  runAgy
};
