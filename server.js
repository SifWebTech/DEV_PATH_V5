/*
 * DEV PATH V4 — servidor local do estande
 * ------------------------------------------------------------
 * Liga o celular do visitante à TV pela rede Wi-Fi do notebook.
 * Usa apenas módulos nativos do Node (não precisa de npm install).
 *
 *   node server.js            → inicia em http://<ip-do-notebook>:8787 (ou a próxima porta livre)
 *   PORT=8080 node server.js  → muda a porta
 *   ADMIN_KEY=minhasenha      → muda a senha da tela de leads (padrão: fatec)
 *   PUBLIC_URL=https://...    → força o endereço usado no QR Code
 *
 * Fluxo:
 *   TV (index.html) ─SSE─┐                ┌─SSE─ celular (m.html)
 *                        └── server.js ───┘
 *   1. celular envia o cadastro      POST /api/lead
 *   2. celular toca em "Começar"     POST /api/start  → entra na fila
 *   3. servidor manda a TV começar   evento "start"
 *   4. TV avisa cada cena            POST /api/tv/scene → repassa ao celular
 *   5. TV termina                    POST /api/tv/done  → celular recebe o crachá
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// 8787 e não 3000: a porta 3000 costuma estar ocupada (ex.: AdGuard Home, React).
// Se a porta estiver ocupada, o servidor tenta as próximas e grava a escolhida em data/.porta
let PORT = Number(process.env.PORT) || 8787;
const ADMIN_KEY = process.env.ADMIN_KEY || 'fatec';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const CSV_FILE = path.join(DATA_DIR, 'leads.csv');
const INTERESTS = ['design', 'logic', 'apps', 'business'];

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

/* ---------------- estado em memória ---------------- */
const leads = new Map();      // id → lead
const queue = [];             // ids aguardando a TV
let current = null;           // id em apresentação
const tvClients = new Set();   // respostas SSE das TVs
const phoneClients = new Map(); // id → Set de respostas SSE
const lastReaction = new Map();
let tvScene = null;           // { index, total, label, paused } — o que a TV mostra agora

/* ---------------- persistência CSV ---------------- */
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CSV_FILE)) {
  // BOM para o Excel abrir acentos corretamente
  fs.writeFileSync(CSV_FILE, '﻿data_hora;nome;contato;tipo_contato;interesse;consentimento;id\n');
}

