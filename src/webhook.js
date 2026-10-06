const http = require('http');
const path = require('path');
const fs   = require('fs');
const config = require('./config');

function startWebhookServer(bot) {
  const server = http.createServer(async (req, res) => {
    const parsed   = new URL(req.url, 'http://127.0.0.1:' + config.LOCAL_API_PORT);
    const endpoint = parsed.pathname;
    const params   = Object.fromEntries(parsed.searchParams);

    res.setHeader('Content-Type', 'application/json');

    // /send-file
    if (endpoint === '/send-file') {
      const filePath = params.file;
      if (!filePath) {
        res.writeHead(400);
        return res.end(JSON.stringify({ ok: false, error: 'file parametri yo\'q' }));
      }
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(config.getDefaultCwd() || process.cwd(), filePath);

      if (!fs.existsSync(absPath)) {
        res.writeHead(404);
        return res.end(JSON.stringify({ ok: false, error: 'Fayl topilmadi: ' + absPath }));
      }

      try {
        await bot.sendDocument(config.ADMIN_ID, absPath, {
          caption: params.caption || `📄 ${path.basename(absPath)}`
        });
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true, sent: absPath }));
      } catch (e) {
        res.writeHead(500);
        return res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    }

    // /send-msg
    if (endpoint === '/send-msg') {
      const text = params.text || '(xabar yo\'q)';
      try {
        await bot.sendMessage(config.ADMIN_ID, text);
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500);
        return res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    }

    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'Noma\'lum endpoint' }));
  });

  server.listen(config.LOCAL_API_PORT, '127.0.0.1', () => {
    console.log(`Local Webhook API: http://127.0.0.1:${config.LOCAL_API_PORT}`);
  });

  return server;
}

module.exports = {
  startWebhookServer
};
