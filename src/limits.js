const fs   = require('fs');
const path = require('path');
const config = require('./config');
const { AVAILABLE_MODELS } = require('./models');

const LIMITS_FILE   = path.join(config.DATA_DIR, 'limits.json');
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

function loadLimitRecords() {
  try {
    if (fs.existsSync(LIMITS_FILE)) {
      const data = JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.error('Limit faylini o\'qishda xato:', e.message);
  }
  return [];
}

let limitRecords = loadLimitRecords();

function saveLimitRecords() {
  try {
    // 24 soatdan eski yozuvlarni tozalash
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    limitRecords = limitRecords.filter(r => r.timestamp >= cutoff);
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(limitRecords, null, 2), 'utf8');
  } catch (e) {
    console.error('Limit faylini saqlashda xato:', e.message);
  }
}

function recordRequest(modelId, effort, sessionId) {
  const rec = {
    timestamp: Date.now(),
    model:     modelId,
    effort:    effort || 'high',
    session:   sessionId || 's1'
  };
  limitRecords.push(rec);
  saveLimitRecords();
}

function get5HourStats(modelId) {
  const now = Date.now();
  const windowStart = now - FIVE_HOURS_MS;
  const inWindow = limitRecords.filter(r => r.timestamp >= windowStart);

  const modelInfo = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
  const maxLimit = modelInfo.fiveHourLimit || config.getGlobalLimit();
  const currentCount = inWindow.length;
  const modelCount = inWindow.filter(r => r.model === modelId).length;

  const usedPct = Math.min(100, Math.round((currentCount / maxLimit) * 100));
  const remaining = Math.max(0, maxLimit - currentCount);

  // Keyingi bo'shash vaqti (eng birinchi so'rov oynadan qachon chiqadi)
  let nextRecovery = null;
  let nextRecoveryMins = null;
  if (inWindow.length > 0) {
    const sorted = [...inWindow].sort((a, b) => a.timestamp - b.timestamp);
    const earliest = sorted[0].timestamp;
    nextRecovery = earliest + FIVE_HOURS_MS;
    nextRecoveryMins = Math.max(1, Math.ceil((nextRecovery - now) / 60000));
  }

  // Modellar bo'yicha taqsimot
  const byModel = {};
  for (const r of inWindow) {
    byModel[r.model] = (byModel[r.model] || 0) + 1;
  }

  // Tezlik (effort) bo'yicha taqsimot
  const byEffort = { low: 0, medium: 0, high: 0 };
  for (const r of inWindow) {
    if (byEffort[r.effort] !== undefined) byEffort[r.effort]++;
  }

  return {
    total5h: currentCount,
    maxLimit,
    remaining,
    usedPct,
    modelCount,
    nextRecovery,
    nextRecoveryMins,
    byModel,
    byEffort,
    todayTotal: limitRecords.filter(r => r.timestamp >= now - 24 * 3600 * 1000).length
  };
}

module.exports = {
  recordRequest,
  get5HourStats,
  saveLimitRecords
};
