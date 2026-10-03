# 8. Git — salvando o trabalho e mandando para o GitHub

## 8.1 O que é cada coisa

| Nome | O que é |
|---|---|
| **Git** | programa instalado no notebook que guarda o **histórico** de versões do projeto, numa pasta escondida `.git/` dentro do projeto |
| **GitHub** | site que guarda uma **cópia** desse histórico na internet (o "remoto"). O deste projeto: `https://github.com/SifWebTech/DEV_PATH_V5` |
| **repositório** | o projeto + o seu histórico |
| **commit** | uma "foto" do projeto num momento, com uma mensagem explicando o que mudou. Cada commit tem um código (ex.: `0ad9027`) |
| **branch** | uma linha do histórico. Aqui só existe a `main` (a principal) |
| **remoto `origin`** | o apelido do endereço do GitHub dentro do Git |

### As três "áreas" (entender isso explica a ordem dos comandos)

```
  pasta de trabalho        área de preparação           histórico local          GitHub
  (os arquivos que você    (staging: o que vai          (.git, no notebook)      (origin)
   edita)                   entrar no próximo commit)
        │                          │                           │                     │
        │ ── git add ─────────────▶│                           │                     │
        │                          │ ── git commit ───────────▶│                     │
        │                          │                           │ ── git push ───────▶│
        │◀──────────────────────────────────── git pull ───────────────────────────── │
```
1. Você **edita** os arquivos (pasta de trabalho).
2. `git add` escolhe **quais** mudanças vão para a próxima foto.
3. `git commit` **tira a foto** e guarda no histórico do notebook.
4. `git push` **envia** as fotos novas para o GitHub.

Por que separar `add` e `commit`? Para você poder salvar mudanças em **grupos com sentido**: por exemplo, commitar o ajuste do circuito num commit e a documentação em outro, mesmo tendo editado tudo no mesmo dia.
Por que separar `commit` e `push`? O commit funciona **sem internet** (no estande, por exemplo). O push só quando houver conexão.

---

## 8.2 Configuração (uma vez por computador)

```bash
git config --global user.name "Felipe Iglesias"
git config --global user.email "seu-email@exemplo.com"
```
Diz ao Git quem é o autor dos commits. `--global` vale para todos os projetos deste computador. Neste notebook isso já está configurado (os commits aparecem como "Felipe Iglesias").

Para conferir:
```bash
git config user.name
git config user.email
```

---

## 8.3 O ciclo para salvar (o dia a dia)

Rode os comandos **dentro da pasta do projeto** (no PowerShell, no terminal do VS Code ou no Git Bash).

### Passo 1 — ver o que mudou
```bash
git status
```
Mostra três grupos:
- **Changes to be committed** (verde): já preparado com `git add`.
- **Changes not staged for commit** (vermelho, *modified*): arquivo que o Git já conhece e foi alterado.
- **Untracked files** (vermelho): arquivo **novo** que o Git ainda não acompanha.

Exemplo real do estado deste projeto antes desta documentação:
```
 M public/css/tv.css        ← modificado (opacity do circuito)
 M public/js/circuit.js     ← modificado (velocidade dos pulsos, linha 86)
?? PROGRESSO.md             ← novo, ainda não acompanhado
```
(`M` = *modified*, `??` = *untracked*. Essa forma curta aparece com `git status -s`.)

**Sempre comece pelo `git status`**: é ele que diz o que existe para salvar e evita surpresas.

### Passo 2 — conferir as mudanças linha a linha
```bash
git diff                          # tudo que mudou e ainda não foi preparado
git diff public/js/circuit.js     # só um arquivo
```
Linhas com `-` (vermelho) saíram; com `+` (verde) entraram. Exemplo:
```diff
-    pulses.push({ t, d: 0, speed: 160 + Math.random() * 220 + energy * 380, tail: 70 + energy * 90 });
+    pulses.push({ t, d: 0, speed: 150 + Math.random() * 100 + energy * 100, tail: 50 + energy * 50 });
```
Aperte `q` para sair da visualização.

