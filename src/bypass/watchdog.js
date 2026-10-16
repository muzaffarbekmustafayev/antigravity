/**
 * watchdog.js
 * Auto-repatch watchdog — re-applies binary patches if Antigravity auto-updates.
 *
 * Lightweight, optimized architecture:
 *   1. Targets discovered once and cached (not re-traversing filesystem every 30s)
 *   2. Checks file mtime/size before reading (zero-RAM overhead on idle ticks)
 *   3. Configurable keepAlive to run as long-running CLI daemon
 */

'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { repatchIfNeeded, discoverInstalls, findBinaryTargets } = require('./patch');

const POLL_INTERVAL_MS = 25_000; // 25 s

class Watchdog extends EventEmitter {
  constructor(options = {}) {
    super();
    this._interval    = null;
    this._pollMs      = options.pollMs ?? POLL_INTERVAL_MS;
    this._extraRoots  = options.extraRoots ?? [];
    this._keepAlive   = options.keepAlive ?? false;
    this._targetMap   = new Map(); // binPath -> { mtimeMs, size }
    this._lastDiscovery = 0;
  }

  _refreshTargets() {
    const roots = [...discoverInstalls(), ...this._extraRoots];
    const set = new Set();
    for (const root of roots) {
      for (const bin of findBinaryTargets(root)) {
        try {
          const resolved = path.resolve(bin);
          set.add(resolved);
        } catch (_) {}
      }
    }

    // Keep existing tracked stats, add new ones
    for (const bin of set) {
      if (!this._targetMap.has(bin)) {
        try {
          const st = fs.statSync(bin);
          this._targetMap.set(bin, { mtimeMs: st.mtimeMs, size: st.size });
        } catch (_) {}
      }
    }

    // Remove deleted targets
    for (const bin of this._targetMap.keys()) {
      if (!set.has(bin)) {
        this._targetMap.delete(bin);
      }
    }

    this._lastDiscovery = Date.now();
  }

  start() {
    if (this._interval) return;
    this._refreshTargets();
    this._interval = setInterval(() => this._tick(), this._pollMs);

    // Only unref if not explicitly running as a standalone daemon
    if (!this._keepAlive && this._interval.unref) {
      this._interval.unref();
    }
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
    try {
      const config = require('../config');
      if (config.SAFE_MODE && !config.ENABLE_SYSTEM_BYPASS) return;

      // Refresh discovery every 10 minutes
      if (Date.now() - this._lastDiscovery > 600_000) {
        this._refreshTargets();
      }

      for (const [bin, lastStat] of this._targetMap.entries()) {
        let currStat;
        try {
          currStat = fs.statSync(bin);
        } catch (_) {
          continue;
        }

        // Check if file was touched or modified by an app update
        if (currStat.mtimeMs !== lastStat.mtimeMs || currStat.size !== lastStat.size) {
          this._targetMap.set(bin, { mtimeMs: currStat.mtimeMs, size: currStat.size });
          const outcome = repatchIfNeeded(bin);
          if (outcome === 'repatched') {
            this.emit('repatched', { bin });
          } else if (outcome === 'failed') {
            this.emit('failed', { bin });
          }
        }
      }
    } catch (_) {}
  }
}

module.exports = { Watchdog };
