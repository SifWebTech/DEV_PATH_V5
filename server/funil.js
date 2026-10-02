/*
 * Funil de marketing: cada passo do visitante vira um evento em data/eventos.jsonl.
 * Os eventos guardam só ids aleatórios (visitante, lead), nunca nome ou contato,
 * então continuam valendo para as estatísticas mesmo depois de um lead ser excluído.
 */
'use strict';

const store = require('./store');
const { stamp } = require('./util');
const { EVENTO_LEGADO } = require('./config');

// Etapas na ordem do funil. "chave" diz o que conta como uma pessoa naquela etapa.
const ETAPAS = [
  { tipo: 'qr_aberto', nome: 'Abriu pelo QR Code', chave: 'visitante' },
  { tipo: 'form_inicio', nome: 'Começou o cadastro', chave: 'visitante' },
  { tipo: 'lead', nome: 'Cadastrou', chave: 'lead' },
  { tipo: 'inicio', nome: 'Tocou em Começar', chave: 'lead' },
  { tipo: 'concluido', nome: 'Assistiu até o crachá', chave: 'lead' },
  { tipo: 'compartilhou', nome: 'Salvou o crachá', chave: 'lead' },
  { tipo: 'vestibular_clique', nome: 'Abriu o vestibular', chave: 'lead' },
];
// Eventos que o próprio celular pode enviar (os outros só o servidor registra)
const DO_CELULAR = ['qr_aberto', 'form_inicio', 'compartilhou'];

let events = [];
const seen = new Set(); // evita contar duas vezes o mesmo visitante abrindo a página

const seenKey = (e) => `${e.evento}|${e.tipo}|${e.visitante || e.lead}`;

function init() {
  const saved = store.readEvents();
  if (saved) events = saved;
  else {
    // Primeira execução da V5: os leads da V4 entram no funil como "Antes da V5".
    events = store.readLeads().map((l) => ({
      quando: l.when, tipo: 'lead', evento: l.evento || EVENTO_LEGADO, lead: l.id, interesse: l.interest, importado: true,
    }));
    store.appendEvents(events);
  }
  events.forEach((e) => seen.add(seenKey(e)));
}

function track(tipo, evento, dados = {}) {
  const e = { quando: stamp(), tipo, evento, ...dados };
  if (tipo === 'qr_aberto' || tipo === 'form_inicio') {
    if (seen.has(seenKey(e))) return false;
  }
  seen.add(seenKey(e));
  events.push(e);
  store.appendEvents([e]);
  return true;
}

const count = (map, k) => map.set(k, (map.get(k) || 0) + 1);

function resumo(evento) {
  const list = evento ? events.filter((e) => e.evento === evento) : events;

  const funil = ETAPAS.map((etapa) => {
    const pessoas = new Set(list.filter((e) => e.tipo === etapa.tipo).map((e) => e[etapa.chave] || e.visitante));
    return { tipo: etapa.tipo, nome: etapa.nome, total: pessoas.size };
  });

  const interesses = new Map();
  const porHora = new Map();
  const cenas = new Map();
  const reacoes = new Map();
  let interrompidos = 0;
  for (const e of list) {
    if (e.tipo === 'lead') {
      count(interesses, e.interesse);
      count(porHora, String(e.quando || '').slice(11, 13) + 'h');
    } else if (e.tipo === 'reacao') {
      count(reacoes, e.reacao);
      if (e.cena) {
        const c = cenas.get(e.cena) || { cena: e.cena, ordem: e.ordem || 0, total: 0 };
        c.total += 1;
        cenas.set(e.cena, c);
      }
    } else if (e.tipo === 'interrompido') interrompidos += 1;
  }

  // Todos os eventos já registrados, com o número de cadastros de cada um
  const todos = new Map();
  for (const e of events) {
    if (!todos.has(e.evento)) todos.set(e.evento, 0);
    if (e.tipo === 'lead') todos.set(e.evento, todos.get(e.evento) + 1);
  }

  return {
    evento: evento || null,
    funil,
    interesses: Object.fromEntries(interesses),
    porHora: [...porHora].sort(([a], [b]) => a.localeCompare(b)).map(([hora, total]) => ({ hora, total })),
    cenas: [...cenas.values()].sort((a, b) => a.ordem - b.ordem),
    reacoes: Object.fromEntries(reacoes),
    interrompidos,
    eventos: [...todos].map(([nome, leads]) => ({ nome, leads })),
  };
}

module.exports = { ETAPAS, DO_CELULAR, init, track, resumo };
