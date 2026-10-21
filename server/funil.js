/*
 * Funil de marketing: cada passo do visitante vira um evento em data/eventos.jsonl.
 * Os eventos guardam só ids aleatórios (visitante, lead), nunca nome ou contato,
 * então continuam valendo para as estatísticas mesmo depois de um lead ser excluído.
 */
'use strict';

const store = require('./store');
const { stamp } = require('./util');
const { EVENTO_LEGADO } = require('./config');

// Etapas na ordem do funil. As cinco primeiras são uma sequência: quem chegou a uma etapa passou
// pelas anteriores (não dá para cadastrar sem abrir a página). "Salvou o crachá" e "Abriu o vestibular"
// são ramos da tela final, que aparece para quem tocou em Começar: a % delas é sobre essa etapa ("base").
const ETAPAS = [
  { tipo: 'qr_aberto', nome: 'Abriu pelo QR Code' },
  { tipo: 'form_inicio', nome: 'Começou o cadastro' },
  { tipo: 'lead', nome: 'Cadastrou' },
  { tipo: 'inicio', nome: 'Tocou em Começar' },
  { tipo: 'concluido', nome: 'Assistiu até o crachá' },
  { tipo: 'compartilhou', nome: 'Salvou o crachá', base: 'inicio' },
  { tipo: 'vestibular_clique', nome: 'Abriu o vestibular', base: 'inicio' },
];
const SEQUENCIA = ETAPAS.filter((e) => !e.base).map((e) => e.tipo);
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

  // Uma pessoa = o aparelho (visitante). Etapas registradas pelo cadastro viram o aparelho que cadastrou;
  // sem aparelho (cadastros da V4), a pessoa é o próprio cadastro. Assim todas as etapas contam a mesma coisa.
  const aparelhoDoLead = new Map();
  for (const e of events) if (e.tipo === 'lead' && e.lead) aparelhoDoLead.set(e.lead, e.visitante || 'lead:' + e.lead);
  const pessoa = (e) => (e.lead && aparelhoDoLead.get(e.lead)) || e.visitante || (e.lead ? 'lead:' + e.lead : '');
  const viu = new Map(ETAPAS.map((etapa) => [etapa.tipo, new Set()]));
  for (const e of list) if (viu.has(e.tipo) && pessoa(e)) viu.get(e.tipo).add(pessoa(e));

  // Quem chegou a uma etapa também passou por todas as anteriores da sequência
  const alcancou = new Map();
  for (const [k, tipo] of SEQUENCIA.entries()) {
    const s = new Set();
    for (const depois of SEQUENCIA.slice(k)) viu.get(depois).forEach((p) => s.add(p));
    if (SEQUENCIA.indexOf('inicio') >= k) ETAPAS.filter((x) => x.base).forEach((x) => viu.get(x.tipo).forEach((p) => s.add(p)));
    alcancou.set(tipo, s);
  }
  const funil = ETAPAS.map((etapa, k) => ({
    tipo: etapa.tipo, nome: etapa.nome,
    total: (alcancou.get(etapa.tipo) || viu.get(etapa.tipo)).size,
    base: etapa.base || (k ? ETAPAS[k - 1].tipo : null), // a % é sobre esta etapa
  }));

  const interesses = new Map();
  const porHora = new Map();
  const cenas = new Map();
  const reacoes = new Map();
  const cadastros = new Set(), excluidos = new Set(), concluiram = new Set(), interrompidas = new Set();
  // Onde assistiram: no telão (fila) ou no próprio celular (modo "celular"), por cadastro
  const modos = { telao: { comecaram: new Set(), concluiram: new Set() }, celular: { comecaram: new Set(), concluiram: new Set() } };
  for (const e of list) {
    const m = modos[e.modo === 'celular' ? 'celular' : 'telao'];
    if (e.tipo === 'inicio') m.comecaram.add(e.lead);
    else if (e.tipo === 'concluido') m.concluiram.add(e.lead);
  }
  for (const e of list) {
    if (e.tipo === 'lead') {
      cadastros.add(e.lead);
      count(interesses, e.interesse);
      count(porHora, String(e.quando || '').slice(11, 13));
    } else if (e.tipo === 'lead_excluido') excluidos.add(e.lead);
    else if (e.tipo === 'concluido') concluiram.add(e.lead);
    else if (e.tipo === 'interrompido') interrompidas.add(e.lead);
    else if (e.tipo === 'reacao') {
      count(reacoes, e.reacao);
      if (e.cena) {
        const c = cenas.get(e.cena) || { cena: e.cena, ordem: e.ordem || 0, total: 0 };
        c.total += 1;
        cenas.set(e.cena, c);
      }
    }
  }
  // quem foi interrompido e depois assistiu de novo até o fim conta só como "assistiu"
  concluiram.forEach((id) => interrompidas.delete(id));
  const excluidosAqui = [...excluidos].filter((id) => cadastros.has(id)).length;

  // horas sem cadastro entre a primeira e a última aparecem com zero (o gráfico não "pula" horas)
  const horas = [...porHora.keys()].map(Number).filter((h) => h >= 0 && h <= 23);
  const linhaDoTempo = [];
  if (horas.length) for (let h = Math.min(...horas); h <= Math.max(...horas); h++) {
    const hh = String(h).padStart(2, '0');
    linhaDoTempo.push({ hora: hh + 'h', total: porHora.get(hh) || 0 });
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
    // cadastros feitos (cada formulário enviado) e quantos deles foram excluídos depois a pedido (LGPD)
    cadastros: { total: cadastros.size, excluidos: excluidosAqui, ativos: cadastros.size - excluidosAqui },
    interesses: Object.fromEntries(interesses),
    porHora: linhaDoTempo,
    cenas: [...cenas.values()].sort((a, b) => a.ordem - b.ordem),
    reacoes: Object.fromEntries(reacoes),
    // apresentações terminadas, por cadastro: viu até o crachá ou foi interrompido (e não voltou)
    assistiram: concluiram.size,
    interrompidos: interrompidas.size,
    onde: Object.fromEntries(Object.entries(modos).map(([k, m]) => [k, { comecaram: m.comecaram.size, concluiram: m.concluiram.size }])),
    eventos: [...todos].map(([nome, leads]) => ({ nome, leads })),
  };
}

module.exports = { ETAPAS, DO_CELULAR, init, track, resumo };