// Impede que o Excel interprete o valor como fórmula
const csvCell = (v) => {
  let s = String(v ?? '').replace(/[\r\n;]+/g, ' ').trim();
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  return s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function readCsvLeads() {
  const lines = fs.readFileSync(CSV_FILE, 'utf8').replace(/^﻿/, '').trim().split('\n').slice(1);
  return lines.filter(Boolean).map((line) => {
    const [when, name, contact, contactType, interest, consent, id] = line.split(';');
    return { when, name, contact: contact?.replace(/^'/, ''), contactType, interest, consent, id };
  });
}

// data/hora local do notebook (horário de Brasília no estande), não UTC
const stamp = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
};
const today = () => stamp().slice(0, 10);
let todayCount = readCsvLeads().filter((l) => (l.when || '').startsWith(today())).length;

/* ---------------- utilidades ---------------- */
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

const mobileUrl = () => process.env.PUBLIC_URL || `http://${lanAddress()}:${PORT}/m`;

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

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const toTV = (event, data) => tvClients.forEach((res) => sse(res, event, data));
const toPhone = (id, event, data) => phoneClients.get(id)?.forEach((res) => sse(res, event, data));

const publicLead = (l) => l && { id: l.id, name: l.name, interest: l.interest };

function phoneStatus(id) {
  if (id === current) return { state: 'playing' };
  const pos = queue.indexOf(id);
  if (pos >= 0) return { state: 'queued', position: pos + 1, tvOnline: tvClients.size > 0 };
  const lead = leads.get(id);
  return { state: lead?.done ? 'done' : 'ready' };
}

function broadcastQueue() {
  queue.forEach((id) => toPhone(id, 'status', phoneStatus(id)));
  toTV('queue', { size: queue.length, next: queue.slice(0, 3).map((id) => leads.get(id)?.name) });
}

function advance() {
  if (current || !queue.length || !tvClients.size) return broadcastQueue();
  current = queue.shift();
  const lead = leads.get(current);
  toTV('start', publicLead(lead));
  toPhone(current, 'status', phoneStatus(current));
  broadcastQueue();
}

function finishCurrent() {
  if (!current) return;
  const lead = leads.get(current);
  if (lead) lead.done = true;
  toPhone(current, 'status', { state: 'done' });
  current = null;
  advance();
}

/* ---------------- validação ---------------- */
function validateLead(b) {
  const name = String(b.name || '').replace(/\s+/g, ' ').trim();
  const contact = String(b.contact || '').trim();
  const interest = String(b.interest || '');
  const errors = {};
  if (name.length < 2 || name.length > 40) errors.name = 'Digite seu nome (2 a 40 letras).';
  let contactType = '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact) && contact.length <= 80) contactType = 'email';
  else if (/^@?[A-Za-z0-9._]{2,30}$/.test(contact)) contactType = 'instagram';
  else errors.contact = 'Use um e-mail válido ou seu @ do Instagram.';
  if (!INTERESTS.includes(interest)) errors.interest = 'Escolha o que mais chama sua atenção.';
  if (b.consent !== true) errors.consent = 'Precisamos da sua autorização para entrar em contato.';
  return {
    errors,
    lead: {
      name,
      contact: contactType === 'instagram' && !contact.startsWith('@') ? '@' + contact : contact,
      contactType,
      interest,
    },
  };
}

/* ---------------- API ---------------- */
async function api(req, res, url) {
  const p = url.pathname;

  if (p === '/api/info') {
    return send(res, 200, {
      mobileUrl: mobileUrl(),
      todayCount,
      queue: queue.length,
      current: publicLead(leads.get(current)),
    });
  }

  if (p === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    const role = url.searchParams.get('role');
    const id = url.searchParams.get('id');
    if (role === 'tv') {
      tvClients.add(res);
      sse(res, 'hello', { mobileUrl: mobileUrl(), todayCount });
      if (current) sse(res, 'start', publicLead(leads.get(current)));
      req.on('close', () => { tvClients.delete(res); if (!tvClients.size) tvScene = null; });
      advance(); // havia gente esperando a TV conectar
    } else if (id && leads.has(id)) {
      if (!phoneClients.has(id)) phoneClients.set(id, new Set());
      phoneClients.get(id).add(res);
      sse(res, 'status', phoneStatus(id));
      req.on('close', () => phoneClients.get(id)?.delete(res));
    } else {
      sse(res, 'status', { state: 'unknown' });
    }
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => clearInterval(ping));
    return;
  }

  if (req.method !== 'POST' && !p.startsWith('/api/leads') && p !== '/api/op/state') return send(res, 405, { error: 'method' });

  if (p === '/api/lead') {
    const body = await readBody(req);
    const { errors, lead } = validateLead(body);
    if (Object.keys(errors).length) return send(res, 422, { errors });
    lead.id = crypto.randomUUID();
    lead.when = stamp();
    leads.set(lead.id, lead);
    // Instagram vira link clicável na planilha (e não começa com @, que o Excel trata como fórmula)
    const contactCell = lead.contactType === 'instagram' ? 'instagram.com/' + lead.contact.slice(1) : lead.contact;
    fs.appendFileSync(CSV_FILE, [
      lead.when, lead.name, contactCell, lead.contactType, lead.interest, 'sim', lead.id,
    ].map(csvCell).join(';') + '\n');
    todayCount += 1;
    toTV('lead', { name: lead.name.split(' ')[0], todayCount });
    return send(res, 201, { id: lead.id, name: lead.name, interest: lead.interest });
  }

  if (p === '/api/start') {
    const { id } = await readBody(req);
    if (!leads.has(id)) return send(res, 404, { error: 'Cadastro não encontrado. Preencha novamente.' });
    leads.get(id).done = false;
    if (id !== current && !queue.includes(id)) queue.push(id);
    advance();
    return send(res, 200, phoneStatus(id));
  }

  if (p === '/api/react') {
    const { id, type } = await readBody(req);
    const lead = leads.get(id);
    if (!lead || !['fire', 'heart', 'mind', 'rocket'].includes(type)) return send(res, 400, { error: 'reaction' });
    const now = Date.now();
    if (now - (lastReaction.get(id) || 0) < 350) return send(res, 429, { error: 'slow' });
    lastReaction.set(id, now);
    toTV('react', { type, name: lead.name.split(' ')[0] });
    return send(res, 204, '');
  }

  if (p === '/api/tv/scene') {
    const body = await readBody(req);
    tvScene = { index: Number(body.index) || 0, total: Number(body.total) || 0, label: String(body.label || '').slice(0, 60), paused: !!body.paused };
    if (current) toPhone(current, 'scene', { index: body.index, total: body.total, label: String(body.label || '').slice(0, 60) });
    return send(res, 204, '');
  }

  if (p === '/api/tv/done') {
    tvScene = null;
    finishCurrent();
    return send(res, 204, '');
  }

  /* painel do operador (notebook): comanda a TV sem precisar de foco na janela dela */
  if (p === '/api/op/state' || p === '/api/op/cmd') {
    if (url.searchParams.get('key') !== ADMIN_KEY) return send(res, 401, { error: 'Senha incorreta.' });
    if (p === '/api/op/cmd') {
      const { cmd } = await readBody(req);
      if (!['next', 'prev', 'pause', 'stop', 'demo'].includes(cmd)) return send(res, 400, { error: 'cmd' });
      if (!tvClients.size) return send(res, 409, { error: 'A TV não está conectada.' });
      toTV('cmd', { cmd });
      return send(res, 204, '');
    }
    return send(res, 200, {
      tvOnline: tvClients.size > 0,
      mobileUrl: mobileUrl(),
      current: publicLead(leads.get(current)),
      scene: tvScene,
      queue: queue.map((id) => leads.get(id)?.name),
      todayCount,
    });
  }

  if (p.startsWith('/api/leads')) {
    if (url.searchParams.get('key') !== ADMIN_KEY) return send(res, 401, { error: 'Senha incorreta.' });
    if (p === '/api/leads.csv') {
      return send(res, 200, fs.readFileSync(CSV_FILE, 'utf8'), {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-devpath-${today()}.csv"`,
      });
    }
    return send(res, 200, { leads: readCsvLeads().reverse(), todayCount });
  }

  return send(res, 404, { error: 'not found' });
}

/* ---------------- arquivos estáticos ---------------- */
const ROUTES = { '/': '/index.html', '/tv': '/index.html', '/m': '/m.html', '/admin': '/admin.html', '/operador': '/admin.html' };

function serveStatic(req, res, url) {
  const rel = ROUTES[url.pathname] || decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Página não encontrada');
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.woff2' ? 'max-age=31536000' : 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (err) {
    send(res, 400, { error: 'Requisição inválida.' });
  }
});

