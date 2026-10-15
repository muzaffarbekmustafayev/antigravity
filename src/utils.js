/**
 * Antigravity umumiy yordamchi utilitalari
 */

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
  cleanEncodingArtifacts,
  filterDiagnosticStderr,
  getLanIp
};
