/*
 * Sessão do estande: EVENTO → TELÕES → SESSÕES.
 *
 *   evento   FATEC2026            (config.EVENT_CODE)
 *   telão    TELAO-01, TELAO-02…  (config.DISPLAYS): cada um com fila própria, TV própria e QR próprio
 *   sessão   uma ida do visitante à TV (id aleatório), do "Começar" até o crachá
 *
 * O QR de cada telão aponta para /join/<código>. O código é opaco (HMAC do SESSION_SECRET):
 * não revela nada e não muda entre reinícios, então um QR impresso continua valendo.
 *
 * Tempo real por SSE: cada TV, celular e painel mantém uma conexão aberta; "salas" são os grupos
 * de conexões de cada telão (display.tvClients) e de cada cadastro (phoneClients).
 * Filas, telões e nome do evento ficam salvos (data/estado.json ou tabela app_state):
 * se o servidor cair, ele volta de onde parou e as TVs e celulares reconectam sozinhos.
 */
'use strict';

const crypto = require('crypto');
const store = require('./store');
const funil = require('./funil');
const { today, stamp } = require('./util');
const config = require('./config');

const EVENT = config.EVENT_CODE;
const leads = new Map();        // id → { id, name, interest, evento, visitante, when, done, display, session }
const displays = new Map();     // código → telão
const phoneClients = new Map(); // id do lead → Set de respostas SSE
const opClients = new Set();    // painéis do operador
let eventoManual = '';          // nome definido no painel
let todayCount = 0;

/* ---------------- telões ---------------- */
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function joinCodeFor(display) {
  const h = crypto.createHmac('sha256', config.SESSION_SECRET).update(`join:${EVENT}:${display}`).digest();
  let n = h.readBigUInt64BE(0), out = '';
  for (let k = 0; k < 8; k++) { out += B62[Number(n % 62n)]; n /= 62n; }
  return out;
}

for (const code of config.DISPLAYS) {
  displays.set(code, {
    code, eventCode: EVENT, joinCode: joinCodeFor(code),
    queue: [],              // ids de leads esperando esta TV
    current: null,          // id do lead na TV agora
    tvClients: new Set(),   // conexões SSE das TVs deste telão (normalmente uma)
    scene: null,            // { index, total, label, paused }
    audio: null,            // { pronto, mudo, legendas, narracao, voz }
    lastSeen: 0,            // último sinal da TV (ms)
    recorded: '',
  });
}
const getDisplay = (code) => displays.get(String(code || '').toUpperCase()) || null;
const defaultDisplay = () => displays.values().next().value;
const byJoin = (jc) => [...displays.values()].find((d) => d.joinCode === jc) || null;
const displayOf = (lead) => getDisplay(lead?.display) || defaultDisplay();

// OFFLINE: nenhuma TV conectada · WAITING: QR na tela · READY: alguém na fila, TV livre
// RUNNING: apresentação · FINISHING: última cena (crachá)
function status(d) {
  if (!d.tvClients.size) return 'OFFLINE';
  if (d.current) return d.scene && d.scene.index === d.scene.total ? 'FINISHING' : 'RUNNING';
  return d.queue.length ? 'READY' : 'WAITING';
}

// Registra no banco a mudança de estado e, no máximo a cada 30 s, o último sinal
function touch(d, seen = false) {
  if (seen) d.lastSeen = Date.now();
  const st = status(d);
  const key = `${st}|${Math.floor(d.lastSeen / 30000)}`;
  if (key === d.recorded) return;
  d.recorded = key;
  store.recordDisplay({ ...d, status: st });
}

// Nome do evento atual: o do painel, o da variável EVENTO ou "Estande 02/10/2026"
function evento() {
  if (eventoManual) return eventoManual;
  if (config.EVENTO) return config.EVENTO;
  const [y, m, d] = today().split('-');
  return `Estande ${d}/${m}/${y}`;
}

function persist() {
  store.saveState(() => ({
    salvoEm: stamp(), eventoManual,
    leads: [...leads.values()].map(({ lastReaction, ...l }) => l),
    displays: Object.fromEntries([...displays.values()].map((d) => [d.code, { queue: d.queue, current: d.current }])),
  }));
}

function restore() {
  todayCount = store.readLeads().filter((l) => (l.when || '').startsWith(today())).length;
  const st = store.loadState();
  if (!st) return;
  eventoManual = st.eventoManual || '';
  // Só volta quem ainda está cadastrado (um lead excluído não reaparece)
  const ativos = new Set(store.readLeads().map((l) => l.id));
  for (const l of st.leads || []) if (ativos.has(l.id)) leads.set(l.id, l);
  // estado.json da V5 (uma fila só) → primeiro telão
  const saved = st.displays || { [defaultDisplay().code]: { queue: st.queue || [], current: st.current } };
  let fila = 0, tv = 0;
  for (const [code, s] of Object.entries(saved)) {
    const d = getDisplay(code);
    if (!d) continue;
    for (const id of s.queue || []) if (leads.has(id) && !d.queue.includes(id)) d.queue.push(id);
    if (leads.has(s.current)) d.current = s.current;
    fila += d.queue.length; tv += d.current ? 1 : 0;
  }
  if (fila || tv) console.log(`  Sessão recuperada: ${tv} telão(ões) em apresentação, ${fila} na fila.`);
}

/* ---------------- SSE ---------------- */
function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
const toTV = (d, event, data) => d.tvClients.forEach((res) => sse(res, event, data));
const toAllTVs = (event, data) => displays.forEach((d) => toTV(d, event, data));
const toPhone = (id, event, data) => phoneClients.get(id)?.forEach((res) => sse(res, event, data));
const toOp = (event, data) => opClients.forEach((res) => sse(res, event, data));

