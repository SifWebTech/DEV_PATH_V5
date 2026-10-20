/*
 * Rotas HTTP, arquivos estáticos e segurança.
 *
 *   Páginas  /presentation/<EVENTO>/<TELÃO>  TV           ( / e /tv levam ao telão padrão )
 *            /join/<código>                   celular      ( /m leva ao telão padrão )
 *            /operador                        painel
 *   Celular  GET  /api/join/<código>
 *            POST /api/lead, /api/lead/excluir, /api/start (ou /api/sessions/<id>/start), /api/react, /api/evento
 *            GET  /ir/vestibular?lead=…   → registra o clique e abre o vestibular com UTM
 *   TV       GET  /api/displays/<TELÃO>/state, /api/voz/ola/<id do cadastro>.mp3 (saudação com o nome)
 *            POST /api/tv/scene, /api/tv/done, /api/tv/audio, /api/tv/heartbeat   (body: { display })
 *   Todos    GET  /api/info, /healthz, /api/stream?role=tv&display=…|phone&id=…|op
 *   Operador (cookie de login)
 *            POST /api/op/login, /api/op/logout, /api/op/cmd, /api/op/evento, /api/op/leads/excluir
 *            (cmd: next, prev, pause, stop, demo, mute, legendas, narracao; body: { cmd, display })
 *            GET  /api/op/state?display=…, /api/op/metricas, /api/op/leads, /api/op/leads.csv
 *
 * O endereço do QR vem de PUBLIC_BASE_URL. O IP da rede local só é usado fora de produção
 * (estande offline com hotspot), nunca com NODE_ENV=production.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sessao = require('./sessao');
const leads = require('./leads');
const funil = require('./funil');
const store = require('./store');
const auth = require('./auth');
const voz = require('./voz');
const { send, readBody, MIME, slug, vestibularUrl, lanAddress, firstName, today } = require('./util');
const config = require('./config');

let port = config.PORT;
const setPort = (p) => { port = p; };

/* ---------------- endereços públicos ---------------- */
const baseUrl = () => config.PUBLIC_BASE_URL || (config.PRODUCTION ? '' : `http://${lanAddress()}:${port}`);
const localUrl = () => config.PUBLIC_BASE_URL || `http://localhost:${port}`;
const mobileUrl = (d = sessao.defaultDisplay()) => `${baseUrl()}/join/${d.joinCode}`;
const presentationUrl = (d = sessao.defaultDisplay()) => `${localUrl()}/presentation/${d.eventCode}/${d.code}`;

