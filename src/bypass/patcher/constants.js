/**
 * constants.js — Binar va skript patchlash uchun konstantalar va holatlar
 */

'use strict';

const SIG_INELIGIBLE  = Buffer.from('ineligible',  'ascii'); // 10 bytes
const SIG_INEXIGIBLE  = Buffer.from('inexigible',  'ascii'); // 10 bytes
const SIG_HTTPS_PROXY = Buffer.from('https_proxy', 'ascii'); // 11 bytes
const SIG_AG_LS_PROXY = Buffer.from('AG_LS_PROXY', 'ascii'); // 11 bytes

const PROXY_VAR_NAME = 'AG_LS_PROXY';
const JS_PATCH_MARKER = '// AG_BYPASS_PATCHED';
const BACKUP_EXT      = '.ag_backup';
const BACKUP_META_EXT = '.ag_meta.json';

const PatchState = Object.freeze({
  PATCHED:           'PATCHED',
  UNPATCHED:         'UNPATCHED',
  SIGNATURE_MISSING: 'SIGNATURE_MISSING',
  UNREADABLE:        'UNREADABLE',
});

module.exports = {
  SIG_INELIGIBLE,
  SIG_INEXIGIBLE,
  SIG_HTTPS_PROXY,
  SIG_AG_LS_PROXY,
  PROXY_VAR_NAME,
  JS_PATCH_MARKER,
  BACKUP_EXT,
  BACKUP_META_EXT,
  PatchState,
};
