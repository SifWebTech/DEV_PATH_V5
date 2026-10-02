# DEV PATH V5 — Sistemas para Internet · Fatec Jales

Ação de captação para estande: o visitante escaneia o QR Code na TV, faz o cadastro no próprio celular, toca em **Começar** e a TV apresenta os 6 semestres do curso com o nome dele. No fim, o crachá de futuro tecnólogo aparece na TV e no celular.

```
 TV (notebook)                       Celular do visitante
 ┌──────────────────────┐            ┌──────────────────┐
 │ QR Code + headline   │  escaneia  │ 1. nome, contato,│
 │ "Aprenda a criá-la." │ ─────────▶ │    interesse     │
 └──────────────────────┘            │ 2. [ COMEÇAR ]   │
            ▲                        └────────┬─────────┘
            │  servidor local (server.js)     │
            └─────────── inicia ◀─────────────┘
 terminal → gancho → mapa → 6 semestres → criar → carreiras → mercado → Fatec → crachá
                                     celular vira controle de reações 🔥💚🤯🚀
```

## Como rodar no estande (notebook + TV pelo HDMI)

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou mais nova). Não precisa de `npm install`.
2. Ligue o cabo HDMI na TV, aperte **Windows + P** e escolha **Estender**.
3. Conecte o notebook e os celulares **na mesma rede Wi-Fi**. Sem Wi-Fi no local? Ative o **hotspot do Windows** no notebook (Configurações → Rede → Hotspot móvel).
4. Dê dois cliques em **`INICIAR.bat`**. Ele abre sozinho:
   - **na TV:** a apresentação em tela cheia, com o QR Code;
   - **no notebook:** o **painel do operador** (`/operador`, senha `fatec`).
5. Na primeira vez, o Windows pergunta se o Node pode usar a rede: marque **Redes privadas** e permita.

A janela preta do servidor mostra o endereço do celular e a senha. Não feche essa janela durante o evento.

Para fechar a apresentação na TV: clique nela e aperte **Alt + F4**. Se ela abrir no notebook em vez da TV, arraste a janela para a TV (ou use **Windows + Shift + →**) e aperte **F**.

### Painel do operador (tela do notebook)

Mostra quem está na TV, a cena atual, a fila e os leads chegando. Os botões **Voltar, Pausar, Avançar, Encerrar e Demonstração** comandam a TV pelo servidor, então funcionam mesmo com a janela da TV sem foco. Com o painel em foco, os atalhos de teclado também funcionam (← → espaço Esc Enter).

### Atalhos direto na janela da TV

| Tecla | Ação |
|---|---|
| Enter | inicia uma demonstração sem celular |
| → / ← | avança / volta cena |
| Espaço | pausa / continua |
| Esc | encerra e volta ao QR Code (chama o próximo da fila) |
| F | tela cheia |
| H | mostra a ajuda |

### Ensaiar uma cena específica

`http://localhost:8787/?cena=8&nome=Ana%20Souza&perfil=design&pausar`

`cena` vai de 1 a 14 (1 terminal, 2 gancho, 3 mapa, 4–9 semestres, 10 criar, 11 carreiras, 12 mercado, 13 Fatec, 14 crachá). `perfil` aceita `design`, `logic`, `apps` ou `business`.

## Leads

- Ficam em **`data/leads.csv`** (abre direto no Excel, separador `;`, com acentos).
- Painel ao vivo: `http://localhost:8787/operador`, senha **`fatec`**. Para trocar: `set ADMIN_KEY=outrasenha` antes de `node server.js`.
- Instagram é salvo como link (`instagram.com/perfil`).
- O formulário exige consentimento (LGPD) e informa a finalidade do uso dos dados.

## Editar textos

Tudo que aparece na tela está em **`public/js/content.js`**: semestres, disciplinas, traduções para a linguagem do aluno, batimentos do "medidor de paixão", carreiras, setores, diferenciais da Fatec e os 4 perfis do crachá. As durações das cenas estão no topo de `public/js/tv.js` (`STEPS`, ~2 min 50 s no total).

## Estrutura

```
DEV_PATH_V5/
├── INICIAR.bat          duplo clique: servidor + TV em tela cheia + painel
├── abrir-telas.ps1      detecta a TV (HDMI) e abre cada tela no lugar certo
├── server.js            servidor local (Node puro): QR, fila, leads, tempo real (SSE)
├── data/leads.csv       criado no primeiro cadastro
└── public/
    ├── index.html       TV (palco 1920×1080 que se ajusta a qualquer tela)
    ├── m.html           celular
    ├── admin.html       painel do operador + leads (/operador)
    ├── css/             base.css (cores e fontes), tv.css, mobile.css
    ├── js/              content.js (textos), tv.js, circuit.js (fundo), mobile.js
    ├── fonts/           Unbounded + JetBrains Mono (offline)
    └── vendor/          gerador de QR Code (offline)
```

Tudo roda **sem internet**: fontes e biblioteca de QR estão na pasta.

## Histórico: o que mudou da V3 para a V4

| V3 | V4 |
|---|---|
| QR estático; o README admitia que não controlava a TV | Celular inicia a TV de verdade, com fila para vários visitantes |
| Sem captação de leads | Cadastro com nome, e-mail ou Instagram, interesse e consentimento; CSV + painel |
| Código minificado em uma linha (difícil editar) | Código comentado, textos isolados em `content.js` |
| Navegação por cliques, cada semestre era um "slide" | Apresentação automática; um produto real é construído na tela ao longo dos 6 semestres |
| Roxo no 5º semestre, fora da paleta | Paleta neon laranja, verde, azul e branco em tudo |
| Fontes do Google (falham sem internet) | Fontes locais |
| Disciplinas com nomes técnicos | Cada destaque traduzido ("o back-end que faz tudo funcionar") com o nome oficial embaixo; a lista completa passa em faixa |
| — | Medidor de paixão: batimento sobe de 72 para 140 bpm a cada semestre |
| — | Reações do celular aparecem na TV; crachá final no celular para print/stories |

## Problemas comuns

- **O celular não abre a página do QR**: celular e notebook não estão na mesma rede, ou o firewall bloqueou o Node. Rode `INICIAR.bat` de novo e permita o acesso em redes privadas. Redes de visitantes de escolas costumam isolar aparelhos; nesse caso use o hotspot do notebook.
- **A TV mostra "modo demonstração"**: a página foi aberta direto do arquivo, sem o servidor. Abra pelo `INICIAR.bat`.
- **O QR mostra um IP errado** (notebook com várias redes): `set PUBLIC_URL=http://192.168.x.x:8787/m` antes de `node server.js`.
- **Alguém saiu da fila e a TV começou para ninguém**: pressione Esc para chamar o próximo.
- A oferta curricular vigente deve ser confirmada com a Fatec Jales.
- **Abriu o painel de outro programa (ex.: AdGuard Home) em vez da apresentação**: outro programa ocupa a porta. O DEV PATH usa a 8787 e, se ela estiver ocupada, pula sozinho para a próxima livre (veja a porta na janela preta do servidor). Feche as janelas antigas e rode o `INICIAR.bat` de novo.
