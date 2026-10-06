const { exec } = require('child_process');
const fs       = require('fs');
const path     = require('path');
const config   = require('./config');
const { saveSessions, getSession, getActiveSession } = require('./sessions');
const { saveLimitRecords } = require('./limits');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shortPath(p) {
  try {
    const os = require('os');
    return String(p).replace(os.homedir(), '~');
  } catch (_) {
    return String(p);
  }
}

/**
 * Foydalanuvchi joriy sessiyasi yoki ko'rsatilgan sessiyaning o'zgarishlarini saqlaydi
 * (Git commit qiladi yoki sessiya ma'lumotlarini diskka yozadi).
 */
function saveChanges(chatId, sid) {
  return new Promise((resolve) => {
    const sess = (sid ? getSession(sid) : null) || getActiveSession(chatId);
    const targetCwd = (sess && sess.cwd) || config.getDefaultCwd() || process.cwd();

    // 1. Dastur holati va sessiyalarni JSON ga saqlash
    saveSessions();
    saveLimitRecords();

    // 2. Ushbu papkada Git bor-yo'qligini tekshirish
    const gitDir = path.join(targetCwd, '.git');
    const hasGit = fs.existsSync(gitDir);

    if (hasGit) {
      exec('git status -s', { cwd: targetCwd }, (err, statusOut) => {
        const changedFiles = (statusOut || '').trim();

        if (!changedFiles) {
          return resolve({
            success: true,
            hasGit: true,
            hasChanges: false,
            message: (
              '💾 <b>O\'zgarishlar saqlandi!</b>\n' +
              `📁 Jild: <code>${escapeHtml(shortPath(targetCwd))}</code>\n\n` +
              'ℹ️ <i>Git holati toza, fayllarda yangi o\'zgarishlar yo\'q.\nSessiya sozlamalari va limitlar diskka saqlandi.</i>'
            )
          });
        }

        const timestamp = new Date().toLocaleString('uz-UZ');
        const commitMsg = `Antigravity save: ${timestamp}`;

        exec(`git add -A && git commit -m "${commitMsg}"`, { cwd: targetCwd }, (commitErr) => {
          if (commitErr) {
            return resolve({
              success: false,
              hasGit: true,
              hasChanges: true,
              message: (
                '💾 <b>Sessiya saqlandi, ammo Git commit qilishda xato:</b>\n' +
                `<pre>${escapeHtml(commitErr.message)}</pre>`
              )
            });
          }

          const fileLines = changedFiles.split('\n').slice(0, 15).map(l => `• <code>${escapeHtml(l)}</code>`).join('\n');
          const extra = changedFiles.split('\n').length > 15 ? '\n<i>... va boshqa fayllar</i>' : '';

          return resolve({
            success: true,
            hasGit: true,
            hasChanges: true,
            commitMsg,
            message: (
              '💾 <b>Barcha o\'zgarishlar Git omboriga saqlandi!</b>\n' +
              '━'.repeat(26) + '\n' +
              `📁 <b>Jild:</b> <code>${escapeHtml(shortPath(targetCwd))}</code>\n` +
              `📝 <b>Kommit:</b> <code>${escapeHtml(commitMsg)}</code>\n\n` +
              '<b>Saqlangan fayllar:</b>\n' +
              fileLines + extra + '\n' +
              '━'.repeat(26)
            )
          });
        });
      });
    } else {
      resolve({
        success: true,
        hasGit: false,
        hasChanges: false,
        message: (
          '💾 <b>O\'zgarishlar saqlandi!</b>\n' +
          `📁 Jild: <code>${escapeHtml(shortPath(targetCwd))}</code>\n\n` +
          'ℹ️ <i>Sessiya holati, faol model va tezlik sozlamalari diskka muvaffaqiyatli saqlandi.</i>\n' +
          '💡 <i>Eslatma: Bu papkada Git initsializatsiya qilinmagan. <code>git init</code> qilsangiz, avtomatik commit ham qilinadi.</i>'
        )
      });
    }
  });
}

module.exports = {
  saveChanges
};
