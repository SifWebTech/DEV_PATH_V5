/*
 * DEV PATH V5 — servidor
 * ------------------------------------------------------------
 * Dois jeitos de rodar, mesmo código:
 *
 *   NO ESTANDE (notebook)   node server.js   (ou INICIAR.bat)
 *     dados em data/, QR com o IP da rede local, celular e notebook no mesmo Wi-Fi.
 *
 *   NA NUVEM (multi-rede)   NODE_ENV=production + PUBLIC_BASE_URL + SESSION_SECRET + ADMIN_KEY (+ DATABASE_URL)
 *     o celular (4G/5G) e o notebook da TV (Wi-Fi da Fatec) falam só com este servidor público, por HTTPS.
 *     Veja .env.example e docs/13-arquitetura-cloud-multirede.md.
 *
 * Fluxo (SSE = conexão aberta em que o servidor empurra avisos):
 *   TV (/presentation/EVENTO/TELÃO) ─SSE─┐                ┌─SSE─ celular (/join/<código>)
 *                                        └── server/ ─────┘
 *   1. celular envia o cadastro      POST /api/lead        (o código do QR diz o telão)
 *   2. celular toca em "Começar"     POST /api/start       → fila daquele telão
 *   3. servidor manda a TV começar   evento "start", só para as TVs daquele telão
 *   4. TV avisa cada cena            POST /api/tv/scene    → repassa ao celular
 *   5. TV termina                    POST /api/tv/done     → celular recebe o crachá; chama o próximo
 *   Cada passo também vira um evento do funil, visto no /operador.
 *
 * Módulos (pasta server/):
 *   config.js  opções        store.js  arquivos ou PostgreSQL   funil.js  métricas
 *   sessao.js  telões e filas leads.js  cadastro e LGPD         auth.js   login do operador
 *   http.js    rotas e segurança
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

// Em produção, falta de configuração impede de subir (melhor que publicar inseguro ou com QR errado)
function checkProduction() {
  if (!config.PRODUCTION) return;
  const erros = [];
  if (!/^https:\/\//.test(config.PUBLIC_BASE_URL)) erros.push('PUBLIC_BASE_URL precisa ser o endereço público com https:// (ex.: https://devpath.exemplo.com)');
  if (/\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(config.PUBLIC_BASE_URL)) erros.push('PUBLIC_BASE_URL não pode ser localhost nem IP de rede local');
  if (config.SESSION_SECRET.length < 32) erros.push('SESSION_SECRET precisa ter pelo menos 32 caracteres aleatórios');
  if (!config.ADMIN_KEY || config.ADMIN_KEY === 'fatec' || config.ADMIN_KEY.length < 10) erros.push('ADMIN_KEY precisa ser uma senha forte (10+ caracteres, não "fatec")');
  if (!config.DATABASE_URL) console.warn('  ⚠ Sem DATABASE_URL: os dados ficam em arquivos, e muitos provedores apagam o disco a cada deploy.');
  if (erros.length) {
    console.error('\n  Configuração de produção incompleta:\n' + erros.map((e) => '   - ' + e).join('\n') + '\n');
    process.exit(1);
  }
}

async function main() {
  checkProduction();
  const banco = await store.init();
  funil.init();
  sessao.restore();
  store.recordEvent(sessao.EVENT, sessao.evento());

  const server = http.createServer(routes.handle);
  server.keepAliveTimeout = 65_000; // maior que o do proxy da nuvem: evita conexões cortadas

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
    try { fs.writeFileSync(config.PORT_FILE, String(port)); } catch {} // lido pelo abrir-telas.ps1
    console.log('\n  DEV PATH V5 — Sistemas para Internet · Fatec Jales');
    console.log(`  Modo: ${config.PRODUCTION ? 'NUVEM (produção)' : 'estande / desenvolvimento'} · dados: ${banco} · evento ${sessao.EVENT}\n`);
    for (const d of sessao.displays.values()) {
      console.log(`  ${d.code}`);
      console.log(`    TV:      ${routes.presentationUrl(d)}`);
      console.log(`    QR Code: ${routes.mobileUrl(d)}`);
    }
    const base = config.PUBLIC_BASE_URL || `http://localhost:${port}`;
    console.log(`\n  Operador + métricas:  ${base}/operador${config.PRODUCTION ? '' : `   (senha: ${config.ADMIN_KEY})`}`);
    console.log(`  Nome do evento:       ${sessao.evento()}   (troque no painel)`);
    if (!config.PUBLIC_BASE_URL && lanAddress() === 'localhost') console.log('\n  ⚠ Nenhuma rede Wi-Fi encontrada. Conecte o notebook a uma rede ou ative o hotspot.');
    console.log('');
  });

  // A nuvem desliga o processo com SIGTERM a cada deploy: termina as gravações pendentes antes de sair
  const stop = async (sig) => {
    console.log(`\n  ${sig}: salvando e encerrando...`);
    server.close();
    sessao.persist();
    await new Promise((r) => setTimeout(r, 250));
    await store.flush();
    process.exit(0);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

main().catch((err) => {
  console.error('\n  Não foi possível iniciar o DEV PATH:', err.message, '\n');
  process.exit(1);
});
