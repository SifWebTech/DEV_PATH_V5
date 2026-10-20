# 12. Auditoria antes da migração para a nuvem (multi-rede)

> Escrito **antes** das alterações, na branch `feat/cloud-multinetwork`, criada a partir do commit `4cbf80e` (V5 + narração).
> Pergunta que guia a auditoria: *o que impede o celular (4G/5G) e o notebook (Wi-Fi da Fatec) de conversarem só por um servidor na internet?*

## 12.1 O que existe hoje

| Item pedido no plano | Como está na V5 | Arquivo |
|---|---|---|
| Servidor | Node puro (`http`), **sem Express**, sem dependências | `server.js`, `server/http.js` |
| Socket.IO | **Não existe.** O tempo real é **SSE** (`EventSource` em `/api/stream`) + `POST` | `server/sessao.js`, `public/js/tv.js`, `mobile.js`, `admin.html` |
| Geração do QR | `mobileUrl()` = `PUBLIC_URL` **ou** `http://<IP da rede local>:<porta>/m` | `server/http.js:27` |
| IP local | `lanAddress()` com `os.networkInterfaces()`, prefere `192.168.*` | `server/util.js:29` |
| localhost | só nas mensagens do console e no `abrir-telas.ps1` (TV e painel locais) | `server.js:64`, `abrir-telas.ps1:16` |
| Leads | planilha `data/leads.csv` | `server/store.js`, `server/leads.js` |
| Sessões / fila | **uma** fila, **uma** TV, em memória + `data/estado.json` | `server/sessao.js` |
| Banco | **não há banco**: arquivos CSV/JSONL/JSON | `server/store.js` |
| Funil (interações) | `data/eventos.jsonl` | `server/funil.js` |
| Login do painel | cookie com token guardado **na memória** do servidor (reiniciou = sai) | `server/auth.js` |
| Mobile | `/m` → `m.html` | `server/http.js` |
| Presentation | `/` ou `/tv` → `index.html` | `server/http.js` |
| Admin | `/operador` → `admin.html` | `server/http.js` |
| START | `POST /api/start {id}` → `sessao.start()` → fila → SSE `start` para **todas** as TVs | `server/sessao.js` |

## 12.2 O que prende o celular à mesma rede

1. **O QR aponta para o IP local do notebook** (`http://192.168.x.x:8787/m`) quando `PUBLIC_URL` não está definido. Um celular no 4G não alcança esse endereço.
2. **O servidor roda no notebook.** Mesmo com o endereço certo, a rede da Fatec não deixa a internet entrar no notebook (NAT, firewall, isolamento de clientes).

Não é o SSE que prende: SSE é HTTP comum e passa por HTTPS, proxies e redes diferentes. Ele reconecta sozinho (o servidor já manda `retry: 2000` e um `ping` a cada 20 s). **Decisão (com o usuário): manter o SSE** em vez de trocar por Socket.IO. As salas `event:`, `display:` e `session:` do plano viram grupos de conexões SSE dentro do servidor, com o mesmo efeito.

## 12.3 O que mais muda para rodar na nuvem

| Ponto | Problema na nuvem | Mudança |
|---|---|---|
| Um telão só | a feira pode ter mais de uma TV | **EVENT / DISPLAY / SESSION**: fila e estado por telão; `presentation:start` só para o telão certo |
| QR com `/m` | o celular não sabe para qual telão vai | QR `PUBLIC_BASE_URL/join/<código opaco>`; o código resolve evento + telão; nada de dado pessoal na URL |
| Arquivos em `data/` | o disco de serviços em nuvem costuma ser apagado a cada deploy | **PostgreSQL** quando houver `DATABASE_URL`; sem ela, os arquivos de hoje (notebook offline e desenvolvimento) |
| Login na memória | cada deploy/reinício derruba o operador | cookie assinado com `SESSION_SECRET` (sobrevive a reinícios) |
| HTTP | dados pessoais trafegando | HTTPS do provedor (o Node fica atrás do proxy), cookies `Secure`, HSTS, cabeçalhos de segurança, limite de requisições |
| Telão caiu | ninguém sabia | estado do telão `OFFLINE / WAITING / READY / RUNNING / FINISHING`, último sinal (heartbeat) no painel; a TV mostra "reconectando…" e recupera o estado |
| Porta | a nuvem define a porta | `PORT` do provedor (já existia) |
| Endereços relativos | `/presentation/FATEC2026/TELAO-01` quebraria `css/…`, `js/…`, `audio/…` | o servidor resolve esses caminhos para `public/` |

## 12.4 Riscos

| Risco | Como evitar |
|---|---|
| Quebrar o estande offline (notebook + hotspot) | Sem `DATABASE_URL` e sem `NODE_ENV=production`, tudo continua como hoje (arquivos, QR com IP da rede local). |
| Ler o banco a cada pedido deixaria tudo assíncrono e reescreveria meio servidor | Os dados ficam na memória (como hoje) e cada gravação vai também para o banco, em ordem. Uma instância só, que é o caso do estande. |
| Duas pessoas no mesmo telão | A fila por telão já existe; passa a ser **por telão**. Quem aperta START com o telão ocupado vê "Há uma experiência em andamento. Você é o próximo." |
| Proxy da nuvem segurando o SSE | `Cache-Control: no-transform`, `X-Accel-Buffering: no`, ping a cada 20 s. |
| Segredo no front-end | `DATABASE_URL`, `SESSION_SECRET` e `ADMIN_KEY` só no servidor; o front recebe só URLs públicas. |
| QR antigo parar de funcionar | O código do `/join` é derivado do `SESSION_SECRET` (HMAC): o mesmo segredo dá sempre o mesmo código, então QRs impressos continuam valendo. `/m` redireciona para o telão padrão. |
| Sem PostgreSQL na máquina de desenvolvimento | Teste com um PostgreSQL embutido instalado só na pasta de testes, fora do projeto. |

## 12.5 O que NÃO muda

Narração, música, ducking, marcadores, cenas, visual, crachá, validação dos leads, regras de LGPD, métricas do funil e o protocolo SSE (`hello`, `start`, `scene`, `status`, `cmd`…). As mudanças no `tv.js` são só para dizer ao servidor **qual telão** ele é e mostrar o estado da conexão.
