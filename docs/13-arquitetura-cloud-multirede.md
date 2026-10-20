# 13. Arquitetura na nuvem (multi-rede)

> Celular no 4G/5G, notebook da TV no Wi-Fi da Fatec, servidor em um data center: os três só conversam pela internet, por HTTPS.
> O mesmo código continua rodando no notebook do estande (offline, com hotspot), sem configurar nada.

```
CELULAR (4G/5G)                                   NOTEBOOK DA FATEC (Wi-Fi) ──HDMI──▶ TV
https://…/join/kNQSOidD                           https://…/presentation/FATEC2026/TELAO-01
     │  HTTPS (POST) + SSE                                 │  HTTPS (POST) + SSE
     └──────────────────────┐          ┌───────────────────┘
                            ▼          ▼
                 ┌──────────────────────────────────┐
                 │  DEV PATH CLOUD (Node.js)         │
                 │  server.js + server/              │
                 │  páginas, áudio, API, SSE         │
                 │  telões · filas · sessões         │
                 └───────────────┬──────────────────┘
                                 ▼
                       PostgreSQL gerenciado
            events · displays · leads · sessions · interactions · app_state
```

Não existe mais, em produção: IP `192.168.x.x` no QR, `localhost` no QR, exigência de mesma rede, celular acessando porta do notebook.

## 13.1 Decisões

| Plano | Feito | Por quê |
|---|---|---|
| Express + Socket.IO | **Node `http` + SSE** (decisão com o usuário) | O SSE já existia e já passa por HTTPS e qualquer rede; reconecta sozinho. As "salas" são grupos de conexões por telão. Nenhuma reescrita da TV, do celular e do painel. |
| PostgreSQL | **PostgreSQL com `DATABASE_URL`; sem ela, arquivos** | O estande offline continua funcionando; a nuvem grava no banco. |
| `display:join` | TV abre `/api/stream?role=tv&display=TELAO-01&event=FATEC2026` | Mesmo efeito: o servidor registra a TV no telão. |
| `presentation:start` | evento SSE `start` só para as TVs do telão | Payload: `id`, `sessionId`, `name`, `interest` (sem contato). |

## 13.2 Evento, telão e sessão

| Identificador | Exemplo | Onde aparece |
|---|---|---|
| Evento | `FATEC2026` (`EVENT_CODE`) | endereço da TV, tabela `events` |
| Telão | `TELAO-01` (`DISPLAYS`) | endereço da TV, fila própria, tabela `displays` |
| Código do QR | `kNQSOidD` | `/join/<código>`; **opaco**: HMAC do `SESSION_SECRET`, não revela evento nem telão e não muda entre reinícios |
| Sessão | UUID aleatório | cada "Começar"; tabela `sessions` (`queued → running → completed / interrupted / canceled`) |
| Lead | UUID aleatório | cadastro; nome e contato **nunca** vão em URL |

Estados do telão: **OFFLINE** (nenhuma TV conectada) · **WAITING** (QR na tela) · **READY** (alguém na fila, TV livre) · **RUNNING** · **FINISHING** (cena final).

**Duas pessoas no mesmo telão:** quem aperta START com o telão em RUNNING entra na fila daquele telão e vê no celular "Há uma experiência em andamento na TV. Você é o próximo." Quando a TV avisa o fim (`/api/tv/done`), o próximo entra sozinho. Telões diferentes têm filas independentes.

## 13.3 Rotas

| Rota | Quem usa |
|---|---|
| `GET /presentation/<EVENTO>/<TELÃO>` | TV (`/` e `/tv` redirecionam para o telão padrão) |
| `GET /join/<código>` | celular (`/m`, dos QRs antigos, redireciona para o telão padrão) |
| `GET /operador` | painel |
| `GET /api/join/<código>` | resolve o código → `{ display, evento }` |
| `GET /api/displays/<TELÃO>/state` | estado público do telão (status, primeiro nome, cena, fila) |
| `POST /api/lead` (`joinCode` no corpo) | cadastro, ligado ao telão do QR |
| `POST /api/start` ou `POST /api/sessions/<id>/start` | START |
| `POST /api/tv/scene · done · audio · heartbeat` (`display` no corpo) | TV |
| `GET /api/stream?role=tv&display=…` · `role=phone&id=…` · `role=op` | SSE |
| `GET /api/op/state?display=…` · `POST /api/op/cmd {cmd, display}` | painel |
| `GET /healthz` | provedor de nuvem (saúde: banco e telões) |

Eventos SSE: `hello` (estado do telão, QR, evento) · `start` · `queue` · `lead` · `react` · `cmd` · `evento` · `erro` (TV) · `status` · `scene` (celular) · `funil` · `auth` (painel).

## 13.4 Reconexão

