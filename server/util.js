/* Pequenas utilidades compartilhadas pelos módulos do servidor. */
'use strict';

const os = require('os');
const { VESTIBULAR_URL } = require('./config');

// data/hora local do notebook (horário de Brasília no estande), não UTC
const stamp = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
};
const today = () => stamp().slice(0, 10);

// "Feira de Profissões 2026" → "feira-de-profissoes-2026" (usado na UTM)
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'estande';

// Link do vestibular com UTM: o site da Fatec consegue atribuir a inscrição ao estande
function vestibularUrl(meio, evento) {
  const u = new URL(VESTIBULAR_URL);
  u.searchParams.set('utm_source', 'devpath');
  u.searchParams.set('utm_medium', meio);
  u.searchParams.set('utm_campaign', slug(evento));
  return u.href;
}

const firstName = (name) => String(name || '').split(' ')[0];

function lanAddress() {
  const candidates = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push(net.address);
    }
  }
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3);
  return candidates.sort((a, b) => rank(a) - rank(b))[0] || 'localhost';
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object';
  res.writeHead(status, {
    'Content-Type': isObj ? MIME['.json'] : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 4096) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('json')); } });
  });
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

module.exports = { stamp, today, slug, vestibularUrl, firstName, lanAddress, MIME, send, readBody, parseCookies };
