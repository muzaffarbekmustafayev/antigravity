const fs = require('fs');
const path = require('path');

function clean() {
  console.log('[*] Kesh va vaqtinchalik fayllar tozalanmoqda...');
  const targets = ['dist', '.cache'];
  targets.forEach(d => {
    if (fs.existsSync(d)) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
        console.log('[+] O\'chirildi: ' + d);
      } catch (_) {}
    }
  });
  console.log('[+] Tozalash tugadi.');
}

if (require.main === module) {
  clean();
}

module.exports = { clean };
