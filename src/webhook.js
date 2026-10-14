/**
 * 🌐 Web Server & API Moduli
 * Antigravity Web Dashboard interfeysi va REST API serverini ta'minlaydi.
 * Shuningdek, Telegram uchun mavjud webhook funksiyalarini (/send-msg, /send-file) qo'llab-quvvatlaydi.
 */

const http   = require('http');
const path   = require('path');
const fs     = require('fs');
const config = require('./config');
const {
  sessions,
  getSession,
  getActiveSession,
  setActiveSession,
  createSession,
  closeSession,
  saveSessions,
  clearSessionHistory,
  deleteHistoryItem
} = require('./sessions');
const { AVAILABLE_MODELS, EFFORT_LEVELS } = require('./models');
const { get5HourStats } = require('./limits');
const { saveChanges }   = require('./git-saver');
const { executeAgy }    = require('./runner');
const { cleanEncodingArtifacts } = require('./utils');
const { getTunnelUrl } = require('./tunnel');


/**
 * HTTP so'rov tanasini (JSON yoki matn) o'qib olish
 */
function readRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      resolve(body.trim());
    });
    req.on('error', () => {
      resolve('');
    });
  });
}

function resolveWithinBaseDir(baseDir, filePath) {
  const base = path.resolve(baseDir || process.cwd());
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(base, filePath);
  const relative = path.relative(base, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Fayl iznli papka tashqarisida bo\'lmaydi.');
  }

  return resolved;
}

