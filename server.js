/*
 * DEV PATH V5 — servidor local do estande
 * ------------------------------------------------------------
 * Liga o celular do visitante à TV pela rede Wi-Fi do notebook.
 * Usa apenas módulos nativos do Node (não precisa de npm install).
 *
 *   node server.js            → inicia em http://<ip-do-notebook>:8787 (ou a próxima porta livre)
 *   set ADMIN_KEY=minhasenha  → muda a senha do painel do operador (padrão: fatec)
 *   set EVENTO=Feira X        → nome do evento (também dá para trocar no painel)
 *   Outras opções em server/config.js.
 *
 * Fluxo:
 *   TV (index.html) ─SSE─┐                ┌─SSE─ celular (m.html)
 *                        └── server/ ─────┘
 *   1. celular envia o cadastro      POST /api/lead
 *   2. celular toca em "Começar"     POST /api/start  → entra na fila
 *   3. servidor manda a TV começar   evento "start"
 *   4. TV avisa cada cena            POST /api/tv/scene → repassa ao celular
 *   5. TV termina                    POST /api/tv/done  → celular recebe o crachá
 *   Cada passo também vira um evento do funil (data/eventos.jsonl), visto no /operador.
 *
 * Módulos (pasta server/):
 *   config.js  opções        store.js  arquivos em data/   funil.js  métricas
 *   sessao.js  fila e TV     leads.js  cadastro e LGPD     auth.js   login do operador
 *   http.js    rotas
 */
'use strict';

const http = require('http');
const fs = require('fs');
const config = require('./server/config');
const store = require('./server/store');
const funil = require('./server/funil');
const sessao = require('./server/sessao');
const routes = require('./server/http');
const { lanAddress } = require('./server/util');

store.initCsv();
funil.init();
sessao.restore();

const server = http.createServer(routes.handle);

// "::" escuta IPv4 e IPv6 juntos, então qualquer programa já usando a porta é detectado
let port = config.PORT;
let tries = 0;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && !config.FIXED_PORT && tries < 20) {
    console.log(`  Porta ${port} ocupada por outro programa, tentando ${port + 1}...`);
    tries += 1;
    port += 1;
    server.listen(port, '::');
  } else {
    console.error(`\n  Não foi possível abrir a porta ${port} (${err.code}). Feche o programa que a usa ou escolha outra: set PORT=9000\n`);
    process.exit(1);
  }
});
server.listen(port, '::');

server.on('listening', () => {
  routes.setPort(port);
  fs.writeFileSync(config.PORT_FILE, String(port)); // lido pelo abrir-telas.ps1
  console.log('\n  DEV PATH V5 — Sistemas para Internet · Fatec Jales\n');
  console.log(`  TV (abra no notebook):   http://localhost:${port}`);
  console.log(`  Celular (QR Code):       ${routes.mobileUrl()}`);
  console.log(`  Operador + métricas:     http://localhost:${port}/operador   (senha: ${config.ADMIN_KEY})`);
  console.log(`  Evento:                  ${sessao.evento()}   (troque no painel)`);
  console.log(`  Arquivo de leads:        ${config.CSV_FILE}\n`);
  if (lanAddress() === 'localhost') console.log('  ⚠ Nenhuma rede Wi-Fi encontrada. Conecte o notebook a uma rede ou ative o hotspot.\n');
});
