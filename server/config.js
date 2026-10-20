/*
 * Configuração do servidor. Tudo vem de variáveis de ambiente (ou do arquivo .env na raiz;
 * veja .env.example). Sem nenhuma delas, o DEV PATH roda como sempre no notebook do estande.
 *
 *   NODE_ENV=production      → modo nuvem: exige PUBLIC_BASE_URL, SESSION_SECRET e ADMIN_KEY
 *   PORT=3100                → porta (a nuvem define; sem PORT: 8787 ou a próxima livre)
 *   PUBLIC_BASE_URL=https:// → endereço público: base do QR Code (/join/…). Nunca um IP local em produção.
 *                              No Render, se ficar vazia, vale o endereço que o Render informa (RENDER_EXTERNAL_URL)
 *   EVENT_CODE=FATEC2026     → código do evento (vai no endereço da TV)
 *   DISPLAYS=TELAO-01,TELAO-02 → telões do evento (cada um tem fila própria e QR próprio)
 *   DATABASE_URL=postgresql://… → grava no PostgreSQL; sem ela, nos arquivos de data/
 *   SESSION_SECRET=…         → assina o login do painel e gera os códigos do QR
 *   ADMIN_KEY=senha          → senha do painel do operador (padrão local: fatec)
 *   EVENTO="Feira X"         → nome do evento nas métricas (também dá para trocar no painel)
 *   DATA_DIR=pasta           → onde ficam os arquivos locais (padrão: ./data)
 *   TRUST_PROXY=1            → atrás do proxy HTTPS da nuvem (lê X-Forwarded-For/Proto); ligado em produção
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

// .env na raiz (desenvolvimento). Na nuvem as variáveis vêm do painel do provedor.
const ENV_FILE = path.join(ROOT, '.env');
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const env = process.env;
const PRODUCTION = env.NODE_ENV === 'production';
const DATA_DIR = env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Segredo: o da variável; sem ela (só fora de produção), um gerado e guardado em data/.segredo
function secret() {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (PRODUCTION) return '';
  const file = path.join(DATA_DIR, '.segredo');
  try { return fs.readFileSync(file, 'utf8').trim(); } catch {}
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, s);
  return s;
}

const code = (s, fallback) => (String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32) || fallback);
const DISPLAYS = (env.DISPLAYS || 'TELAO-01').split(',').map((d) => code(d)).filter(Boolean);

module.exports = {
  ROOT,
  DATA_DIR,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  CSV_FILE: path.join(DATA_DIR, 'leads.csv'),
  EVENTS_FILE: path.join(DATA_DIR, 'eventos.jsonl'),
  STATE_FILE: path.join(DATA_DIR, 'estado.json'),
  PORT_FILE: path.join(DATA_DIR, '.porta'),

  PRODUCTION,
  // 8787 e não 3000: a porta 3000 costuma estar ocupada (ex.: AdGuard Home, React).
  PORT: Number(env.PORT) || 8787,
  FIXED_PORT: !!env.PORT,
  // PUBLIC_URL era o nome na V5 (apontava direto para /m); continua aceito
  PUBLIC_BASE_URL: (env.PUBLIC_BASE_URL || env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || '').replace(/\/m\/?$/, '').replace(/\/+$/, ''),
  EVENT_CODE: code(env.EVENT_CODE, 'FATEC2026'),
  DISPLAYS: DISPLAYS.length ? DISPLAYS : ['TELAO-01'],
  DATABASE_URL: env.DATABASE_URL || '',
  SESSION_SECRET: secret(),
  ADMIN_KEY: env.ADMIN_KEY || (PRODUCTION ? '' : 'fatec'),
  TRUST_PROXY: env.TRUST_PROXY ? env.TRUST_PROXY === '1' : PRODUCTION,
  EVENTO: (env.EVENTO || '').trim(),

  // Leads cadastrados antes da V5 não tinham evento: aparecem com este nome.
  EVENTO_LEGADO: 'Antes da V5',

  // Mesmo link de public/js/content.js; o servidor usa para o redirecionamento com UTM.
  VESTIBULAR_URL: 'https://www.vestibularfatec.com.br/',

  INTERESTS: ['design', 'logic', 'apps', 'business'],
  REACTIONS: ['fire', 'heart', 'mind', 'rocket'],
};
