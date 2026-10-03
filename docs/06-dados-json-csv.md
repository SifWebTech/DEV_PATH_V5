# 6. Arquivos de dados: JSON, JSONL e CSV

| Arquivo | Formato | Vai para o Git? | Quem escreve | Quem lê |
|---|---|---|---|---|
| `package.json` | JSON | **sim** | o programador | Node / npm |
| `data/estado.json` | JSON | não | `store.saveState` | `store.loadState` (ao iniciar) |
| `data/eventos.jsonl` | JSON Lines | não | `store.appendEvents` | `funil.init` |
| `data/leads.csv` | CSV (`;`, UTF-8 com BOM) | não | `store.appendLead`, `deleteLead`, `initCsv` | servidor e **Excel** |
| `data/leads-backup-v4.csv` | CSV | não | `store.initCsv` (uma vez) | só você, se precisar |
| `data/.porta` | texto (um número) | não | `server.js` | `abrir-telas.ps1` |

Tudo em `data/` fica fora do Git por causa do `.gitignore` (ver [08-git.md](08-git.md)): são **dados pessoais** de visitantes (LGPD) ou coisas que só fazem sentido no computador local.

> Os exemplos abaixo usam dados fictícios.

---

## 6.1 O formato JSON

**JSON** (*JavaScript Object Notation*) é texto que representa dados. Regras:

```json
{
  "nome": "Ana Souza",
  "idade": 17,
  "consentiu": true,
  "contato": null,
  "interesses": ["apps", "design"],
  "endereco": { "cidade": "Jales", "uf": "SP" }
}
```
| Tipo | Exemplo | Observação |
|---|---|---|
| objeto | `{ "chave": valor }` | chaves **sempre** entre aspas duplas |
| array (lista) | `[1, 2, 3]` | ordem importa |
| texto | `"Ana"` | **só** aspas duplas (aspas simples são erro) |
| número | `17`, `3.5` | sem aspas, ponto como decimal |
| booleano | `true` / `false` | minúsculo |
| nulo | `null` | "sem valor" |

Diferenças para um objeto JavaScript: em JSON **não** pode comentário, **não** pode vírgula sobrando no último item, e as chaves precisam de aspas duplas. Por isso um JSON escrito à mão quebra fácil — e por isso o servidor usa `JSON.stringify` (objeto → texto) e `JSON.parse` (texto → objeto) em vez de montar texto na mão.

---

## 6.2 `package.json` — linha a linha

```json
{
  "name": "devpath-v5",
  "version": "5.0.0",
  "private": true,
  "description": "DEV PATH V5 — apresentação interativa celular + TV do curso de Sistemas para Internet (Fatec Jales)",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "engines": { "node": ">=18" }
}
```

| Campo | O que significa | Por que está aqui |
|---|---|---|
| `name` | nome do projeto | minúsculas e sem espaço (regra do npm) |
| `version` | `5.0.0` no formato **MAIOR.MENOR.CORREÇÃO** (*versionamento semântico*) | o 5 é a V5; a mudança de V4 → V5 trocou o 4 por 5 (commit `a95317e`) |
| `private` | `true` | impede publicar o projeto no npm por acidente |
| `description` | resumo | aparece em ferramentas e no GitHub |
| `main` | arquivo principal | diz qual arquivo é o ponto de partida |
| `scripts.start` | comando de `npm start` | `npm start` = `node server.js`. É a forma padrão de iniciar um projeto Node |
| `engines.node` | `>=18` | declara o Node 18 ou mais novo. O código usa recursos modernos (`crypto.randomUUID()`, `??`, `?.`, separador `60_000`) que versões muito antigas não entendem; o 18 é uma versão de suporte longo (LTS) segura como mínimo. É um **aviso**: o Node não se recusa a rodar com versão menor, mas pode falhar |

**O que não tem:** `dependencies`. O projeto não usa nenhum pacote externo, então não existe `node_modules/` nem `package-lock.json`, e não é preciso rodar `npm install`. O `.gitignore` lista `node_modules/` só por precaução.

---

## 6.3 `data/estado.json` — para sobreviver a uma queda

Exemplo:
```json
{
  "salvoEm": "2026-10-03 15:42:10",
  "eventoManual": "Feira de Profissões 2026",
  "current": "3f2b9c1e-7a44-4d0e-9b1a-1c2d3e4f5a6b",
  "queue": ["9a8b7c6d-...", "1e2f3a4b-..."],
  "leads": [
    {
      "id": "3f2b9c1e-7a44-4d0e-9b1a-1c2d3e4f5a6b",
      "name": "Ana Souza",
      "interest": "design",
      "evento": "Feira de Profissões 2026",
      "visitante": "k2x9m1p0-abcdefghij",
      "when": "2026-10-03 15:40:02",
      "done": false,
      "lastReaction": 1790000000000
    }
  ]
}
```

