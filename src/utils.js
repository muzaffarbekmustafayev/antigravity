/**
 * Telegram yordamchi funksiyalari va matn tozalash utilitalari
 */

/**
 * Matndagi HTML maxsus belgilarini xavfsiz qilish
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Xabarni HTML formatida xavfsiz yuborish (xato bo'lsa teglarsiz qayta urinadi)
 */
function sendHtml(bot, chatId, text, options) {
  return bot.sendMessage(chatId, text, Object.assign({ parse_mode: 'HTML' }, options || {}))
    .catch((err) => {
      console.error('sendHtml xatosi:', err.message);
      const clean = String(text || '').replace(/<[^>]*>/g, '');
      return bot.sendMessage(chatId, clean, options || {});
    });
}

/**
 * Mavjud xabarni HTML formatida xavfsiz tahrirlash
 */
function editHtml(bot, chatId, msgId, text, options) {
  return bot.editMessageText(text, Object.assign({
    chat_id: chatId,
    message_id: msgId,
    parse_mode: 'HTML'
  }, options || {})).catch(() => {});
}

/**
 * Windows terminali yoki kodirovka buzilishi sababli paydo bo'lgan '??' belgilarini tozalash
 */
function cleanEncodingArtifacts(text) {
  if (!text) return '';
  return String(text)
    // Qator boshidagi '?? ' yoki '? ' belgilarini olib tashlash
    .replace(/^(\?\?+|\?)\s+/gm, '')
    // Alohida '??' emojilar o'rnida qolgan bo'lsa tozalash
    .replace(/\s+(\?\?+)\s+/g, ' ');
}

/**
 * AGY ichki diagnostika (stderr) xabarlarini filtrlash
 */
function filterDiagnosticStderr(stderr) {
  if (!stderr) return '';
  return String(stderr)
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/root agent idle/i.test(trimmed)) return false;
      if (/waiting up to/i.test(trimmed) && /background task/i.test(trimmed)) return false;
      if (/yolo mode is enabled/i.test(trimmed)) return false;
      if (/loaded plugins/i.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

const os = require('os');

/**
 * Mahalliy tarmoqdagi (LAN) IPv4 manzilini aniqlash
 */
function getLanIp() {
  try {
    const ifaces = os.networkInterfaces();
    for (const dev in ifaces) {
      for (const details of ifaces[dev]) {
        if (details.family === 'IPv4' && !details.internal) {
          return details.address;
        }
      }
    }
  } catch (_) {}
  return 'localhost';
}

module.exports = {
  escapeHtml,
  sendHtml,
  editHtml,
  cleanEncodingArtifacts,
  filterDiagnosticStderr,
  getLanIp
};
