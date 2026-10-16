/**
 * constants.js — DNS bypass konstantalari va provayderlar ro'yxati
 */

'use strict';

const AG_HOSTNAMES = [
  'cloudcode-pa.googleapis.com',
  'daily-cloudcode-pa.googleapis.com',
  'daily-cloudcode-pa.sandbox.googleapis.com',
  'generativelanguage.googleapis.com',
  'aiplatform.googleapis.com',
  's-aiplatform.googleapis.com',
  'aisandbox-pa.googleapis.com',
  'alkalicore-pa.clients6.google.com',
  'alkalimakersuite-pa.clients6.google.com',
  'antigravity-pa.googleapis.com',
  'cloudaicompanion.googleapis.com',
  'cloudaicompanion.sandbox.googleapis.com',
  'optimizationguide-pa.googleapis.com',
  'developerprofiles-pa.googleapis.com',
  'geller-pa.googleapis.com',
  'proactivebackend-pa.googleapis.com',
  'robinfrontend-pa.googleapis.com',
];

const NRPT_TAG = 'AG_REMOTE_BOT_NRPT';
const RELAY_IP   = '127.0.0.53';
const RELAY_PORT = 53;

const HOSTS_BEGIN = '# AG_UNLOCKER_HOSTS_BEGIN';
const HOSTS_END   = '# AG_UNLOCKER_HOSTS_END';

const REFERENCE_V4 = ['8.8.8.8', '1.1.1.1'];
const REFERENCE_STUBS = ['8.6.112.0', '8.47.69.0'];

const PROVIDERS = [
  {
    name: 'comss.one (Netherlands/NL)',
    transport: 'udp',
    v4: ['83.220.169.155', '212.109.195.93', '195.133.25.16'],
  },
  {
    name: 'dns-ai.ru',
    transport: 'doh',
    host: 'dns.dns-ai.ru',
    path: '/dns-query',
    addrs: ['192.144.59.14', '186.246.49.127', '185.251.90.181'],
  },
  {
    name: 'geohide.ru',
    transport: 'udp',
    v4: ['45.155.204.190', '37.230.192.51'],
  },
];

module.exports = {
  AG_HOSTNAMES,
  NRPT_TAG,
  RELAY_IP,
  RELAY_PORT,
  HOSTS_BEGIN,
  HOSTS_END,
  REFERENCE_V4,
  REFERENCE_STUBS,
  PROVIDERS,
};
