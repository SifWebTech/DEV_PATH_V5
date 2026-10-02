/*
 * Rotas HTTP e arquivos estáticos.
 *
 *   Celular  POST /api/lead, /api/lead/excluir, /api/start, /api/react, /api/evento
 *            GET  /ir/vestibular?lead=…   → registra o clique e abre o vestibular com UTM
 *   TV       POST /api/tv/scene, /api/tv/done
 *   Todos    GET  /api/info, /api/stream?role=tv|phone|op
 *   Operador (cookie de login)
 *            POST /api/op/login, /api/op/logout, /api/op/cmd, /api/op/evento, /api/op/leads/excluir
 *            GET  /api/op/state, /api/op/metricas, /api/op/leads, /api/op/leads.csv
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sessao = require('./sessao');
const leads = require('./leads');
const funil = require('./funil');
const store = require('./store');
const auth = require('./auth');
const { send, readBody, MIME, slug, vestibularUrl, lanAddress, firstName, today } = require('./util');
const config = require('./config');

let port = config.PORT;
const setPort = (p) => { port = p; };
const mobileUrl = () => config.PUBLIC_URL || `http://${lanAddress()}:${port}/m`;

function opState() {
  return {
    tvOnline: sessao.tvClients.size > 0,
    mobileUrl: mobileUrl(),
    current: sessao.publicLead(sessao.leads.get(sessao.current)),
    scene: sessao.tvScene,
    queue: sessao.queue.map((id) => sessao.leads.get(id)?.name),
    todayCount: sessao.todayCount,
    evento: sessao.evento(),
  };
}

// Leads da planilha com filtro opcional por evento e interesse (exportação segmentada)
function filteredLeads(url) {
  const evento = url.searchParams.get('evento');
  const interesse = url.searchParams.get('interesse');
  return store.readLeads().filter((l) => (!evento || l.evento === evento) && (!interesse || l.interest === interesse));
}

function openStream(req, res, url) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.write('retry: 2000\n\n');
  const role = url.searchParams.get('role');
  const id = url.searchParams.get('id');
  if (role === 'tv') {
    sessao.tvClients.add(res);
    sessao.sse(res, 'hello', { mobileUrl: mobileUrl(), todayCount: sessao.todayCount, evento: sessao.evento(), vestibular: vestibularUrl('tv', sessao.evento()) });
    if (sessao.current) sessao.sse(res, 'start', sessao.publicLead(sessao.leads.get(sessao.current)));
    req.on('close', () => { sessao.tvClients.delete(res); if (!sessao.tvClients.size) sessao.clearScene(); });
    sessao.advance(); // havia gente esperando a TV conectar
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

  if (p === '/api/info') {
    return send(res, 200, {
      mobileUrl: mobileUrl(), todayCount: sessao.todayCount, queue: sessao.queue.length,
      current: sessao.publicLead(sessao.leads.get(sessao.current)), evento: sessao.evento(),
    });
  }
  if (p === '/api/stream') return openStream(req, res, url);

  /* ---------- painel do operador ---------- */
  if (p.startsWith('/api/op/')) {
    if (p === '/api/op/login' && req.method === 'POST') {
      const { key } = await readBody(req);
      const r = auth.login(key, req.socket.remoteAddress);
      if (r.error) return send(res, r.status, { error: r.error });
      return send(res, 204, '', { 'Set-Cookie': r.cookie });
    }
    if (p === '/api/op/logout') return send(res, 204, '', { 'Set-Cookie': auth.logout(req) });
    if (!auth.isAuthed(req)) return send(res, 401, { error: 'Entre com a senha do painel.' });

    if (req.method === 'GET') {
      if (p === '/api/op/state') return send(res, 200, opState());
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
        if (!['next', 'prev', 'pause', 'stop', 'demo'].includes(body.cmd)) return send(res, 400, { error: 'cmd' });
        if (!sessao.tvClients.size) return send(res, 409, { error: 'A TV não está conectada.' });
        sessao.toTV('cmd', { cmd: body.cmd });
        return send(res, 204, '');
      }
      if (p === '/api/op/evento') {
        sessao.setEvento(body.nome);
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
    const { errors, lead } = leads.create(body);
    if (errors) return send(res, 422, { errors });
    return send(res, 201, { id: lead.id, name: lead.name, interest: lead.interest });
  }

  if (p === '/api/lead/excluir') {
    if (!leads.remove(body.id, 'visitante')) return send(res, 404, { error: 'Cadastro não encontrado.' });
    return send(res, 204, '');
  }

  if (p === '/api/start') {
    if (!sessao.leads.has(body.id)) return send(res, 404, { error: 'Cadastro não encontrado. Preencha novamente.' });
    return send(res, 200, sessao.start(body.id));
  }

  if (p === '/api/react') {
    const lead = sessao.leads.get(body.id);
    if (!lead || !config.REACTIONS.includes(body.type)) return send(res, 400, { error: 'reaction' });
    const now = Date.now();
    if (now - (lead.lastReaction || 0) < 350) return send(res, 429, { error: 'slow' });
    lead.lastReaction = now;
    sessao.toTV('react', { type: body.type, name: firstName(lead.name) });
    const scene = sessao.current === lead.id ? sessao.tvScene : null;
    funil.track('reacao', lead.evento, { lead: lead.id, reacao: body.type, cena: scene?.label, ordem: scene?.index });
    sessao.toOp('funil', {});
    return send(res, 204, '');
  }

  // passos do funil que só o celular enxerga (abriu a página, começou a digitar, salvou o crachá)
  if (p === '/api/evento') {
    if (!funil.DO_CELULAR.includes(body.tipo) || !leads.VISITOR_RE.test(body.visitante || '')) return send(res, 400, { error: 'evento' });
    const lead = sessao.leads.get(body.lead);
    if (body.tipo === 'compartilhou' && !lead) return send(res, 400, { error: 'lead' });
    const dados = { visitante: body.visitante };
    if (lead) dados.lead = lead.id;
    if (funil.track(body.tipo, lead?.evento || sessao.evento(), dados)) sessao.toOp('funil', {});
    return send(res, 204, '');
  }

  /* ---------- TV ---------- */
  if (p === '/api/tv/scene') {
    sessao.setScene({ index: Number(body.index) || 0, total: Number(body.total) || 0, label: String(body.label || '').slice(0, 60), paused: !!body.paused });
    return send(res, 204, '');
  }

  if (p === '/api/tv/done') {
    sessao.clearScene();
    // sem ninguém na TV (demonstração ou lead excluído no meio): só chama o próximo
    if (sessao.current) sessao.finishCurrent(body.completo !== false);
    else sessao.advance();
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

/* ---------- arquivos estáticos ---------- */
const ROUTES = { '/': '/index.html', '/tv': '/index.html', '/m': '/m.html', '/admin': '/admin.html', '/operador': '/admin.html' };

function serveStatic(req, res, url) {
  const rel = ROUTES[url.pathname] || decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(config.PUBLIC_DIR, rel));
  if (!file.startsWith(config.PUBLIC_DIR)) return send(res, 403, 'forbidden');
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

async function handle(req, res) {
  const url = new URL(req.url, 'http://local');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (url.pathname === '/ir/vestibular') goVestibular(res, url);
    else serveStatic(req, res, url);
  } catch (err) {
    if (!res.headersSent) send(res, 400, { error: 'Requisição inválida.' });
  }
}

module.exports = { handle, setPort, mobileUrl };