### Passo 3 — preparar (escolher o que vai no commit)
```bash
git add public/css/tv.css public/js/circuit.js
```
Prepara só esses dois arquivos. Para preparar uma pasta inteira: `git add docs/`.

Existe também `git add .` (o ponto = "tudo da pasta atual"). É prático, mas **confira o `git status` antes**, para não incluir algo sem querer. Os dados dos visitantes estão protegidos pelo `.gitignore` (ver 8.5), mas outros arquivos soltos não estão.

Para ver o que já está preparado:
```bash
git diff --staged
```

Desfazer um `add` (tirar da preparação, **sem** perder a alteração no arquivo):
```bash
git restore --staged public/js/circuit.js
```

### Passo 4 — tirar a foto (commit)
```bash
git commit -m "Circuito do fundo mais transparente e pulsos mais lentos"
```
- `-m` = a mensagem vem logo em seguida, entre aspas.
- **Boa mensagem:** diz **o que** mudou e, se não for óbvio, **por quê**. Verbo no presente, curta (até ~70 caracteres na primeira linha). Os commits deste projeto seguem esse estilo: "Semestres mostram todas as 43 disciplinas na TV".
- Ruim: "ajustes", "teste", "asdf". Daqui a um mês ninguém sabe o que é.

Mensagem com mais detalhes (título + parágrafo):
```bash
git commit -m "Circuito do fundo mais discreto na TV" -m "opacity .6 no #circuit e pulsos mais lentos (circuit.js, linha 86), testado na TV do estande."
```
Cada `-m` vira um parágrafo.

### Passo 5 — enviar para o GitHub
```bash
git push
```
Envia os commits da `main` local para a `main` do GitHub (o Git já sabe que `main` está ligada a `origin/main`). A forma completa é `git push origin main`.

Na primeira vez, o Windows pode abrir uma janela de login do GitHub (o *Git Credential Manager*); depois ele lembra.

Se o push for **recusado** com uma mensagem como `rejected ... fetch first`, alguém (ou você, de outro computador) enviou commits que o notebook não tem. Faça o passo 8.4 (`git pull`) e depois o `git push` de novo.

### Passo 6 — conferir
```bash
git status              # deve dizer "nothing to commit, working tree clean"
git log --oneline -5    # os 5 últimos commits, um por linha
```
Exemplo de `git log --oneline`:
```
0ad9027 V5: funil de marketing, crachá para stories, servidor em módulos e LGPD
b759bfe Semestres mostram todas as 43 disciplinas na TV
a95317e Renomeia o projeto para DEV PATH V5 (versao 5.0.0)
cc74e61 DEV PATH V5: base a partir da V4
```

### Resumo do ciclo
```bash
git status
git diff
git add <arquivos>
git commit -m "mensagem clara"
git push
```

---

## 8.4 Trazer as mudanças do GitHub (outro computador)

```bash
git pull
```
Baixa os commits novos do GitHub e junta com os seus. Faça **antes de começar a trabalhar** se você também mexe no projeto em outro computador.

Primeira vez num computador novo (baixar o projeto inteiro):
```bash
git clone https://github.com/SifWebTech/DEV_PATH_V5.git
```
Cria a pasta `DEV_PATH_V5` com todo o projeto e o histórico. **A pasta `data/` não vem** (está no `.gitignore`): os leads ficam só no notebook onde foram coletados.

---

## 8.5 O `.gitignore` — o que NÃO vai para o Git

Conteúdo atual:
```gitignore
# dados pessoais dos visitantes (LGPD) e estado local do servidor
data/
node_modules/
```
| Linha | Significado | Motivo |
|---|---|---|
| `# ...` | comentário | explica o porquê para quem abrir o arquivo |
| `data/` | ignora a pasta `data/` inteira | **LGPD**: `leads.csv` tem nome e contato de visitantes. O repositório pode ser público no GitHub; dados pessoais nunca podem ir para lá. Também evita subir `estado.json` e `.porta`, que só valem para o notebook local |
| `node_modules/` | ignora pacotes instalados pelo npm | o projeto não usa nenhum hoje; é uma precaução padrão (esta pasta pode ter milhares de arquivos e é recriada com `npm install`) |