/* ---------------- segurança ---------------- */
const isHttps = (req) => (config.TRUST_PROXY ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' : !!req.socket.encrypted);
const clientIp = (req) => (config.TRUST_PROXY && req.headers['x-forwarded-for']
  ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
  : req.socket.remoteAddress) || '?';

// CSP: só arquivos deste site. 'unsafe-inline' porque admin.html tem <style>/<script> embutidos
// e as cenas usam style="--k:…"; não há nenhum script de terceiros.
const CSP = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "media-src 'self' blob:", "font-src 'self'", "connect-src 'self'",
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join('; ');

function securityHeaders(req, res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

// Limite de pedidos por aparelho (janela de 1 minuto). Protege cadastro e START de abuso/robôs.
const LIMITES = { lead: 8, start: 20, evento: 60, react: 240, api: 600 };
const hits = new Map();
function limited(req, bucket) {
  const key = `${bucket}|${clientIp(req)}`;
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now > h.reset) { hits.set(key, { n: 1, reset: now + 60_000 }); return false; }
  h.n += 1;
  return h.n > LIMITES[bucket];
}
setInterval(() => { const now = Date.now(); hits.forEach((h, k) => { if (now > h.reset) hits.delete(k); }); }, 60_000).unref();

/* ---------------- estado ---------------- */
function displaySummary(d) {
  const st = sessao.displayState(d);
  return { code: d.code, status: st.status, lastSeen: st.lastSeen, mobileUrl: mobileUrl(d), presentationUrl: presentationUrl(d) };
}

// Estado de um telão para o painel (?display=; sem ele, o primeiro) + a lista de todos
function opState(url) {
  const d = sessao.getDisplay(url.searchParams.get('display')) || sessao.defaultDisplay();
  return {
    display: d.code,
    status: sessao.status(d),
    tvOnline: d.tvClients.size > 0,
    mobileUrl: mobileUrl(d),
    presentationUrl: presentationUrl(d),
    current: sessao.publicLead(sessao.leads.get(d.current)),
    scene: d.scene,
    audio: d.audio,
    queue: d.queue.map((id) => sessao.leads.get(id)?.name),
    todayCount: sessao.todayCount,
    evento: sessao.evento(),
    event: sessao.EVENT,
    banco: store.backend,
    displays: [...sessao.displays.values()].map(displaySummary),
  };
}

// Leads com filtro opcional por evento e interesse (exportação segmentada)
function filteredLeads(url) {
  const evento = url.searchParams.get('evento');
  const interesse = url.searchParams.get('interesse');
  return store.readLeads().filter((l) => (!evento || l.evento === evento) && (!interesse || l.interest === interesse));
}

const tvDisplay = (body) => sessao.getDisplay(body.display) || sessao.defaultDisplay();

function openStream(req, res, url) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform', // proxies da nuvem não podem segurar nem comprimir o fluxo
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  });
  res.write('retry: 2000\n\n');
  const role = url.searchParams.get('role');
  const id = url.searchParams.get('id');
  if (role === 'tv') {
    const wanted = url.searchParams.get('display');
    const d = wanted ? sessao.getDisplay(wanted) : sessao.defaultDisplay();
    const ev = url.searchParams.get('event');
    if (!d || (ev && ev.toUpperCase() !== sessao.EVENT)) { sessao.sse(res, 'erro', { error: 'Telão desconhecido. Confira o endereço.' }); return res.end(); }
    sessao.dropStale(d);
    d.tvClients.add(res);
    sessao.sse(res, 'hello', {
      event: sessao.EVENT, display: d.code, mobileUrl: mobileUrl(d), todayCount: sessao.todayCount, evento: sessao.evento(),
      vestibular: vestibularUrl('tv', sessao.evento()), state: sessao.displayState(d),
    });
    if (d.current) sessao.sse(res, 'start', sessao.publicLead(sessao.leads.get(d.current)));
    sessao.touch(d, true);
    req.on('close', () => {
      d.tvClients.delete(res);
      if (!d.tvClients.size) { d.audio = null; d.offlineSince = Date.now(); sessao.clearScene(d); }
    });
    sessao.advance(d); // havia gente esperando esta TV conectar
  } else if (role === 'op') {
    if (!auth.isAuthed(req)) { sessao.sse(res, 'auth', {}); return res.end(); }
    sessao.opClients.add(res);
    req.on('close', () => sessao.opClients.delete(res));
  } else if (id && sessao.leads.has(id)) {
    if (!sessao.phoneClients.has(id)) sessao.phoneClients.set(id, new Set());
    sessao.phoneClients.get(id).add(res);
    sessao.sse(res, 'status', sessao.phoneStatus(id));
    req.on('close', () => sessao.phoneClients.get(id)?.delete(res));
  } else {
    sessao.sse(res, 'status', { state: 'unknown' });
  }
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => clearInterval(ping));
}

