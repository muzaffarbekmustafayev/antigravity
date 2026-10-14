/**
 * watchdog.js
 * Auto-repatch watchdog — re-applies binary patches if Antigravity auto-updates.
 *
 * Port of confeden/Antigravity src/watchdog.rs
 *
 * Runs as a background interval; on each tick:
 *   1. Checks each known language_server/agy binary.
 *   2. If reverted by an app update → repatches it.
 *   3. Emits events so callers can log / notify users.
 */

'use strict';

const EventEmitter = require('events');
const { repatchIfNeeded, discoverInstalls, findBinaryTargets } = require('./patch');

const POLL_INTERVAL_MS = 30_000; // 30 s — same order of magnitude as the Rust watchdog

class Watchdog extends EventEmitter {
  constructor(options = {}) {
    super();
    this._interval    = null;
    this._pollMs      = options.pollMs ?? POLL_INTERVAL_MS;
    this._extraRoots  = options.extraRoots ?? []; // additional install roots to watch
  }

  start() {
    if (this._interval) return;
    this._interval = setInterval(() => this._tick(), this._pollMs);
    // Unref so Node can exit even if watchdog is still running
    if (this._interval.unref) this._interval.unref();
    this.emit('started');
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
      this.emit('stopped');
    }
  }

  _tick() {
    const config = require('../config');
    if (config.SAFE_MODE && !config.ENABLE_SYSTEM_BYPASS) return;
    const roots = [...discoverInstalls(), ...this._extraRoots];
    for (const root of roots) {
      for (const bin of findBinaryTargets(root)) {
        const outcome = repatchIfNeeded(bin);
        if (outcome === 'repatched') {
          this.emit('repatched', { bin });
        } else if (outcome === 'failed') {
          this.emit('failed', { bin });
        }
        // 'already_patched' and 'signature_missing' are silent
      }
    }
  }
}

module.exports = { Watchdog };
