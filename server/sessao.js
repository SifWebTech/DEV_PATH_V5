/*
 * Sessão do estande: fila, quem está na TV agora e as conexões em tempo real (SSE).
 * A fila, a apresentação atual e o nome do evento ficam salvos em data/estado.json:
 * se o servidor cair, ele volta de onde parou e os celulares reconectam sozinhos.
 */
'use strict';

const store = require('./store');
const funil = require('./funil');
const { firstName, today, stamp, vestibularUrl } = require('./util');
const { EVENTO } = require('./config');

const leads = new Map();        // id → { id, name, interest, evento, visitante, when, done }
const queue = [];               // ids aguardando a TV
let current = null;             // id em apresentação
let eventoManual = '';          // nome definido no painel do operador
const tvClients = new Set();    // respostas SSE das TVs
const phoneClients = new Map(); // id → Set de respostas SSE
const opClients = new Set();    // painéis do operador
let tvScene = null;             // { index, total, label, paused } — o que a TV mostra agora
let todayCount = 0;

// Nome do evento atual: o do painel, o da variável EVENTO ou "Estande 02/10/2026"
function evento() {
  if (eventoManual) return eventoManual;
  if (EVENTO) return EVENTO;
  const [y, m, d] = today().split('-');
  return `Estande ${d}/${m}/${y}`;
}

function persist() {
  store.saveState(() => ({ salvoEm: stamp(), eventoManual, current, queue, leads: [...leads.values()] }));
}

function restore() {
  todayCount = store.readLeads().filter((l) => (l.when || '').startsWith(today())).length;
  const st = store.loadState();
  if (!st) return;
  eventoManual = st.eventoManual || '';
  // Só volta quem ainda está na planilha (um lead excluído não reaparece)
  const ativos = new Set(store.readLeads().map((l) => l.id));
  for (const l of st.leads || []) if (ativos.has(l.id)) leads.set(l.id, l);
  for (const id of st.queue || []) if (leads.has(id)) queue.push(id);
  if (leads.has(st.current)) current = st.current;
  if (current || queue.length) console.log(`  Sessão recuperada: ${current ? '1 na TV' : 'TV livre'}, ${queue.length} na fila.`);
}

/* ---------------- SSE ---------------- */
function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
const toTV = (event, data) => tvClients.forEach((res) => sse(res, event, data));
const toPhone = (id, event, data) => phoneClients.get(id)?.forEach((res) => sse(res, event, data));
const toOp = (event, data) => opClients.forEach((res) => sse(res, event, data));

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
  persist();
  toTV('start', publicLead(leads.get(current)));
  toPhone(current, 'status', phoneStatus(current));
  broadcastQueue();
}

// completo = a apresentação chegou ao crachá; false = o operador encerrou antes
function finishCurrent(completo) {
  if (!current) return;
  const lead = leads.get(current);
  if (lead) {
    lead.done = true;
    funil.track(completo ? 'concluido' : 'interrompido', lead.evento, { lead: lead.id, visitante: lead.visitante });
    toOp('funil', {});
  }
  toPhone(current, 'status', { state: 'done' });
  current = null;
  persist();
  advance();
}

/* ---------------- ações ---------------- */
function addLead(lead) {
  leads.set(lead.id, {
    id: lead.id, name: lead.name, interest: lead.interest, evento: lead.evento, visitante: lead.visitante, when: lead.when, done: false,
  });
  todayCount += 1;
  persist();
  toTV('lead', { name: firstName(lead.name), todayCount });
  toOp('funil', {});
}

function start(id) {
  const lead = leads.get(id);
  lead.done = false;
  if (id !== current && !queue.includes(id)) {
    queue.push(id);
    funil.track('inicio', lead.evento, { lead: id, visitante: lead.visitante });
    toOp('funil', {});
  }
  persist();
  advance();
  return phoneStatus(id);
}

// Remove o lead da sessão (pedido de exclusão). A planilha é tratada em leads.js.
function forget(id) {
  if (!leads.has(id)) return;
  leads.delete(id);
  const pos = queue.indexOf(id);
  if (pos >= 0) queue.splice(pos, 1);
  if (current === id) { current = null; toTV('cmd', { cmd: 'stop' }); }
  toPhone(id, 'status', { state: 'unknown' });
  todayCount = store.readLeads().filter((l) => (l.when || '').startsWith(today())).length;
  persist();
  broadcastQueue();
}

function setEvento(nome) {
  eventoManual = String(nome || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  persist();
  toTV('evento', { evento: evento(), vestibular: vestibularUrl('tv', evento()) });
  toOp('funil', {});
}

function setScene(scene) {
  tvScene = scene;
  if (current) toPhone(current, 'scene', { index: scene.index, total: scene.total, label: scene.label });
}

module.exports = {
  leads, queue, tvClients, phoneClients, opClients,
  get current() { return current; },
  get tvScene() { return tvScene; },
  get todayCount() { return todayCount; },
  evento, restore, sse, toTV, toPhone, toOp, publicLead, phoneStatus,
  advance, finishCurrent, addLead, start, forget, setEvento, setScene,
  clearScene() { tvScene = null; },
};
