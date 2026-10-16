/**
 * logger.js — Antigravity markazlashtirilgan logging tizimi
 * DEBUG=1 yoki process.env.AG_DEBUG orqali batafsil loglarni ko'rish mumkin.
 */

'use strict';

const isDebug = process.env.DEBUG === '1' || process.env.AG_DEBUG === '1';

const Logger = {
  debug(...args) {
    if (isDebug) {
      console.log('\x1b[90m[DEBUG]\x1b[0m', ...args);
    }
  },
  info(...args) {
    console.log('\x1b[36m[INFO]\x1b[0m', ...args);
  },
  warn(...args) {
    console.warn('\x1b[33m[WARN]\x1b[0m', ...args);
  },
  error(...args) {
    console.error('\x1b[31m[ERROR]\x1b[0m', ...args);
  },
};

module.exports = Logger;
