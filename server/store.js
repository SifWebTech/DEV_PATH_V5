/*
 * Persistência em disco (tudo em data/):
 *   leads.csv     → cadastros, abre direto no Excel (separador ;, com BOM para acentos)
 *   eventos.jsonl → funil: uma linha JSON por evento, sem nome nem contato
 *   estado.json   → fila e apresentação atual, para sobreviver a uma queda do servidor
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { CSV_FILE, EVENTS_FILE, STATE_FILE, DATA_DIR, EVENTO_LEGADO } = require('./config');

const BOM = '﻿';
const CSV_HEADER = ['data_hora', 'nome', 'contato', 'tipo_contato', 'interesse', 'consentimento', 'id', 'evento'];
const ID_COL = CSV_HEADER.indexOf('id');

fs.mkdirSync(DATA_DIR, { recursive: true });

// Grava num arquivo temporário e troca de nome: um travamento no meio nunca deixa o arquivo pela metade.
function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text);
  try { fs.renameSync(tmp, file); } catch { fs.writeFileSync(file, text); fs.rmSync(tmp, { force: true }); }
}

/* ---------------- leads.csv ---------------- */

// Impede que o Excel interprete o valor como fórmula
function csvCell(v) {
  let s = String(v ?? '').replace(/[\r\n;]+/g, ' ').trim();
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  return s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const uncell = (s = '') => {
  let v = s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s;
  return v.replace(/^'/, '');
};

function readCsvLines() {
  return fs.readFileSync(CSV_FILE, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
}

function initCsv() {
  if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, BOM + CSV_HEADER.join(';') + '\n');
    return;
  }
  // Planilha da V4 (sem a coluna "evento"): guarda uma cópia e atualiza só o cabeçalho.
  const lines = readCsvLines();
  if (lines[0] === CSV_HEADER.join(';')) return;
  const backup = path.join(DATA_DIR, 'leads-backup-v4.csv');
  if (!fs.existsSync(backup)) fs.copyFileSync(CSV_FILE, backup);
  lines[0] = CSV_HEADER.join(';');
  writeAtomic(CSV_FILE, BOM + lines.join('\n'));
  console.log(`  Planilha de leads atualizada para a V5 (cópia da original em ${backup}).`);
}

function appendLead(lead, contactCell) {
  fs.appendFileSync(CSV_FILE, [
    lead.when, lead.name, contactCell, lead.contactType, lead.interest, 'sim', lead.id, lead.evento,
  ].map(csvCell).join(';') + '\n');
}

function readLeads() {
  return readCsvLines().slice(1).filter(Boolean).map((line) => {
    const [when, name, contact, contactType, interest, consent, id, evento] = line.split(';').map(uncell);
    return { when, name, contact, contactType, interest, consent, id, evento: evento || EVENTO_LEGADO };
  });
}

function csvText(rows) {
  const out = rows.map((l) => [l.when, l.name, l.contact, l.contactType, l.interest, l.consent, l.id, l.evento].map(csvCell).join(';'));
  return BOM + [CSV_HEADER.join(';'), ...out].join('\n') + '\n';
}

// Remove o lead da planilha (pedido de exclusão, LGPD). Retorna true se encontrou.
function deleteLead(id) {
  const lines = readCsvLines();
  const kept = lines.filter((line, k) => k === 0 || uncell(line.split(';')[ID_COL]) !== id);
  if (kept.length === lines.length) return false;
  writeAtomic(CSV_FILE, BOM + kept.join('\n'));
  return true;
}

/* ---------------- eventos.jsonl ---------------- */

function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return null;
  return fs.readFileSync(EVENTS_FILE, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; } // linha cortada por queda de energia
  });
}

function appendEvents(list) {
  if (list.length) fs.appendFileSync(EVENTS_FILE, list.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

/* ---------------- estado.json ---------------- */

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}

let saveTimer = null;
function saveState(getState) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { writeAtomic(STATE_FILE, JSON.stringify(getState())); } catch (err) { console.error('  Não foi possível salvar o estado:', err.message); }
  }, 150);
}

module.exports = { initCsv, appendLead, readLeads, csvText, deleteLead, readEvents, appendEvents, loadState, saveState };
