const fs     = require('fs');
const path   = require('path');
const config = require('./config');

const SESSIONS_FILE = path.join(config.DATA_DIR, 'sessions.json');

const sessions      = new Map();
let sessionCounter  = 0;
const activeSession = new Map(); // chatId -> sessionId
const renamePrompt  = new Map(); // chatId -> sessionId
const setcwdPrompt  = new Map(); // chatId -> sessionId

function saveSessions() {
  try {
    const list = [];
    for (const [, s] of sessions) {
      list.push({
        id:        s.id,
        name:      s.name,
        cwd:       s.cwd,
        model:     s.model,
        effort:    s.effort,
        history:   s.history.slice(-20),
        createdAt: s.createdAt,
        cmdCount:  s.cmdCount || s.history.length
      });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('Sessiyalarni saqlashda xato:', e.message);
  }
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          const num = parseInt(item.id.replace(/\D/g, '')) || 0;
          if (num > sessionCounter) sessionCounter = num;
          sessions.set(item.id, {
            id:        item.id,
            name:      item.name || ('Sessiya ' + item.id),
            cwd:       item.cwd  || config.getDefaultCwd() || process.cwd(),
            model:     item.model || config.getGlobalModel(),
            effort:    item.effort || config.getGlobalEffort(),
            history:   item.history || [],
            proc:      null,
            isNewConv: true,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            cmdCount:  item.cmdCount || (item.history ? item.history.length : 0),
          });
        }
      }
    }
  } catch (e) {
    console.error('Sessiyalarni yuklashda xato:', e.message);
  }
}

loadSessions();

function createSession(name, customCwd, customModel, customEffort) {
  sessionCounter++;
  const id = 's' + sessionCounter;
  const session = {
    id,
    name:      name || ('Sessiya ' + sessionCounter),
    cwd:       customCwd || config.getDefaultCwd() || process.cwd(),
    model:     customModel || config.getGlobalModel(),
    effort:    customEffort || config.getGlobalEffort(),
    history:   [],
    proc:      null,
    isNewConv: true,
    createdAt: new Date(),
    cmdCount:  0,
  };
  sessions.set(id, session);
  saveSessions();
  return session;
}

function getSession(sid) {
  return sessions.get(sid);
}

function getActiveSession(chatId) {
  let sid = activeSession.get(chatId.toString());
  if (!sid || !sessions.has(sid)) {
    if (sessions.size === 0) {
      const newSess = createSession('Asosiy sessiya');
      sid = newSess.id;
    } else {
      sid = sessions.keys().next().value;
    }
    activeSession.set(chatId.toString(), sid);
  }
  return sessions.get(sid);
}

function setActiveSession(chatId, sid) {
  if (sessions.has(sid)) {
    activeSession.set(chatId.toString(), sid);
    return true;
  }
  return false;
}

function closeSession(sid, chatId) {
  const sess = sessions.get(sid);
  if (!sess) return null;

  if (sess.proc) {
    try { process.kill(-sess.proc.pid); } catch (_) {}
  }

  const name = sess.name;
  sessions.delete(sid);
  saveSessions();

  if (activeSession.get(chatId.toString()) === sid) {
    const first = sessions.keys().next().value;
    if (first) {
      activeSession.set(chatId.toString(), first);
    } else {
      activeSession.delete(chatId.toString());
    }
  }

  return name;
}

module.exports = {
  sessions,
  activeSession,
  renamePrompt,
  setcwdPrompt,
  createSession,
  getSession,
  getActiveSession,
  setActiveSession,
  closeSession,
  saveSessions
};
