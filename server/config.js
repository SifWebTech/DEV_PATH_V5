/*
 * Configuração do servidor. Tudo pode ser trocado por variável de ambiente:
 *   PORT=8080          → porta fixa (sem PORT, usa 8787 ou a próxima livre)
 *   ADMIN_KEY=senha    → senha do painel do operador (padrão: fatec)
 *   PUBLIC_URL=http:// → endereço usado no QR Code
 *   EVENTO="Feira X"   → nome do evento (também dá para trocar no painel)
 *   DATA_DIR=pasta     → onde ficam leads, eventos e estado (padrão: ./data)
 */
'use strict';

const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');

module.exports = {
  ROOT,
  DATA_DIR,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  CSV_FILE: path.join(DATA_DIR, 'leads.csv'),
  EVENTS_FILE: path.join(DATA_DIR, 'eventos.jsonl'),
  STATE_FILE: path.join(DATA_DIR, 'estado.json'),
  PORT_FILE: path.join(DATA_DIR, '.porta'),

  // 8787 e não 3000: a porta 3000 costuma estar ocupada (ex.: AdGuard Home, React).
  PORT: Number(process.env.PORT) || 8787,
  FIXED_PORT: !!process.env.PORT,
  ADMIN_KEY: process.env.ADMIN_KEY || 'fatec',
  PUBLIC_URL: process.env.PUBLIC_URL || '',
  EVENTO: (process.env.EVENTO || '').trim(),

  // Leads cadastrados antes da V5 não tinham evento: aparecem com este nome.
  EVENTO_LEGADO: 'Antes da V5',

  // Mesmo link de public/js/content.js; o servidor usa para o redirecionamento com UTM.
  VESTIBULAR_URL: 'https://www.vestibularfatec.com.br/',

  INTERESTS: ['design', 'logic', 'apps', 'business'],
  REACTIONS: ['fire', 'heart', 'mind', 'rocket'],
};