async function api(req, res, url) {
  const p = url.pathname;
  if (limited(req, 'api')) return send(res, 429, { error: 'Muitos pedidos. Espere um pouco.' });

  if (p === '/api/info') {
    return send(res, 200, {
      event: sessao.EVENT, evento: sessao.evento(), todayCount: sessao.todayCount,
      mobileUrl: mobileUrl(), presentationUrl: presentationUrl(),
      displays: [...sessao.displays.values()].map(displaySummary),
    });
  }
  if (p === '/api/stream') return openStream(req, res, url);

  let m = p.match(/^\/api\/join\/([A-Za-z0-9]{4,16})$/);
  if (m) {
    const d = sessao.byJoin(m[1]);
    return d ? send(res, 200, { ok: true, evento: sessao.evento(), display: d.code }) : send(res, 404, { error: 'QR Code inválido.' });
  }
  m = p.match(/^\/api\/voz\/ola\/([0-9a-f-]{36})\.mp3$/);
  if (m) {
    const mp3 = await voz.ola(sessao.leads.get(m[1]));
    if (!mp3) return send(res, 404, 'sem voz');
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': mp3.length, 'Cache-Control': 'private, max-age=3600' });
    return res.end(req.method === 'HEAD' ? undefined : mp3);
  }
  m = p.match(/^\/api\/displays\/([A-Za-z0-9-]{1,32})\/state$/);
  if (m) {
    const d = sessao.getDisplay(m[1]);
    return d ? send(res, 200, sessao.displayState(d)) : send(res, 404, { error: 'Telão desconhecido.' });
  }

  /* ---------- painel do operador ---------- */
  if (p.startsWith('/api/op/')) {
    if (p === '/api/op/login' && req.method === 'POST') {
      const { key } = await readBody(req);
      const r = auth.login(key, clientIp(req), isHttps(req));
      if (r.error) return send(res, r.status, { error: r.error });
      return send(res, 204, '', { 'Set-Cookie': r.cookie });
    }
    if (p === '/api/op/logout') return send(res, 204, '', { 'Set-Cookie': auth.logout(req, isHttps(req)) });
    if (!auth.isAuthed(req)) return send(res, 401, { error: 'Entre com a senha do painel.' });

    if (req.method === 'GET') {
      if (p === '/api/op/state') return send(res, 200, opState(url));
      if (p === '/api/op/metricas') return send(res, 200, funil.resumo(url.searchParams.get('evento') || ''));
      if (p === '/api/op/leads') return send(res, 200, { leads: filteredLeads(url).reverse(), todayCount: sessao.todayCount });
      if (p === '/api/op/leads.csv') {
        const parts = ['leads-devpath', url.searchParams.get('evento') && slug(url.searchParams.get('evento')), url.searchParams.get('interesse'), today()];
        return send(res, 200, store.csvText(filteredLeads(url)), {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${parts.filter(Boolean).join('-')}.csv"`,
        });
      }
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (p === '/api/op/cmd') {
        if (!['next', 'prev', 'pause', 'stop', 'demo', 'mute', 'legendas', 'narracao'].includes(body.cmd)) return send(res, 400, { error: 'cmd' });
        const d = sessao.getDisplay(body.display) || sessao.defaultDisplay();
        if (!d.tvClients.size) return send(res, 409, { error: `A TV do ${d.code} não está conectada.` });
        sessao.toTV(d, 'cmd', { cmd: body.cmd });
        return send(res, 204, '');
      }
      if (p === '/api/op/evento') {
        sessao.setEvento(body.nome, (ev) => vestibularUrl('tv', ev));
        return send(res, 200, { evento: sessao.evento() });
      }
      if (p === '/api/op/leads/excluir') {
        if (!leads.remove(body.id, 'operador')) return send(res, 404, { error: 'Lead não encontrado.' });
        return send(res, 204, '');
      }
    }
    return send(res, 404, { error: 'not found' });
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const body = await readBody(req);

  /* ---------- celular ---------- */
  if (p === '/api/lead') {
    if (limited(req, 'lead')) return send(res, 429, { errors: { form: 'Muitos cadastros deste aparelho. Espere um minuto.' } });
    const { errors, lead } = leads.create(body);
    if (errors) return send(res, 422, { errors });
    return send(res, 201, { id: lead.id, name: lead.name, interest: lead.interest, display: lead.display });
  }

  if (p === '/api/lead/excluir') {
    if (!leads.remove(body.id, 'visitante')) return send(res, 404, { error: 'Cadastro não encontrado.' });
    return send(res, 204, '');
  }

  // START: a TV certa recebe "start" (ou o visitante entra na fila daquele telão)
  const startMatch = p.match(/^\/api\/sessions\/([0-9a-f-]{36})\/start$/);
  if (p === '/api/start' || startMatch) {
    if (limited(req, 'start')) return send(res, 429, { error: 'Espere um pouco antes de tentar de novo.' });
    const id = startMatch ? startMatch[1] : body.id;
    if (!sessao.leads.has(id)) return send(res, 404, { error: 'Cadastro não encontrado. Preencha novamente.' });
    return send(res, 200, sessao.start(id));
  }

  if (p === '/api/react') {
    if (limited(req, 'react')) return send(res, 429, { error: 'slow' });
    const lead = sessao.leads.get(body.id);
    if (!lead || !config.REACTIONS.includes(body.type)) return send(res, 400, { error: 'reaction' });
    const now = Date.now();
    if (now - (lead.lastReaction || 0) < 350) return send(res, 429, { error: 'slow' });
    lead.lastReaction = now;
    const d = sessao.displayOf(lead);
    sessao.toTV(d, 'react', { type: body.type, name: firstName(lead.name) });
    const scene = d.current === lead.id ? d.scene : null;
    funil.track('reacao', lead.evento, { lead: lead.id, reacao: body.type, cena: scene?.label, ordem: scene?.index });
    sessao.toOp('funil', {});
    return send(res, 204, '');
  }

  // passos do funil que só o celular enxerga (abriu a página, começou a digitar, salvou o crachá)
  if (p === '/api/evento') {
    if (limited(req, 'evento')) return send(res, 429, { error: 'slow' });
    if (!funil.DO_CELULAR.includes(body.tipo) || !leads.VISITOR_RE.test(body.visitante || '')) return send(res, 400, { error: 'evento' });
    const lead = sessao.leads.get(body.lead);
    if (body.tipo === 'compartilhou' && !lead) return send(res, 400, { error: 'lead' });
    const dados = { visitante: body.visitante };
    if (lead) dados.lead = lead.id;
    if (funil.track(body.tipo, lead?.evento || sessao.evento(), dados)) sessao.toOp('funil', {});
    return send(res, 204, '');
  }

  /* ---------- TV (body.display diz qual telão) ---------- */
  if (p === '/api/tv/scene') {
    sessao.setScene(tvDisplay(body), { index: Number(body.index) || 0, total: Number(body.total) || 0, label: String(body.label || '').slice(0, 60), paused: !!body.paused });
    return send(res, 204, '');
  }

  // a TV conta ao painel como está o som (liberado, mudo, legenda, narração, voz em uso)
  if (p === '/api/tv/audio') {
    sessao.setTvAudio(tvDisplay(body), {
      pronto: !!body.pronto, mudo: !!body.mudo, legendas: !!body.legendas, narracao: !!body.narracao,
      voz: String(body.voz || '').slice(0, 160),
    });
    return send(res, 204, '');
  }

  if (p === '/api/tv/heartbeat') {
    sessao.touch(tvDisplay(body), true);
    return send(res, 204, '');
  }

  if (p === '/api/tv/done') {
    const d = tvDisplay(body);
    sessao.clearScene(d);
    // sem ninguém na TV (demonstração ou lead excluído no meio): só chama o próximo
    if (d.current) sessao.finishCurrent(d, body.completo !== false);
    else sessao.advance(d);
    return send(res, 204, '');
  }

  return send(res, 404, { error: 'not found' });
}

// Link do vestibular no celular: registra o clique e redireciona com UTM do evento
function goVestibular(res, url) {
  const lead = sessao.leads.get(url.searchParams.get('lead'));
  const evento = lead?.evento || sessao.evento();
  if (lead) {
    funil.track('vestibular_clique', evento, { lead: lead.id, visitante: lead.visitante });
    sessao.toOp('funil', {});
  }
  res.writeHead(302, { Location: vestibularUrl('celular', evento), 'Cache-Control': 'no-store' });
  res.end();
}

/* ---------- páginas e arquivos estáticos ---------- */
const MEDIA = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm']);
const redirect = (res, to) => { res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' }); res.end(); };

// Qual arquivo de public/ responde a este caminho (null = 404)
function resolvePage(p) {
  if (p === '/operador' || p === '/admin') return '/admin.html';
  let m = p.match(/^\/presentation\/([A-Za-z0-9-]+)\/([A-Za-z0-9-]+)\/?$/);
  if (m) return m[1].toUpperCase() === sessao.EVENT && sessao.getDisplay(m[2]) ? '/index.html' : null;
  m = p.match(/^\/join\/([A-Za-z0-9]{4,16})\/?$/);
  if (m) return sessao.byJoin(m[1]) ? '/m.html' : null;
  // as páginas usam caminhos relativos (css/…, js/…, audio/…): valem também dentro de /presentation/… e /join/…
  m = p.match(/^\/(?:presentation\/[^/]+|join)\/((?:css|js|fonts|vendor|audio)\/.+)$/);
  if (m) return '/' + m[1];
  if (/\.html$/.test(p)) return null; // páginas só pelos endereços acima
  return p;
}

function serveStatic(req, res, url) {
  const p = decodeURIComponent(url.pathname);
  const d = sessao.defaultDisplay();
  if (p === '/' || p === '/tv' || p === '/presentation' || p === '/index.html') return redirect(res, `/presentation/${d.eventCode}/${d.code}${url.search}`);
  if (p === '/m' || p === '/m.html') return redirect(res, `/join/${d.joinCode}`);
  const rel = resolvePage(p);
  if (!rel) return send(res, 404, 'Página não encontrada. Confira o endereço ou escaneie o QR Code da TV de novo.');
  const file = path.normalize(path.join(config.PUBLIC_DIR, rel));
  if (!file.startsWith(config.PUBLIC_DIR + path.sep)) return send(res, 403, 'forbidden');
  const ext = path.extname(file);
  // áudio: o navegador pede pedaços do arquivo (cabeçalho Range) para tocar e continuar de onde parou
  if (MEDIA.has(ext) && req.headers.range) return serveRange(req, res, file, ext);
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Página não encontrada');
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.woff2' || MEDIA.has(ext) ? 'public, max-age=86400' : 'no-cache',
      ...(MEDIA.has(ext) && { 'Accept-Ranges': 'bytes' }),
    });
    res.end(data);
  });
}