// "::" escuta IPv4 e IPv6 juntos, então qualquer programa já usando a porta é detectado
let tries = 0;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && !process.env.PORT && tries < 20) {
    console.log(`  Porta ${PORT} ocupada por outro programa, tentando ${PORT + 1}...`);
    tries += 1;
    PORT += 1;
    server.listen(PORT, '::');
  } else {
    console.error(`\n  Não foi possível abrir a porta ${PORT} (${err.code}). Feche o programa que a usa ou escolha outra: set PORT=9000\n`);
    process.exit(1);
  }
});
server.listen(PORT, '::');

server.on('listening', () => {
  fs.writeFileSync(path.join(DATA_DIR, '.porta'), String(PORT)); // lido pelo abrir-telas.ps1
  const ip = lanAddress();
  console.log('\n  DEV PATH V4 — Sistemas para Internet · Fatec Jales\n');
  console.log(`  TV (abra no notebook):   http://localhost:${PORT}`);
  console.log(`  Celular (QR Code):       ${mobileUrl()}`);
  console.log(`  Operador + leads:        http://localhost:${PORT}/operador   (senha: ${ADMIN_KEY})`);
  console.log(`  Arquivo de leads:        ${CSV_FILE}\n`);
  if (ip === 'localhost') console.log('  ⚠ Nenhuma rede Wi-Fi encontrada. Conecte o notebook a uma rede ou ative o hotspot.\n');
});
