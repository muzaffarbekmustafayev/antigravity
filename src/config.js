require('dotenv').config();
const path = require('path');
const fs   = require('fs');

// AGY Binary aniqlash
function getAgyBin() {
  if (process.env.AGY_PATH && fs.existsSync(process.env.AGY_PATH)) {
    return `"${process.env.AGY_PATH}"`;
  }
  const localAgy = path.join(process.env.LOCALAPPDATA || '', 'agy', 'bin', 'agy.exe');
  if (fs.existsSync(localAgy)) {
    return `"${localAgy}"`;
  }
  return 'agy';
}

const TOKEN               = process.env.BOT_TOKEN;
const ADMIN_ID            = process.env.ADMIN_CHAT_ID;
const MAX_OUTPUT          = 3500;
const LOCAL_API_PORT      = parseInt(process.env.PORT || process.env.LOCAL_API_PORT || '3000');
const AGY_BIN             = getAgyBin();
const DATA_DIR            = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let currentDefaultCwd   = process.env.DEFAULT_CWD || null;
let globalFiveHourLimit = parseInt(process.env.FIVE_HOUR_LIMIT || '250');
let globalModel         = process.env.DEFAULT_MODEL  || 'gemini-3.8-flash';
let globalEffort        = process.env.DEFAULT_EFFORT || 'high';
let globalCountry       = (process.env.DEFAULT_COUNTRY || process.env.AGY_COUNTRY || process.env.VPN_COUNTRY || process.env.VPN_COUNTRY_CODE || 'nl').trim();

function normalizeCountry(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
}

function getDefaultCwd() {
  return currentDefaultCwd;
}

function setDefaultCwd(newPath) {
  currentDefaultCwd = newPath;
}

function getDefaultCountry() {
  return normalizeCountry(globalCountry) || 'nl';
}

function setDefaultCountry(country) {
  const normalized = normalizeCountry(country);
  if (normalized) globalCountry = normalized;
}

function getEffectiveCountry() {
  const envCountry = normalizeCountry(process.env.VPN_COUNTRY || process.env.VPN_COUNTRY_CODE || process.env.AGY_COUNTRY || process.env.COUNTRY || process.env.DEFAULT_COUNTRY);
  return envCountry || getDefaultCountry();
}

function getGlobalLimit() {
  return globalFiveHourLimit;
}

function setGlobalLimit(num) {
  globalFiveHourLimit = num;
}

function getGlobalModel() {
  return globalModel;
}

function setGlobalModel(modelId) {
  globalModel = modelId;
}

function getGlobalEffort() {
  return globalEffort;
}

function setGlobalEffort(effortId) {
  globalEffort = effortId;
}

const ENABLE_SYSTEM_BYPASS = process.env.ENABLE_SYSTEM_BYPASS === 'true';
const SAFE_MODE            = process.env.SAFE_MODE !== 'false';

function isAdmin(id) {
  return id && ADMIN_ID && id.toString() === ADMIN_ID.toString();
}

module.exports = {
  TOKEN,
  ADMIN_ID,
  MAX_OUTPUT,
  LOCAL_API_PORT,
  AGY_BIN,
  DATA_DIR,
  ENABLE_SYSTEM_BYPASS,
  SAFE_MODE,
  getDefaultCwd,
  setDefaultCwd,
  getDefaultCountry,
  setDefaultCountry,
  getEffectiveCountry,
  getGlobalLimit,
  setGlobalLimit,
  getGlobalModel,
  setGlobalModel,
  getGlobalEffort,
  setGlobalEffort,
  isAdmin
};