function startWebhookServer(bot) {
  const server = http.createServer(async (req, res) => {
    const parsed   = new URL(req.url, 'http://127.0.0.1:' + config.LOCAL_API_PORT);
    const endpoint = parsed.pathname;
    const params   = Object.fromEntries(parsed.searchParams);

    // CORS sarlavhalari
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    let bodyData = {};
    if (req.method === 'POST') {
      const rawBody = await readRequestBody(req);
      if (rawBody) {
        try {
          bodyData = JSON.parse(rawBody);
        } catch (_) {
          bodyData = { text: rawBody };
        }
      }
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // ─── 2. REST API: HOLAT (STATE) ──────────────────────────────────────────
    if (endpoint === '/api/state' && req.method === 'GET') {
      const act = getActiveSession(config.ADMIN_ID || '1');
      const list = [];
      for (const [, s] of sessions) {
        list.push({
          id:        s.id,
          name:      s.name,
          cwd:       s.cwd,
          model:     s.model,
          effort:    s.effort,
          history:   s.history || [],
          cmdCount:  s.cmdCount || 0,
          proc:      s.proc ? { pid: s.proc.pid } : null,
          createdAt: s.createdAt
        });
      }

      const curModel = act ? act.model : config.getGlobalModel();
      const stats    = get5HourStats(curModel);

      res.writeHead(200);
      return res.end(JSON.stringify({
        ok: true,
        sessions: list,
        activeSessionId: act ? act.id : (list[0] ? list[0].id : null),
        models: AVAILABLE_MODELS,
        efforts: EFFORT_LEVELS,
        limits: stats,
        tunnelUrl: getTunnelUrl()
      }));
    }

    // ─── REST API: TUNNEL URL ────────────────────────────────────────────────
    if (endpoint === '/api/tunnel' && req.method === 'GET') {
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true, tunnelUrl: getTunnelUrl() }));
    }

    // ─── 3. REST API: SESSIYA ALMASHTIRISH ────────────────────────────────────
    if (endpoint === '/api/sessions/switch' && req.method === 'POST') {
      const sid = bodyData.sessionId;
      const sess = getSession(sid);
      if (sess) {
        setActiveSession(config.ADMIN_ID || '1', sid);
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true, session: sess }));
      }
      res.writeHead(404);
      return res.end(JSON.stringify({ ok: false, error: 'Sessiya topilmadi' }));
    }

    // ─── 4. REST API: YANGI SESSIYA ───────────────────────────────────────────
    if (endpoint === '/api/sessions/create' && req.method === 'POST') {
      const newSess = createSession(
        bodyData.name || undefined,
        bodyData.cwd  || undefined,
        bodyData.model || undefined,
        bodyData.effort || undefined
      );
      setActiveSession(config.ADMIN_ID || '1', newSess.id);
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true, session: newSess }));
    }

    // ─── 5. REST API: SESSIYANI SOZLASH (UPDATE) ──────────────────────────────
    if (endpoint === '/api/sessions/update' && req.method === 'POST') {
      const sid = bodyData.sessionId;
      const sess = getSession(sid);
      if (!sess) {
        res.writeHead(404);
        return res.end(JSON.stringify({ ok: false, error: 'Sessiya topilmadi' }));
      }

      if (bodyData.name)   sess.name   = bodyData.name;
      if (bodyData.cwd && fs.existsSync(bodyData.cwd)) sess.cwd = bodyData.cwd;
      if (bodyData.model)  sess.model  = bodyData.model;
      if (bodyData.effort) sess.effort = bodyData.effort;

      saveSessions();
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true, session: sess }));
    }

    // ─── 6. REST API: SESSIYANI YOPISH (DELETE) ───────────────────────────────
    if (endpoint === '/api/sessions/delete' && req.method === 'POST') {
      const sid = bodyData.sessionId;
      const name = closeSession(sid, config.ADMIN_ID || '1');
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: !!name, closedName: name }));
    }

    // ─── 7. REST API: SUHBATNI TOZALASH (RESET) ───────────────────────────────
    if (endpoint === '/api/sessions/reset' && req.method === 'POST') {
      const sid = bodyData.sessionId;
      const sess = getSession(sid);
      if (sess) {
        sess.isNewConv = true;
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true }));
      }
      res.writeHead(404);
      return res.end(JSON.stringify({ ok: false, error: 'Sessiya topilmadi' }));
    }

    // ─── 7b. REST API: TARIXNI TOZALASH (CLEAR HISTORY) ──────────────────────
    if (endpoint === '/api/sessions/clear-history' && req.method === 'POST') {
      const sid = bodyData.sessionId;
      const success = clearSessionHistory(sid);
      if (success) {
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true, message: 'Tarix muvaffaqiyatli tozalandi' }));
      }
      res.writeHead(404);
      return res.end(JSON.stringify({ ok: false, error: 'Sessiya topilmadi' }));
    }

    // ─── 7c. REST API: TARIXDAN BITTA ELEMENTNI O'CHIRISH ─────────────────────
    if (endpoint === '/api/sessions/delete-history-item' && req.method === 'POST') {
      const sid = bodyData.sessionId;
      const idx = typeof bodyData.index === 'number' ? bodyData.index : parseInt(bodyData.index);
      const success = deleteHistoryItem(sid, idx);
      if (success) {
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true }));
      }
      res.writeHead(400);
      return res.end(JSON.stringify({ ok: false, error: 'Element o\'chirilmadi' }));
    }

    // ─── 8. REST API: BUYRUQNI BAJARISH (EXECUTE) ─────────────────────────────
    if (endpoint === '/api/execute' && req.method === 'POST') {
      const sid     = bodyData.sessionId;
      const command = (bodyData.command || '').trim();

      if (!command) {
        res.writeHead(400);
        return res.end(JSON.stringify({ ok: false, error: 'Buyruq matni bo\'sh' }));
      }

      const sess = (sid ? getSession(sid) : null) || getActiveSession(config.ADMIN_ID || '1');
      if (!sess) {
        res.writeHead(404);
        return res.end(JSON.stringify({ ok: false, error: 'Sessiya topilmadi' }));
      }

      try {
        const result = await executeAgy({
          sess,
          text: command
        });

        res.writeHead(200);
        return res.end(JSON.stringify({
          ok: true,
          output: result.output,
          durationSec: result.durationSec,
          curStats: result.curStats,
          error: result.error
        }));
      } catch (err) {
        res.writeHead(500);
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    // ─── 9. REST API: JARAYONNI TO'XTATISH (KILL) ────────────────────────────
    if (endpoint === '/api/kill' && req.method === 'POST') {
      const sid  = bodyData.sessionId;
      const sess = getSession(sid);
      if (sess && sess.proc) {
        try {
          process.kill(-sess.proc.pid);
          sess.proc = null;
          res.writeHead(200);
          return res.end(JSON.stringify({ ok: true, message: 'Jarayon to\'xtatildi' }));
        } catch (e) {
          res.writeHead(500);
          return res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      }
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true, message: 'Ishlayotgan jarayon yo\'q' }));
    }

    // ─── 10. REST API: GIT COMMIT & SAVE ──────────────────────────────────────
    if (endpoint === '/api/git/save' && req.method === 'POST') {
      const sid = bodyData.sessionId;
      const resData = await saveChanges(config.ADMIN_ID || '1', sid);
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: resData.success, message: resData.message }));
    }

    // ─── 11. WEBHOOK: /send-file ─────────────────────────────────────────────
    if (endpoint === '/send-file') {
      const filePath = bodyData.file || params.file;
      const caption  = bodyData.caption || params.caption;

      if (!filePath) {
        res.writeHead(400);
        return res.end(JSON.stringify({ ok: false, error: 'file parametri yo\'q' }));
      }
<<<<<<< Updated upstream
      let absPath;
      try {
        absPath = resolveWithinBaseDir(config.getDefaultCwd() || process.cwd(), filePath);
      } catch (e) {
        res.writeHead(400);
        return res.end(JSON.stringify({ ok: false, error: e.message }));
      }
=======

      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(config.getDefaultCwd() || process.cwd(), filePath);
>>>>>>> Stashed changes

      if (!fs.existsSync(absPath)) {
        res.writeHead(404);
        return res.end(JSON.stringify({ ok: false, error: 'Fayl topilmadi: ' + absPath }));
      }

      try {
        await bot.sendDocument(config.ADMIN_ID, absPath, {
          caption: caption || `📄 ${path.basename(absPath)}`
        });
        res.writeHead(200);
        return res.end(JSON.stringify({ ok: true, sent: absPath }));
      } catch (e) {
        res.writeHead(500);
        return res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    }

    // ─── 12. WEBHOOK: /send-msg ──────────────────────────────────────────────
    if (endpoint === '/send-msg') {
      let text = bodyData.text || params.text || '(xabar yo\'q)';
      text = cleanEncodingArtifacts(text);

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
    res.end(JSON.stringify({ ok: false, error: 'Noma\'lum endpoint: ' + endpoint }));
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Diqqat: Port ${config.LOCAL_API_PORT} allaqachon band. Webhook server ishga tushmadi (boshqa instansiya faol bo'lishi mumkin).`);
    } else {
      console.error('Webhook server xatosi:', err.message);
    }
  });

  try {
    server.listen(config.LOCAL_API_PORT, '0.0.0.0', () => {
      console.log(`🔌 Mahalliy Webhook API: http://localhost:${config.LOCAL_API_PORT}`);
    });
  } catch (e) {
    console.warn(`Webhook listen xatosi: ${e.message}`);
  }

  return server;
}

module.exports = {
  startWebhookServer
};
