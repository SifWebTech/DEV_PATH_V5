/*
 * Persistência. Dois destinos, mesma interface:
 *
 *   ARQUIVOS (padrão: estande offline e desenvolvimento), em data/:
 *     leads.csv     → cadastros, abre direto no Excel (separador ;, com BOM para acentos)
 *     eventos.jsonl → funil: uma linha JSON por evento, sem nome nem contato
 *     estado.json   → filas e telões, para sobreviver a uma queda do servidor
 *
 *   POSTGRESQL (nuvem, quando existe DATABASE_URL): tabelas events, displays, leads, sessions,
 *   interactions e app_state (server/migrations/). As tabelas sessions e displays existem só no banco:
 *   servem aos relatórios (quantas apresentações por telão, último sinal de cada TV).
 *
 * Os dados ficam também na memória: as leituras são instantâneas e o resto do servidor continua
 * síncrono como na V5. Cada gravação vai para o destino em ordem (uma fila de promessas).
 * Isso supõe UMA instância do servidor, que é o caso do DEV PATH.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { CSV_FILE, EVENTS_FILE, STATE_FILE, DATA_DIR, EVENTO_LEGADO } = config;

const BOM = '﻿';
const CSV_HEADER = ['data_hora', 'nome', 'contato', 'tipo_contato', 'interesse', 'consentimento', 'id', 'evento'];

const mem = { leads: [], events: null, state: null };
let backend = 'arquivos';
let pool = null;
let chain = Promise.resolve();

// Grava num arquivo temporário e troca de nome: um travamento no meio nunca deixa o arquivo pela metade.
function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text);
  try { fs.renameSync(tmp, file); } catch { fs.writeFileSync(file, text); fs.rmSync(tmp, { force: true }); }
}

// Fila de gravações no banco: em ordem, e um erro não derruba o servidor (fica no log)
function queue(label, fn) {
  if (backend !== 'postgres') return;
  chain = chain.then(fn).catch((err) => console.error(`  ⚠ banco (${label}): ${err.message}`));
}
const sql = (text, values) => pool.query(text, values);

/* ---------------- CSV ---------------- */