A barra no fim (`data/`) indica que é uma **pasta**.

**Atenção:** o `.gitignore` só impede arquivos **ainda não acompanhados**. Se um arquivo já tivesse entrado num commit, colocá-lo no `.gitignore` depois não o tiraria do histórico. Por isso a planilha entrou no `.gitignore` já no primeiro commit (`cc74e61`, que listava `data/leads.csv` e `data/.porta`), e no commit `0ad9027` a regra passou a ser a pasta `data/` inteira, para cobrir também `eventos.jsonl` e `estado.json`. Nenhum arquivo de `data/` aparece no histórico (`git log --all -- data/` não retorna nada).

Conferir se um arquivo está sendo ignorado e por qual regra:
```bash
git check-ignore -v data/leads.csv
```

---

## 8.6 Desfazer coisas (com cuidado)

| Situação | Comando | Efeito |
|---|---|---|
| Quero **descartar** a alteração de um arquivo e voltar ao último commit | `git restore public/js/circuit.js` | **apaga** a alteração não commitada daquele arquivo. Não tem volta |
| Tirei da preparação sem querer | `git restore --staged arquivo` | só desfaz o `add`; o arquivo continua alterado |
| Errei a mensagem do **último** commit e **ainda não fiz push** | `git commit --amend -m "mensagem certa"` | troca a mensagem. Não use depois do push |
| Quero desfazer um commit que **já foi enviado** | `git revert <código>` | cria um **novo** commit que desfaz aquele. Seguro, não reescreve o histórico |
| Quero ver como um arquivo estava num commit antigo | `git show a95317e:public/js/tv.js` | mostra o arquivo daquela versão, sem mudar nada |

Evite `git reset --hard` e `git push --force`: os dois podem **apagar trabalho** de forma definitiva.

---

## 8.7 Exemplo completo: salvar as pendências atuais deste projeto

Situação: o ajuste do circuito foi aprovado na TV e a documentação foi criada.

```bash
# 1. ver o estado
git status

# 2. conferir o ajuste do circuito
git diff public/css/tv.css public/js/circuit.js

# 3. commit do ajuste visual (separado da documentação)
git add public/css/tv.css public/js/circuit.js
git commit -m "Circuito do fundo mais discreto: opacidade .6 e pulsos mais lentos"

# 4. commit da documentação e do diário de trabalho
git add docs/ PROGRESSO.md
git commit -m "Documentação técnica de cada arquivo e diário de trabalho"

# 5. conferir e enviar
git log --oneline -3
git push
```
Por que dois commits? Se um dia o circuito precisar voltar ao que era, dá para desfazer **só** aquele commit (`git revert`) sem perder a documentação.

Se o ajuste do circuito **não** for aprovado:
```bash
git restore public/css/tv.css public/js/circuit.js   # volta os dois arquivos ao último commit
```

---

## 8.8 Tabela de consulta rápida

| Comando | Para quê |
|---|---|
| `git status` | o que mudou |
| `git status -s` | o mesmo, em formato curto |
| `git diff` | mudanças linha a linha (não preparadas) |
| `git diff --staged` | mudanças já preparadas |
| `git add <arquivo>` | preparar arquivo para o commit |
| `git restore --staged <arquivo>` | desfazer o `add` |
| `git restore <arquivo>` | descartar a alteração (cuidado) |
| `git commit -m "..."` | salvar uma versão no histórico local |
| `git push` | enviar para o GitHub |
| `git pull` | trazer do GitHub |
| `git log --oneline` | histórico resumido |
| `git log --stat` | histórico com os arquivos de cada commit |
| `git show <código>` | o que mudou num commit |
| `git remote -v` | para qual endereço o `push` vai |
| `git clone <url>` | baixar o projeto num computador novo |