// O que a TV recebe: nada de contato. (sessionId, nome para o crachá, interesse = objetivo)
const publicLead = (l) => l && { id: l.id, sessionId: l.session || null, name: l.name, interest: l.interest };

function phoneStatus(id) {
  const lead = leads.get(id);
  const d = displayOf(lead);
  if (id === d.current) return { state: 'playing', display: d.code };
  const pos = d.queue.indexOf(id);
  if (pos >= 0) return { state: 'queued', position: pos + 1, tvOnline: d.tvClients.size > 0, busy: !!d.current, display: d.code };
  return { state: lead?.done ? 'done' : 'ready', display: d.code };
}

function broadcastQueue(d) {
  d.queue.forEach((id) => toPhone(id, 'status', phoneStatus(id)));
  toTV(d, 'queue', { size: d.queue.length, next: d.queue.slice(0, 3).map((id) => leads.get(id)?.name) });
  touch(d);
}

// Um visitante por vez em cada telão: o próximo só entra quando a TV está livre e conectada
function advance(d) {
  if (d.current || !d.queue.length || !d.tvClients.size) return broadcastQueue(d);
  d.current = d.queue.shift();
  const lead = leads.get(d.current);
  persist();
  store.recordSession({ id: lead.session, leadId: lead.id, eventCode: EVENT, display: d.code, status: 'running' });
  toTV(d, 'start', publicLead(lead));
  toPhone(d.current, 'status', phoneStatus(d.current));
  broadcastQueue(d);
}

// completo = a apresentação chegou ao crachá; false = o operador encerrou antes
function finishCurrent(d, completo) {
  if (!d.current) return;
  const lead = leads.get(d.current);
  if (lead) {
    lead.done = true;
    funil.track(completo ? 'concluido' : 'interrompido', lead.evento, { lead: lead.id, visitante: lead.visitante, telao: d.code });
    store.recordSession({ id: lead.session, leadId: lead.id, eventCode: EVENT, display: d.code, status: completo ? 'completed' : 'interrupted' });
    toOp('funil', {});
  }
  toPhone(d.current, 'status', { state: 'done', display: d.code });
  d.current = null;
  d.scene = null;
  persist();
  advance(d);
}

/* ---------------- ações ---------------- */
function addLead(lead) {
  leads.set(lead.id, {
    id: lead.id, name: lead.name, interest: lead.interest, evento: lead.evento, visitante: lead.visitante,
    when: lead.when, done: false, display: lead.display, session: null,
  });
  todayCount += 1;
  persist();
  toTV(displayOf(lead), 'lead', { name: String(lead.name).split(' ')[0], todayCount });
  toOp('funil', {});
}

function start(id) {
  const lead = leads.get(id);
  const d = displayOf(lead);
  lead.done = false;
  if (id !== d.current && !d.queue.includes(id)) {
    d.queue.push(id);
    lead.session = crypto.randomUUID();
    store.recordSession({ id: lead.session, leadId: id, eventCode: EVENT, display: d.code, status: 'queued' });
    funil.track('inicio', lead.evento, { lead: id, visitante: lead.visitante, telao: d.code });
    toOp('funil', {});
  }
  persist();
  advance(d);
  return phoneStatus(id);
}

// Remove o lead da sessão (pedido de exclusão). A planilha/banco é tratada em leads.js.
function forget(id) {
  const lead = leads.get(id);
  if (!lead) return;
  const d = displayOf(lead);
  leads.delete(id);
  const pos = d.queue.indexOf(id);
  if (pos >= 0) d.queue.splice(pos, 1);
  if (lead.session) store.recordSession({ id: lead.session, leadId: id, eventCode: EVENT, display: d.code, status: 'canceled' });
  if (d.current === id) { d.current = null; d.scene = null; toTV(d, 'cmd', { cmd: 'stop' }); }
  toPhone(id, 'status', { state: 'unknown' });
  todayCount = store.readLeads().filter((l) => (l.when || '').startsWith(today())).length;
  persist();
  broadcastQueue(d);
}

function setEvento(nome, vestibularFor) {
  eventoManual = String(nome || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  persist();
  store.recordEvent(EVENT, evento());
  toAllTVs('evento', { evento: evento(), vestibular: vestibularFor(evento()) });
  toOp('funil', {});
}

function setScene(d, scene) {
  d.scene = scene;
  if (d.current) toPhone(d.current, 'scene', { index: scene.index, total: scene.total, label: scene.label });
  touch(d, true);
}

// Estado público de um telão (a TV consulta ao reconectar)
function displayState(d) {
  return {
    event: EVENT, display: d.code, status: status(d), lastSeen: d.lastSeen ? new Date(d.lastSeen).toISOString() : null,
    current: d.current ? { firstName: String(leads.get(d.current)?.name || '').split(' ')[0], interest: leads.get(d.current)?.interest } : null,
    scene: d.scene, queue: d.queue.length,
  };
}

module.exports = {
  EVENT, leads, displays, phoneClients, opClients,
  get todayCount() { return todayCount; },
  evento, restore, sse, toTV, toAllTVs, toPhone, toOp, publicLead, phoneStatus,
  advance, finishCurrent, addLead, start, forget, setEvento, setScene, displayState,
  getDisplay, defaultDisplay, byJoin, displayOf, status, touch, persist,
  setTvAudio(d, audio) { d.audio = audio; touch(d, true); },
  clearScene(d) { d.scene = null; touch(d); },
};
