# 14. Publicar no Render + Neon (grátis)

> Servidor no **Render** (Web Service Free), banco no **Neon** (PostgreSQL Free). Sem cartão de crédito.
> O projeto já está pronto: `render.yaml` (Blueprint), `.node-version` (Node 24) e `/healthz`.
> Tempo total: uns 20 minutos.

```
GitHub (SifWebTech/DEV_PATH_V5) ──deploy automático──▶ Render (devpath.onrender.com) ──DATABASE_URL──▶ Neon
```

## 1. Código no GitHub

O Render publica a partir do GitHub, branch `main` (a migração para a nuvem já está nela). Basta a `main` estar enviada:

```powershell
git push
```

## 2. Banco no Neon

1. Entre em **neon.com** → *Sign up* (dá para usar a conta do GitHub).
2. *Create project*: nome `devpath`, **Postgres 17**, região **AWS US East (N. Virginia)**. Ela fica perto do servidor do Render (região `virginia`); como o servidor guarda tudo também na memória, a distância até o Brasil não atrasa a TV.
3. Na tela do projeto: **Connect** → copie **duas** *connection strings*:
   - com **Connection pooling ligado** (o endereço tem `-pooler`): vai em `DATABASE_URL`, usada no dia a dia;
   - com **Connection pooling desligado** (conexão direta): vai em `DATABASE_URL_UNPOOLED`, usada só para criar as tabelas.

   Pelo terminal, `neon env pull` grava as duas no `.env.local` (fora do Git). O servidor lê esse arquivo sozinho.

Não crie tabelas: o servidor cria sozinho no primeiro início (migration `001_cloud.sql`).

## 3. Servidor no Render

1. Entre em **render.com** → *Get started* com a conta do GitHub, e autorize o acesso ao repositório `DEV_PATH_V5`.
2. *New* → **Blueprint** → escolha o repositório. O Render lê o `render.yaml` e mostra o serviço `devpath` (plano Free).
3. Ele pede as três variáveis marcadas como secretas:
   - `ADMIN_KEY`: a senha do painel `/operador` (10+ caracteres; `fatec` é recusada em produção);
   - `DATABASE_URL`: a connection string do Neon **com pooler**;
   - `DATABASE_URL_UNPOOLED`: a connection string do Neon **direta** (sem `-pooler`).
4. *Apply*. O Render roda `npm ci && npm run build` (confere a sintaxe dos arquivos do servidor) e `npm start`.

O resto já vem do `render.yaml`:

| Variável | Valor | Por quê |
|---|---|---|
| `NODE_ENV` | `production` | modo nuvem (exige HTTPS, senha forte, segredo) |
| `TZ` | `America/Sao_Paulo` | o Render roda em UTC; sem isto, os horários dos cadastros saem 3 h adiantados |
| `EVENT_CODE` | `FATEC2026` | código do evento no endereço da TV |
| `DISPLAYS` | `TELAO-01` | telões (para dois: `TELAO-01,TELAO-02`) |
| `SESSION_SECRET` | gerado pelo Render | assina o login e gera o código do QR. **Não troque depois**: os QR Codes mudariam |
| `PUBLIC_BASE_URL` | (vazia) | o servidor usa o endereço que o Render informa, ex.: `https://devpath-xxxx.onrender.com` |

## 4. Conferir

1. No Render, *Logs* deve mostrar:
   ```
   Banco: migration 001_cloud.sql aplicada.
   Modo: NUVEM (produção) · dados: postgres · evento FATEC2026
   TELAO-01
     TV:      https://devpath-xxxx.onrender.com/presentation/FATEC2026/TELAO-01
     QR Code: https://devpath-xxxx.onrender.com/join/<código>
   ```
2. Abra `https://devpath-xxxx.onrender.com/healthz` → `{"ok":true,"banco":"postgres",…}`.
3. Abra `/operador` e entre com a `ADMIN_KEY`.

## 5. No notebook da TV

1. Edite `INICIAR-NUVEM.bat` (botão direito → Editar) e troque o endereço pelo da linha "TV:" do log.
2. HDMI ligado, Windows + P → Estender, dois cliques no `INICIAR-NUVEM.bat`: a TV abre em tela cheia no Edge, com som liberado, e o painel no notebook.

## 6. Teste obrigatório: redes diferentes

| Aparelho | Rede |
|---|---|
| notebook + TV | Wi-Fi da Fatec |
| celular | **só 4G/5G** (Wi-Fi desligado) |

Roteiro: QR → cadastro → Começar → "Olá, {nome}" na TV → semestres → crachá → TV volta ao QR. Com um segundo celular, aperte Começar no meio: ele deve ficar na fila ("Você é o próximo").

## 7. Plano grátis: o que saber

- **Dorme após 15 min sem acesso** e leva cerca de 1 min para acordar. A TV aberta manda sinal a cada 20 s, então ela mantém o servidor acordado: **abra a TV uns 5 minutos antes do público**. O plano pago (a partir de US$ 7/mês) não dorme.
- **750 horas/mês** de servidor: dá para o mês inteiro com um serviço.
- O disco do Render é apagado a cada deploy: por isso os dados ficam no Neon.
- Neon Free: 1 GB de banco por projeto, sem prazo de validade. Não use o Postgres grátis do Render: ele é apagado em 30 dias.
- Todo `git push` na branch publicada faz um novo deploy (`autoDeploy: true`). Durante o deploy a TV mostra "reconectando…" por alguns segundos e volta sozinha.

## 8. Dados do estande offline

Para levar os leads de um evento feito com o notebook (pasta `data/`) para o banco:

```powershell
$env:DATABASE_URL = "postgresql://…neon.tech/neondb?sslmode=require"
npm run importar
```

Com o `.env.local` do `neon env pull`, nem precisa da primeira linha: o `npm run importar` já acha o banco e usa a conexão direta (`DATABASE_URL_UNPOOLED`). Pode repetir: não duplica.

**Estande sem internet:** o `INICIAR.bat` liga `DEVPATH_OFFLINE=1`, então no notebook os dados vão sempre para `data/`, mesmo com o banco configurado no `.env.local`. Fora desse modo, se o banco não responder, o servidor avisa e usa os arquivos (em produção ele não sobe sem banco).

## 9. Domínio próprio (opcional)

Render → serviço → *Settings → Custom Domains* → `devpath.seudominio.com` (crie o CNAME que ele indicar). Depois acrescente a variável `PUBLIC_BASE_URL=https://devpath.seudominio.com`. O código do QR não muda; o endereço do QR muda, então gere/imprima o QR de novo.