// Impede que o Excel interprete o valor como fórmula
function csvCell(v) {
  let s = String(v ?? '').replace(/[\r\n;]+/g, ' ').trim();
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  return s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const uncell = (s = '') => {
  const v = s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s;
  return v.replace(/^'/, '');
};
const csvRow = (l) => [l.when, l.name, l.contact, l.contactType, l.interest, l.consent, l.id, l.evento].map(csvCell).join(';');

function csvText(rows) {
  return BOM + [CSV_HEADER.join(';'), ...rows.map(csvRow)].join('\n') + '\n';
}

function loadCsv() {
  if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, BOM + CSV_HEADER.join(';') + '\n');
    return [];
  }
  const lines = fs.readFileSync(CSV_FILE, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  // Planilha da V4 (sem a coluna "evento"): guarda uma cópia e atualiza só o cabeçalho.
  if (lines[0] !== CSV_HEADER.join(';')) {
    const backup = path.join(DATA_DIR, 'leads-backup-v4.csv');
    if (!fs.existsSync(backup)) fs.copyFileSync(CSV_FILE, backup);
    lines[0] = CSV_HEADER.join(';');
    writeAtomic(CSV_FILE, BOM + lines.join('\n'));
    console.log(`  Planilha de leads atualizada para a V5 (cópia da original em ${backup}).`);
  }
  return lines.slice(1).filter(Boolean).map((line) => {
    const [when, name, contact, contactType, interest, consent, id, evento] = line.split(';').map(uncell);
    return { when, name, contact, contactType, interest, consent, id, evento: evento || EVENTO_LEGADO };
  });
}

/* ---------------- PostgreSQL ---------------- */

async function openPostgres() {
  let Pool;
  try { ({ Pool } = require('pg')); } catch {
    throw new Error('DATABASE_URL definida, mas o pacote "pg" não está instalado. Rode: npm install');
  }
  const url = config.DATABASE_URL;
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  // provedores gerenciados exigem SSL; sslmode na própria URL tem prioridade
  const ssl = local || /sslmode=/.test(url) ? undefined : { rejectUnauthorized: false };
  pool = new Pool({ connectionString: url, ssl, max: 5 });
  await migrate();
  backend = 'postgres';

  const leads = await sql(`SELECT id, registered_at, name, contact, contact_type, interest, consent, evento, event_code, display_code
                             FROM leads ORDER BY registered_at, id`);
  mem.leads = leads.rows.map((r) => ({
    when: r.registered_at, name: r.name, contact: r.contact, contactType: r.contact_type, interest: r.interest,
    consent: r.consent ? 'sim' : 'não', id: r.id, evento: r.evento, eventCode: r.event_code, display: r.display_code,
  }));
  const ev = await sql('SELECT quando, tipo, evento, dados FROM interactions ORDER BY id');
  mem.events = ev.rows.map((r) => ({ quando: r.quando, tipo: r.tipo, evento: r.evento, ...r.dados }));
  const st = await sql("SELECT value FROM app_state WHERE key = 'sessao'");
  mem.state = st.rows[0]?.value || null;
}

// Aplica, em ordem, os arquivos de server/migrations/ que ainda não rodaram (nunca apaga tabelas)
async function migrate() {
  await sql('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await sql('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const dir = path.join(__dirname, 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  Banco: migration ${file} aplicada.`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

/* ---------------- interface ---------------- */

async function init() {
  if (config.DATABASE_URL) await openPostgres();
  else {
    mem.leads = loadCsv();
    mem.events = fs.existsSync(EVENTS_FILE)
      ? fs.readFileSync(EVENTS_FILE, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
        try { return [JSON.parse(line)]; } catch { return []; } // linha cortada por queda de energia
      })
      : null;
    try { mem.state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { mem.state = null; }
  }
  return backend;
}

const readLeads = () => mem.leads.slice();

// contactCell: na planilha, Instagram e WhatsApp viram links (instagram.com/…, wa.me/…)
function appendLead(lead, contactCell) {
  const row = {
    when: lead.when, name: lead.name, contact: contactCell, contactType: lead.contactType, interest: lead.interest,
    consent: 'sim', id: lead.id, evento: lead.evento, eventCode: lead.eventCode, display: lead.display,
  };
  mem.leads.push(row);
  if (backend === 'arquivos') fs.appendFileSync(CSV_FILE, csvRow(row) + '\n');
  queue('lead', () => sql(
    `INSERT INTO leads (id, registered_at, name, contact, contact_type, interest, consent, evento, event_code, display_code)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
    [row.id, row.when, row.name, row.contact, row.contactType, row.interest, row.evento, row.eventCode || null, row.display || null],
  ));
}

// Remove o lead (pedido de exclusão, LGPD). Retorna true se encontrou.
function deleteLead(id) {
  const k = mem.leads.findIndex((l) => l.id === id);
  if (k < 0) return false;
  mem.leads.splice(k, 1);
  if (backend === 'arquivos') writeAtomic(CSV_FILE, csvText(mem.leads));
  queue('excluir lead', () => sql('DELETE FROM leads WHERE id = $1', [id]));
  return true;
}

const readEvents = () => mem.events;

function appendEvents(list) {
  if (!list.length) return;
  mem.events = (mem.events || []).concat(list);
  if (backend === 'arquivos') fs.appendFileSync(EVENTS_FILE, list.map((e) => JSON.stringify(e)).join('\n') + '\n');
  for (const { quando, tipo, evento, ...dados } of list) {
    queue('interação', () => sql('INSERT INTO interactions (quando, tipo, evento, dados) VALUES ($1, $2, $3, $4)', [quando, tipo, evento, dados]));
  }
}

const loadState = () => mem.state;

let saveTimer = null;
function saveState(getState) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    mem.state = getState();
    if (backend === 'arquivos') {
      try { writeAtomic(STATE_FILE, JSON.stringify(mem.state)); } catch (err) { console.error('  Não foi possível salvar o estado:', err.message); }
    }
    const value = mem.state;
    queue('estado', () => sql(
      `INSERT INTO app_state (key, value, updated_at) VALUES ('sessao', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [value]));
  }, 150);
}

/* ---------------- só no banco: relatórios ---------------- */

function recordEvent(code, name) {
  queue('evento', () => sql(
    'INSERT INTO events (code, name) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name', [code, name]));
}

function recordDisplay(d) {
  queue('telão', () => sql(
    `INSERT INTO displays (event_code, display_code, display_name, join_code, status, last_seen_at)
     VALUES ($1, $2, $2, $3, $4, $5)
     ON CONFLICT (event_code, display_code) DO UPDATE
       SET join_code = EXCLUDED.join_code, status = EXCLUDED.status, last_seen_at = COALESCE(EXCLUDED.last_seen_at, displays.last_seen_at)`,
    [d.eventCode, d.code, d.joinCode, d.status, d.lastSeen ? new Date(d.lastSeen) : null]));
}

// status: queued → running → completed | interrupted | canceled
function recordSession(s) {
  queue('sessão', () => sql(
    `INSERT INTO sessions (id, lead_id, event_code, display_code, status, started_at, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status,
       started_at = COALESCE(EXCLUDED.started_at, sessions.started_at),
       finished_at = COALESCE(EXCLUDED.finished_at, sessions.finished_at)`,
    [s.id, s.leadId, s.eventCode, s.display, s.status,
      s.status === 'running' ? new Date() : null,
      ['completed', 'interrupted', 'canceled'].includes(s.status) ? new Date() : null]));
}

// Antes de desligar: espera as gravações pendentes
async function flush() {
  clearTimeout(saveTimer);
  await chain;
  if (pool) await pool.end().catch(() => {});
}

const health = async () => {
  if (backend !== 'postgres') return { banco: 'arquivos', ok: true };
  try { await sql('SELECT 1'); return { banco: 'postgres', ok: true }; } catch { return { banco: 'postgres', ok: false }; }
};

module.exports = {
  init, readLeads, appendLead, deleteLead, csvText, readEvents, appendEvents, loadState, saveState,
  recordEvent, recordDisplay, recordSession, flush, health,
  get backend() { return backend; },
};