- O navegador reconecta o SSE sozinho (`retry: 2000`); o servidor manda `ping` a cada 20 s.
- A TV mostra **● CONECTADO / EXPERIÊNCIA CONECTADA** ou **● RECONECTANDO…**; a apresentação em andamento **não para** se a internet piscar.
- Ao reconectar, o servidor manda `hello` com o estado do telão e, se havia alguém, `start` de novo (a TV reconhece o mesmo visitante e continua).
- A TV manda um sinal de vida a cada 20 s (`heartbeat`): o painel mostra "último sinal" de cada telão.
- Se o **servidor** reiniciar (deploy), filas, telões e o login do painel voltam (`app_state` + cookie assinado). Testado: servidor derrubado no meio de uma apresentação, TV em "reconectando…", servidor de volta, sessão recuperada e celular "ao vivo" de novo.

## 13.5 Segurança

- HTTPS e WSS/SSE seguro vêm do provedor (proxy na frente do Node). Com `NODE_ENV=production`: `TRUST_PROXY` ligado, cookies `Secure`, HSTS.
- Cabeçalhos: Content-Security-Policy (só o próprio site), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`.
- Limite por aparelho/minuto: 8 cadastros, 20 STARTs, 600 pedidos à API; senha do painel: 5 erros = 1 minuto bloqueado.
- Validação no servidor de tudo que chega (nome, contato, interesse, consentimento, código do QR, telão, comandos).
- `DATABASE_URL`, `SESSION_SECRET` e `ADMIN_KEY` ficam só no servidor (`.env` no `.gitignore`); o front recebe só URLs públicas.
- **Em produção o servidor se recusa a subir** sem `PUBLIC_BASE_URL` https, com `localhost`/IP de rede local, sem `SESSION_SECRET` forte ou com a senha `fatec`.

## 13.6 Banco

`server/migrations/001_cloud.sql` (só `CREATE … IF NOT EXISTS`; aplicada uma vez, registrada em `schema_migrations`):

| Tabela | Conteúdo |
|---|---|
| `events` | código e nome do evento |
| `displays` | telão, código do QR, status, último sinal |
| `leads` | cadastro (excluído de verdade a pedido: LGPD) |
| `sessions` | cada START e como terminou (sem FK para leads: a sessão fica anônima se o lead for excluído) |
| `interactions` | funil e reações (só ids aleatórios) |
| `app_state` | filas e telões, para voltar depois de um reinício |

Os dados também ficam na memória do servidor (leituras instantâneas); cada gravação vai para o banco em ordem. Isso supõe **uma instância** do servidor, que é o caso do estande.
Levar os dados de um estande offline para o banco: `DATABASE_URL=… npm run importar` (pode repetir: não duplica).

## 13.7 Variáveis de ambiente

Veja `.env.example`. Obrigatórias em produção: `NODE_ENV=production`, `PUBLIC_BASE_URL`, `SESSION_SECRET`, `ADMIN_KEY`; recomendada: `DATABASE_URL`. Opcionais: `EVENT_CODE`, `DISPLAYS`, `EVENTO`, `PORT`, `TRUST_PROXY`, `DATA_DIR`.

## 13.8 Passos para publicar (quando for a hora)

Provedor escolhido: **Render + Neon**, grátis. Passo a passo detalhado em [14-deploy-render.md](14-deploy-render.md); o resumo genérico abaixo vale para qualquer provedor.

1. Criar um PostgreSQL gerenciado (qualquer provedor) e copiar a *connection string*.
2. Criar um serviço web Node.js apontando para este repositório: *build* `npm install`, *start* `npm start`, *health check* `/healthz`. Node 20.12 ou mais novo.
3. Cadastrar as variáveis do `.env.example` no painel do provedor. Primeiro deploy: `PUBLIC_BASE_URL` = o endereço que o provedor der (ex.: `https://dev-path-fatec-xxxx.provedor.app`).
4. Abrir `<PUBLIC_BASE_URL>/healthz` → `{"ok":true,"banco":"postgres"}`.
5. No notebook da TV: editar o endereço em `INICIAR-NUVEM.bat` e dar dois cliques (abre a TV em tela cheia no HDMI, já com som liberado, e o painel).
6. Testar com o celular **só no 4G/5G** (Wi-Fi desligado): QR → cadastro → START → nome na TV → fim → QR de volta.
7. Domínio próprio (opcional): apontar `devpath.seudominio.com` no provedor e trocar `PUBLIC_BASE_URL` (o código do QR não muda; o endereço do QR muda).

## 13.9 Rodando sem nuvem (estande offline)

Nada muda: `INICIAR.bat`, dados em `data/`, QR com o IP do notebook. O telão padrão é `TELAO-01`.