| Campo | Significado |
|---|---|
| `salvoEm` | quando foi gravado (para conferência) |
| `eventoManual` | nome do evento dado no painel |
| `current` | id de quem está na TV (`null` = TV livre) |
| `queue` | ids na fila, **em ordem** |
| `leads` | os leads desta sessão (o que é preciso para a TV e a fila). **Não guarda o contato** |
| `done` | já assistiu até o fim |
| `lastReaction` | horário da última reação em milissegundos desde 1970 (usado para o limite de 350 ms) |

- **Gravação:** a cada mudança, com 150 ms de espera e de forma **atômica** (grava num `.tmp` e renomeia). Ver [05-js-servidor.md](05-js-servidor.md#55-serverstorejs--os-arquivos-de-data).
- **Leitura:** uma vez, ao iniciar o servidor (`sessao.restore`). Só voltam os leads que ainda existem na planilha.
- Pode apagar? Sim, com o servidor desligado. A fila começa vazia; nenhum lead se perde (eles estão no CSV).

---

## 6.4 `data/eventos.jsonl` — o funil

**JSONL** (*JSON Lines*) = **um JSON completo por linha**. Exemplo:
```
{"quando":"2026-10-03 15:39:50","tipo":"qr_aberto","evento":"Feira de Profissões 2026","visitante":"k2x9m1p0-abcdefghij"}
{"quando":"2026-10-03 15:39:58","tipo":"form_inicio","evento":"Feira de Profissões 2026","visitante":"k2x9m1p0-abcdefghij"}
{"quando":"2026-10-03 15:40:02","tipo":"lead","evento":"Feira de Profissões 2026","lead":"3f2b9c1e-...","visitante":"k2x9m1p0-abcdefghij","interesse":"design","contato":"whatsapp"}
{"quando":"2026-10-03 15:40:05","tipo":"inicio","evento":"Feira de Profissões 2026","lead":"3f2b9c1e-...","visitante":"k2x9m1p0-abcdefghij"}
{"quando":"2026-10-03 15:41:30","tipo":"reacao","evento":"Feira de Profissões 2026","lead":"3f2b9c1e-...","reacao":"fire","cena":"3º semestre: Dados","ordem":6}
{"quando":"2026-10-03 15:42:55","tipo":"concluido","evento":"Feira de Profissões 2026","lead":"3f2b9c1e-...","visitante":"k2x9m1p0-abcdefghij"}
```

### Por que JSONL e não um JSON normal com uma lista?
| JSON normal `[ {...}, {...} ]` | JSONL (uma linha por evento) |
|---|---|
| para acrescentar um evento, é preciso ler o arquivo inteiro, mexer na lista e regravar tudo | basta **acrescentar uma linha no fim** (`appendFileSync`) — rápido mesmo com milhares de eventos |
| se a energia cair no meio da gravação, o `]` final some e **o arquivo inteiro** fica inválido | só a **última linha** fica cortada; o servidor ignora essa linha e aproveita todas as outras |

### Tipos de evento
| `tipo` | Quem registra | Campos extras |
|---|---|---|
| `qr_aberto` | celular (via `/api/evento`) | `visitante` |
| `form_inicio` | celular | `visitante` |
| `lead` | servidor, no cadastro | `lead`, `visitante`, `interesse`, `contato` (o **tipo** de contato, nunca o contato em si); `importado: true` nos vindos da V4 |
| `inicio` | servidor, no Começar | `lead`, `visitante` |
| `reacao` | servidor | `lead`, `reacao`, `cena`, `ordem` |
| `concluido` / `interrompido` | servidor, no fim da apresentação | `lead`, `visitante` |
| `compartilhou` | celular, ao salvar o crachá | `visitante`, `lead` |
| `vestibular_clique` | servidor, no redirecionamento | `lead`, `visitante` |
| `lead_excluido` | servidor, na exclusão | `lead`, `por` (`visitante` ou `operador`) |

**Nenhuma linha tem nome, e-mail, Instagram ou telefone.** Por isso o arquivo pode continuar existindo mesmo depois de uma exclusão pedida pelo visitante: os ids são aleatórios e não identificam ninguém sem a planilha.

---

## 6.5 `data/leads.csv` — a planilha

**CSV** (*Comma-Separated Values*) = tabela em texto puro: uma linha por registro, colunas separadas por um caractere. Exemplo (fictício):

```
data_hora;nome;contato;tipo_contato;interesse;consentimento;id;evento
2026-10-03 15:40:02;Ana Souza;wa.me/5517999990000;whatsapp;design;sim;3f2b9c1e-7a44-4d0e-9b1a-1c2d3e4f5a6b;Feira de Profissões 2026
2026-10-03 15:47:31;Bruno Lima;instagram.com/brunolima;instagram;apps;sim;7c1d...;Feira de Profissões 2026
2026-10-03 16:02:10;Carla Dias;carla@email.com;email;business;sim;0e9f...;Feira de Profissões 2026
```

### As colunas (a ordem importa: o código lê pela posição)
| # | Coluna | Conteúdo |
|---|---|---|
| 1 | `data_hora` | horário local do notebook |
| 2 | `nome` | como o visitante digitou (espaços extras removidos) |
| 3 | `contato` | e-mail; ou `instagram.com/perfil`; ou `wa.me/55DDDNUMERO` — os dois últimos viram links clicáveis |
| 4 | `tipo_contato` | `email`, `instagram` ou `whatsapp` |
| 5 | `interesse` | `design`, `logic`, `apps` ou `business` |
| 6 | `consentimento` | sempre `sim` (sem consentimento o cadastro é recusado) |
| 7 | `id` | identificador único (UUID), usado para excluir |
| 8 | `evento` | nome do evento (vazio nos leads da V4 → lido como "Antes da V5") |

### Por que **ponto e vírgula** (`;`) e não vírgula?
No Excel configurado em **português do Brasil**, a vírgula é o separador **decimal** (`3,5`). Por isso o Excel brasileiro espera `;` como separador de colunas num CSV. Com vírgula, ele abriria tudo numa coluna só.

### Por que o **BOM** no início?
O arquivo começa com um caractere invisível, o BOM (`U+FEFF`, gravado como os bytes `EF BB BF`). Ele avisa ao Excel que o arquivo está em **UTF-8**. Sem ele, o Excel do Windows supõe a codificação antiga e mostra "JoÃ£o" em vez de "João". O servidor remove o BOM ao ler (`replace(/^﻿/, '')`) para não atrapalhar a primeira coluna.

### Proteções aplicadas em cada célula (`csvCell`)
| Problema | Proteção |
|---|---|
| alguém digita `;` no nome → criaria uma coluna a mais | `;` e quebras de linha viram espaço |
| valor começando com `=`, `+`, `-`, `@` → o Excel executaria como **fórmula** | ganha um `'` na frente (o Excel trata como texto) |
| valor com aspas `"` | aspas duplicadas e o valor inteiro entre aspas (regra padrão do CSV) |

### Como o arquivo muda
- **Novo cadastro:** uma linha acrescentada no fim.
- **Exclusão:** o arquivo é reescrito inteiro sem aquela linha (de forma atômica).
- **Primeira execução da V5** sobre uma planilha da V4: cópia em `leads-backup-v4.csv` e cabeçalho atualizado (a V4 não tinha a coluna `evento`).

### Cuidado ao abrir no Excel durante o evento
Com o arquivo aberto, o Excel pode **bloquear** a gravação no Windows. O servidor tem um plano B para a reescrita, mas o mais seguro é **baixar a planilha pelo painel** (botão "Baixar planilha"), que gera uma cópia, em vez de abrir o arquivo original de `data/`.

---

## 6.6 `data/.porta`

Contém só o número da porta, ex.: `8787`. O nome começa com ponto, o que é convenção para "arquivo de controle, não mexa".
- **Escrito por:** `server.js`, quando a porta abre.
- **Lido por:** `abrir-telas.ps1`, para saber onde abrir a TV e o painel.
- **Apagado por:** `INICIAR.bat`, **antes** de ligar o servidor. Assim o `.ps1` nunca lê o número de uma execução anterior (ver [07-bat-ps1.md](07-bat-ps1.md)).

---

## 6.7 Resumo: qual formato para quê

| Necessidade | Formato escolhido | Motivo |
|---|---|---|
| configuração do projeto | JSON (`package.json`) | padrão do Node |
| estado completo que é regravado inteiro | JSON (`estado.json`) | uma estrutura só, lida de uma vez |
| histórico que só cresce | JSONL (`eventos.jsonl`) | acrescentar é barato e resistente a quedas |
| tabela para pessoas abrirem | CSV (`leads.csv`) | abre direto no Excel/Google Planilhas, sem programa extra |
| um único valor para outro programa | texto puro (`.porta`) | o mais simples possível de ler no PowerShell |
