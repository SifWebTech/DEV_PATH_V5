/*
 * Leva os dados do estande (arquivos de data/) para o PostgreSQL da nuvem.
 *
 *   DATABASE_URL=postgresql://… npm run importar          (lê ./data)
 *   DATABASE_URL=… DATA_DIR=C:\backup\data npm run importar
 *
 * Pode rodar mais de uma vez: leads repetidos são ignorados (mesmo id), e o funil só é
 * importado se a tabela interactions ainda estiver vazia (para não contar em dobro).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Defina DATABASE_URL (o banco de destino) antes de importar.');
  process.exit(1);
}

async function main() {
  // 1. lê os arquivos (modo arquivos do store, sem banco)
  delete process.env.DATABASE_URL;
  const config = require('./config');
  config.DATABASE_URL = '';
  const store = require('./store');
  await store.init();
  const leads = store.readLeads();
  const events = store.readEvents() || [];
  console.log(`Arquivos em ${config.DATA_DIR}: ${leads.length} leads, ${events.length} eventos do funil.`);

  // 2. grava no banco (abre o store de novo, agora no modo PostgreSQL: aplica as migrations)
  const { Pool } = require('pg');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);
  const pool = new Pool({ connectionString: dbUrl, ssl: local || /sslmode=/.test(dbUrl) ? undefined : { rejectUnauthorized: false } });
  const db = { query: (t, v) => pool.query(t, v) };
  const migrations = path.join(__dirname, 'migrations');
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const file of fs.readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) {
    const done = await db.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (done.rowCount) continue;
    await db.query(fs.readFileSync(path.join(migrations, file), 'utf8'));
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
  }

  let novos = 0;
  for (const l of leads) {
    const r = await db.query(
      `INSERT INTO leads (id, registered_at, name, contact, contact_type, interest, consent, evento, event_code, display_code)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [l.id, l.when, l.name, l.contact, l.contactType, l.interest, l.evento, config.EVENT_CODE, config.DISPLAYS[0]]);
    novos += r.rowCount;
  }
  const vazio = (await db.query('SELECT count(*)::int AS n FROM interactions')).rows[0].n === 0;
  if (vazio) {
    for (const { quando, tipo, evento, ...dados } of events) {
      await db.query('INSERT INTO interactions (quando, tipo, evento, dados) VALUES ($1, $2, $3, $4)', [quando, tipo, evento, dados]);
    }
  }
  console.log(`Banco: ${novos} leads novos (${leads.length - novos} já existiam); funil ${vazio ? `importado (${events.length})` : 'mantido (já havia dados)'}.`);
  await pool.end();
}

main().catch((err) => { console.error('Falhou:', err.message); process.exit(1); });