// "Range: bytes=100-200" → responde 206 só com esse pedaço
function serveRange(req, res, file, ext) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Página não encontrada');
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range).trim());
    let start = m && m[1] ? Number(m[1]) : 0;
    let end = m && m[2] ? Number(m[2]) : st.size - 1;
    if (m && !m[1] && m[2]) { start = Math.max(0, st.size - Number(m[2])); end = st.size - 1; } // "bytes=-500" = últimos 500
    end = Math.min(end, st.size - 1);
    if (!m || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
      return res.end();
    }
    res.writeHead(206, {
      'Content-Type': MIME[ext],
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${st.size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file, { start, end }).pipe(res);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://local');
  securityHeaders(req, res);
  try {
    if (url.pathname === '/healthz') {
      const h = await store.health();
      return send(res, h.ok ? 200 : 503, { ok: h.ok, banco: h.banco, teloes: [...sessao.displays.values()].map((d) => `${d.code}:${sessao.status(d)}`) });
    }
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (url.pathname === '/ir/vestibular') goVestibular(res, url);
    else serveStatic(req, res, url);
  } catch (err) {
    if (!res.headersSent) send(res, 400, { error: 'Requisição inválida.' });
  }
}

module.exports = { handle, setPort, mobileUrl, presentationUrl, baseUrl };
