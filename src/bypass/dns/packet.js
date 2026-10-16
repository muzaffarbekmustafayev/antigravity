/**
 * packet.js — DNS wire-format paketlarini xavfsiz generatsiya qilish va parslash (RFC 1035)
 */

'use strict';

/**
 * DNS A-record so'rov paketini yasash
 */
function buildDnsQuery(hostname, qtype = 1 /* A */) {
  const id = Math.floor(Math.random() * 0xFFFF);
  const cleanHost = String(hostname || '').trim().replace(/\.$/, '');
  const labels = cleanHost.split('.').filter(Boolean).map(l => Buffer.from(l, 'ascii'));

  const parts = [];
  for (const label of labels) {
    const len = Buffer.allocUnsafe(1);
    len[0] = label.length;
    parts.push(len, label);
  }
  parts.push(Buffer.from([0])); // Zero-length root label

  const qname = Buffer.concat(parts);

  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0x0100, 2); // QR=0, OPCODE=0, RD=1 (Recursion Desired)
  header.writeUInt16BE(1, 4);      // QDCOUNT = 1
  header.writeUInt16BE(0, 6);      // ANCOUNT = 0
  header.writeUInt16BE(0, 8);      // NSCOUNT = 0
  header.writeUInt16BE(0, 10);     // ARCOUNT = 0

  const qsuffix = Buffer.alloc(4);
  qsuffix.writeUInt16BE(qtype, 0); // QTYPE (1 = A)
  qsuffix.writeUInt16BE(1, 2);     // QCLASS (1 = IN)

  return { id, packet: Buffer.concat([header, qname, qsuffix]) };
}

/**
 * DNS paketidagi nomni (name / label) xavfsiz o'tkazib yuborish (RFC 1035 pointer compression bilan)
 */
function skipDnsName(buf, startOffset) {
  let offset = startOffset;
  let jumps = 0;
  const maxJumps = 10;

  while (offset < buf.length) {
    const len = buf[offset];
    if (len === 0) {
      return offset + 1;
    }
    // Siqilgan ko'rsatgich (Pointer: 11xxxxxx)
    if ((len & 0xC0) === 0xC0) {
      if (offset + 2 > buf.length) return null;
      return offset + 2;
    }
    // Oddiy label
    offset++;
    if (offset + len > buf.length) return null;
    offset += len;
    jumps++;
    if (jumps > 128) return null; // Sikldan himoya
  }
  return null;
}

/**
 * DNS so'rovidagi qidirilayotgan domenni parslash
 */
function parseDnsQueryName(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 12) return null;
  try {
    let offset = 12;
    const labels = [];

    while (offset < buf.length) {
      const len = buf[offset];
      if (len === 0) break;
      if ((len & 0xC0) === 0xC0) break; // Query da pointer kamdan-kam, to'xtatamiz
      offset++;
      if (offset + len > buf.length) return null;
      labels.push(buf.slice(offset, offset + len).toString('ascii'));
      offset += len;
    }
    return labels.length ? labels.join('.') : null;
  } catch (_) {
    return null;
  }
}

/**
 * DNS javob paketidan IPv4 (A-record) manzillarini xavfsiz ajratib olish
 */
function parseDnsARecords(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 12) return [];

  try {
    const ancount = buf.readUInt16BE(6);
    if (ancount === 0) return [];

    // Question section ni o'tkazib yuborish
    let offset = skipDnsName(buf, 12);
    if (offset === null || offset + 4 > buf.length) return [];
    offset += 4; // QTYPE (2) + QCLASS (2)

    const ips = [];

    // Answers section ni xavfsiz o'qish
    for (let i = 0; i < ancount && offset < buf.length; i++) {
      offset = skipDnsName(buf, offset);
      if (offset === null || offset + 10 > buf.length) break;

      const type = buf.readUInt16BE(offset);
      offset += 2;
      const cls = buf.readUInt16BE(offset);
      offset += 2;
      // TTL (4 bayt)
      offset += 4;
      const rdlen = buf.readUInt16BE(offset);
      offset += 2;

      if (offset + rdlen > buf.length) break;

      // Type 1 = A (IPv4) va Class 1 = IN (Internet) va rdlen = 4 bayt
      if (type === 1 && cls === 1 && rdlen === 4) {
        ips.push(`${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`);
      }

      offset += rdlen;
    }

    return ips;
  } catch (_) {
    return [];
  }
}

module.exports = {
  buildDnsQuery,
  parseDnsQueryName,
  parseDnsARecords,
  skipDnsName,
};
