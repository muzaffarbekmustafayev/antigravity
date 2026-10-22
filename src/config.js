'use strict';

require('dotenv').config();
const path = require('path');
const fs   = require('fs');

// AGY Binary aniqlash
function getAgyBinPath() {
  if (process.env.AGY_PATH && fs.existsSync(process.env.AGY_PATH)) {
    return process.env.AGY_PATH;
  }
  const localAgy = path.join(process.env.LOCALAPPDATA || '', 'agy', 'bin', 'agy.exe');
  if (fs.existsSync(localAgy)) {
    return localAgy;
  }
  return 'agy';
}

const AGY_BIN_PATH        = getAgyBinPath();
const AGY_BIN             = AGY_BIN_PATH.includes(' ') ? `"${AGY_BIN_PATH}"` : AGY_BIN_PATH;
const ENABLE_SYSTEM_BYPASS = process.env.ENABLE_SYSTEM_BYPASS !== 'false';
const SAFE_MODE            = process.env.SAFE_MODE === 'true';
const DNS_MODE             = (process.env.DNS_MODE || 'hosts').toLowerCase().trim();

let globalCountry = (process.env.DEFAULT_COUNTRY || process.env.AGY_COUNTRY || 'nl').trim();

function normalizeCountry(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
}

function getDefaultCountry() {
  return normalizeCountry(globalCountry) || 'nl';
}

function setDefaultCountry(country) {
  const normalized = normalizeCountry(country);
  if (normalized) globalCountry = normalized;
}

function getEffectiveCountry() {
  const envCountry = normalizeCountry(process.env.AGY_COUNTRY || process.env.COUNTRY || process.env.DEFAULT_COUNTRY);
  return envCountry || getDefaultCountry();
}

module.exports = {
  AGY_BIN,
  AGY_BIN_PATH,
  ENABLE_SYSTEM_BYPASS,
  SAFE_MODE,
  DNS_MODE,
  getDefaultCountry,
  setDefaultCountry,
  getEffectiveCountry,
};
