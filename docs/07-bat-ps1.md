# 7. `INICIAR.bat` e `abrir-telas.ps1` — a partida com dois cliques

Dois scripts do Windows trabalham juntos:

| Arquivo | Linguagem | Papel |
|---|---|---|
| `INICIAR.bat` | **Batch** (o "prompt de comando" antigo, `cmd.exe`) | é o que você clica duas vezes. Liga o servidor e chama o `.ps1` |
| `abrir-telas.ps1` | **PowerShell** (o terminal moderno do Windows) | espera o servidor responder, descobre a TV e abre cada janela na tela certa |

Por que dois arquivos e não um? O `.bat` abre com duplo clique em qualquer Windows, sem configuração. Já um `.ps1` com duplo clique abre no **Bloco de Notas** (o Windows bloqueia scripts PowerShell por padrão, por segurança). Por outro lado, o Batch não consegue listar monitores nem fazer requisições HTTP com facilidade; o PowerShell consegue. Então o `.bat` serve de "botão" e chama o `.ps1` liberando a execução só para ele.

## A sequência completa, no tempo

```
 tempo ─────────────────────────────────────────────────────────────▶

 INICIAR.bat   apaga .porta ─ start (PS1 em paralelo) ─ node server.js ··· (fica aqui enquanto o servidor roda)
                                     │                        │
 abrir-telas.ps1                     └─ espera ─ espera ─ lê .porta ─ testa /api/info ─ abre TV ─ abre painel ─ fim
                                                    ▲
 server.js                                          └── grava data/.porta quando a porta abre
```

---

## 7.1 `INICIAR.bat`, linha a linha

```bat
@echo off
```
Por padrão o `cmd` **mostra cada comando** antes de executá-lo. `echo off` desliga isso, para a janela mostrar só as mensagens do servidor. O `@` na frente esconde a própria linha `echo off`. É sempre a primeira linha de um `.bat`.

```bat
title DEV PATH V5 - Servidor do estande (nao feche esta janela)
```
Muda o título da janela preta. Serve de aviso para quem estiver no estande: fechar essa janela desliga o servidor. (Sem acentos de propósito: o `cmd` usa uma codificação antiga e acentos podem aparecer como símbolos estranhos.)

```bat
cd /d "%~dp0"
```
Entra na pasta onde o `.bat` está. Desmontando:
- `%0` é o caminho do próprio script.
- `%~dp0` extrai só o **d**rive (`D:`) e o **p**ath (a pasta), com a barra no fim: `D:\0 - FATEC\...\DEV_PATH_V5\`.
- `/d` permite trocar também de **unidade** (o `cd` sozinho não sai de `C:` para `D:`).
- As aspas são obrigatórias porque o caminho tem **espaços** ("0 - FATEC", "5º Semestre - Matérias").

**Por que é necessário?** Quando se dá duplo clique, o Windows às vezes inicia o `.bat` com outra pasta como "pasta atual" (por exemplo, `C:\Windows\System32`, se ele for executado como administrador). Aí `node server.js` não acharia o arquivo. Esta linha garante que tudo daqui para baixo funciona a partir da pasta do projeto.

```bat
where node >nul 2>nul || (echo Instale o Node.js em https://nodejs.org e rode novamente. & pause & exit /b)
```
Verifica se o Node.js está instalado **antes** de tentar usá-lo:
- `where node` procura o programa `node` nas pastas do sistema (o PATH). Se acha, termina com sucesso; se não, com erro.
- `>nul` joga fora a saída normal (o caminho encontrado) e `2>nul` joga fora as mensagens de erro (`2` é o canal de erros). Assim nada aparece na tela.
- `||` significa "**se o comando anterior falhou**, execute o seguinte".
- Dentro dos parênteses, `&` encadeia comandos: mostra a mensagem, `pause` espera uma tecla (senão a janela fecharia antes de dar para ler) e `exit /b` encerra **só este script** (o `/b` evita fechar um terminal que já estivesse aberto).

```bat
rem apaga a porta da execucao anterior; o servidor grava a nova ao iniciar
if exist "data\.porta" del "data\.porta"
```
- `rem` (de *remark*) é um comentário.
- Se sobrou um `data\.porta` da última vez, apaga. **Por quê?** O `.ps1` espera esse arquivo aparecer para saber que o servidor está pronto. Se o arquivo velho continuasse lá, o `.ps1` poderia ler a porta antiga antes de o servidor novo abrir. Apagando antes, o arquivo só existe quando o servidor **desta** execução o criar.
- Isso precisa acontecer **antes** das duas linhas seguintes.

```bat
rem abre a apresentacao na TV (HDMI estendido) e o painel do operador no notebook
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0abrir-telas.ps1"
```
Inicia o PowerShell com o script **em paralelo**:
| Parte | Significado |
|---|---|
| `start` | inicia um programa **sem esperar** ele terminar; o `.bat` segue para a próxima linha na hora |
| `""` | título da nova janela (vazio). **Obrigatório**: o `start` trata o primeiro texto entre aspas como título; sem esse `""`, ele confundiria o caminho do script com o título |
| `/min` | a janela do PowerShell abre minimizada (ela não precisa aparecer) |
| `powershell` | o Windows PowerShell 5.1, que vem em todo Windows 10/11 |
| `-NoProfile` | não carrega as personalizações do usuário: abre mais rápido e se comporta igual em qualquer notebook |
| `-ExecutionPolicy Bypass` | libera a execução de scripts **só para este processo**. Não muda a configuração de segurança do Windows |
| `-File "...abrir-telas.ps1"` | o script a executar, com caminho completo (`%~dp0`) e entre aspas por causa dos espaços |

```bat
node server.js
```
Liga o servidor. Diferente do `start`, este comando **prende** a janela: o `.bat` fica parado nesta linha enquanto o servidor estiver rodando, e a janela preta mostra as mensagens dele (endereço do celular, senha, avisos).

**Por que o PowerShell é iniciado ANTES do servidor, se depende dele?** Porque `node server.js` nunca "termina" enquanto o estande funciona. Se viesse primeiro, a linha do `start` só rodaria quando o servidor fosse desligado, ou seja, tarde demais. Por isso o `.ps1` é disparado antes, em paralelo, e fica **esperando** o servidor ficar pronto (ver 7.2).

```bat
pause
```
Só chega aqui se o servidor parar (erro, ou Ctrl+C). O `pause` mantém a janela aberta com "Pressione qualquer tecla para continuar...", para dar tempo de **ler a mensagem de erro**. Sem ele, a janela fecharia na hora e o erro sumiria.

---

## 7.2 `abrir-telas.ps1`, linha a linha

### Cabeçalho (linhas 1–8)
Linhas começando com `#` são comentários. Explicam o que o script faz e por que usa `127.0.0.1` e confere a resposta (a porta 3000, por exemplo, pode estar ocupada pelo AdGuard Home).

### Esperar o servidor (linhas 9–21)

```powershell
$portFile = Join-Path $PSScriptRoot "data\.porta"
```
- Variáveis no PowerShell começam com `$`.
- `$PSScriptRoot` é a pasta onde o `.ps1` está (equivale ao `%~dp0` do Batch).
- `Join-Path` junta pasta e arquivo com a barra certa: `...\DEV_PATH_V5\data\.porta`.

```powershell
$base = $null
for ($i = 0; $i -lt 60 -and -not $base; $i++) {
```
- `$base` vai guardar o endereço do servidor (ex.: `http://127.0.0.1:8787`). Começa vazio (`$null`).
- O laço repete **enquanto** `$i` for menor que 60 (`-lt` = *less than*) **e** (`-and`) `$base` ainda estiver vazio (`-not $base`). Ou seja: para assim que achar o servidor, ou depois de 60 tentativas.
- Operadores de comparação no PowerShell são palavras: `-lt` (menor), `-gt` (maior), `-eq` (igual), `-match` (casa com um padrão).

```powershell
  Start-Sleep -Milliseconds 300
```
Espera 300 ms entre tentativas. 60 × 300 ms = **até 18 segundos** de espera, tempo de sobra para o Node iniciar (normalmente leva menos de 1 s). A espera vem **antes** do teste porque, no primeiro instante, o servidor certamente ainda não abriu.

```powershell
  if (Test-Path $portFile) {
    $port = (Get-Content $portFile -Raw).Trim()
```
- `Test-Path` — o arquivo existe?
- `Get-Content -Raw` lê o arquivo inteiro como **um** texto (sem `-Raw`, viria uma lista de linhas). `.Trim()` remove espaços e quebras de linha das pontas, sobrando só `8787`.

```powershell
    try {
      $info = Invoke-WebRequest "http://127.0.0.1:$port/api/info" -UseBasicParsing -TimeoutSec 1
      if ($info.Content -match 'mobileUrl') { $base = "http://127.0.0.1:$port" }
    } catch {}
  }
}
```
Confirma que o servidor **responde** e que **é o DEV PATH**:
- `Invoke-WebRequest` faz uma requisição HTTP (como um navegador, mas sem tela) para a rota `/api/info`.
- `"...:$port/..."` — entre aspas duplas, o PowerShell substitui `$port` pelo valor.
- `127.0.0.1` é o próprio computador (o mesmo que `localhost`, mas sem a etapa de tradução de nome, que às vezes tenta IPv6 primeiro e demora).
- `-UseBasicParsing` — no Windows PowerShell 5.1, sem essa opção o comando tenta usar o motor do Internet Explorer para interpretar a página e pode falhar ou abrir um aviso.
- `-TimeoutSec 1` — desiste em 1 s se não houver resposta.
- `-match 'mobileUrl'` — a resposta do DEV PATH contém o campo `mobileUrl`. Se outro programa estivesse nessa porta, a resposta seria outra e o script continuaria esperando.
- `try { } catch { }` — se der erro (servidor ainda subindo), **ignora** e tenta de novo na próxima volta do laço.

```powershell
if (-not $base) {
  Write-Host "  O servidor do DEV PATH nao respondeu. Veja a mensagem na janela preta do servidor."
  Read-Host "  Enter para fechar"
  exit 1
}
```
Depois das 60 tentativas sem sucesso: avisa, espera um Enter (`Read-Host`) para a mensagem não sumir e encerra com código 1 (erro). Como a janela foi aberta minimizada, o usuário verá o aviso ao clicar nela na barra de tarefas; o erro de verdade estará na janela preta do servidor.

### Escolher o navegador (linhas 28–35)

```powershell
$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
```
- `@( ... )` cria uma lista com os lugares onde Chrome e Edge costumam estar instalados.
- `$env:ProgramFiles` é a variável de ambiente `C:\Program Files`; `$env:LocalAppData`, a pasta do usuário (instalação do Chrome sem administrador).
- `${env:ProgramFiles(x86)}` precisa de **chaves** porque o nome da variável tem parênteses.
- O `|` (*pipe*) passa o resultado de um comando para o próximo:
  1. a lista vai para `Where-Object { Test-Path $_ }`, que **filtra** só os caminhos que existem (`$_` = o item da vez);
  2. o que sobrou vai para `Select-Object -First 1`, que fica com o **primeiro**.
- **A ordem da lista é a ordem de preferência**: Chrome primeiro (nos três lugares possíveis), depois Edge. O Edge vem em todo Windows, então quase sempre algum é encontrado.

### Descobrir a TV (linhas 37–38)

```powershell
Add-Type -AssemblyName System.Windows.Forms
$tv = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1
```
- `Add-Type` carrega uma biblioteca do .NET (a plataforma da Microsoft). A `System.Windows.Forms` sabe listar os monitores.
- `[System.Windows.Forms.Screen]::AllScreens` = todas as telas ligadas (notebook, TV...).
- `Where-Object { -not $_.Primary }` = as que **não** são a tela principal. Com o HDMI em modo **Estender**, a TV é a tela secundária.
- `Select-Object -First 1` = a primeira delas. Se não houver segunda tela, `$tv` fica vazio.

### Abrir a apresentação (linhas 40–53)

```powershell
if ($browser -and $tv) {
```
Só faz o modo "tela cheia na TV" se achou **um navegador e uma TV**.

```powershell
  $x = $tv.Bounds.X + 50; $y = $tv.Bounds.Y + 50
```
`Bounds` é o retângulo da TV na "área de trabalho virtual" do Windows. Com a TV à direita de um notebook de 1920 px, por exemplo, `Bounds.X` é 1920. Somando 50, o ponto cai com certeza **dentro** da TV. O `;` permite dois comandos na mesma linha.

```powershell
  $profile = Join-Path $env:TEMP "devpath-tv"
```
Uma pasta de **perfil separado** do navegador, em `%TEMP%\devpath-tv`. Ver o motivo em `--user-data-dir` abaixo.
*(Detalhe: `$profile` é também o nome de uma variável automática do PowerShell, que aponta para o arquivo de personalização do usuário. Como o script roda com `-NoProfile`, reaproveitar o nome não causa problema, mas um nome como `$perfilTv` evitaria confusão.)*

```powershell
  Start-Process $browser -ArgumentList @(
    "--user-data-dir=`"$profile`"", "--new-window", "--window-position=$x,$y", "--kiosk",
    "--no-first-run", "--no-default-browser-check", "--disable-session-crashed-bubble", "--noerrdialogs",
    "$base/"
  )
```
`Start-Process` abre o navegador com a lista de opções (`-ArgumentList`). Cada opção:

| Opção | O que faz | Por que é necessária |
|---|---|---|
| `--user-data-dir="..."` | usa um perfil próprio (histórico, abas, configurações separados) | **A mais importante.** Se o Chrome já estiver aberto, um novo comando só pede para a janela existente abrir uma aba, e **ignora** as outras opções (tela cheia, posição). Com outro perfil, nasce um processo novo que obedece às opções. O `` `" `` é a forma de colocar aspas dentro de um texto no PowerShell (o acento grave é o caractere de escape), necessário porque o caminho do `%TEMP%` pode ter espaços |
| `--new-window` | abre numa janela nova | não reaproveitar janela |
| `--window-position=x,y` | coloca a janela nessa posição | é o que faz ela nascer **na TV** |
| `--kiosk` | tela cheia sem barra de endereço, abas ou botões | modo "totem": parece um aparelho dedicado, e o visitante não vê nada do navegador. Ocupa o monitor onde a janela está, por isso a posição vem antes |
| `--no-first-run` | pula as telas de boas-vindas | o perfil novo mostraria o assistente de primeiro uso |
| `--no-default-browser-check` | não pergunta "deseja tornar padrão?" | sem pop-ups na TV |
| `--disable-session-crashed-bubble` | não mostra "restaurar páginas?" | se o notebook travou na última vez, esse balão apareceria na TV |
| `--noerrdialogs` | suprime caixas de erro | nada de janelas inesperadas na frente da apresentação |
| `"$base/"` | o endereço a abrir, ex.: `http://127.0.0.1:8787/` | a página da TV (`index.html`) |

```powershell
  Write-Host "  Apresentacao aberta na TV (tela $($tv.DeviceName)). Para fechar: clique nela e Alt+F4."
```
`$( ... )` dentro das aspas calcula uma expressão (aqui, o nome do monitor, ex.: `\\.\DISPLAY2`). Em modo kiosk não há botão de fechar, por isso a dica do Alt+F4.

```powershell
} else {
  Start-Process "$base/"
  if (-not $tv) { Write-Host "  Segunda tela nao encontrada. Ligue o HDMI, aperte Windows+P e escolha 'Estender'." }
}
```
Plano B: sem TV (ou sem Chrome/Edge), abre o endereço no **navegador padrão**, na tela do notebook. `Start-Process` com um endereço `http://` faz o Windows escolher o navegador padrão. Se o motivo foi a falta da TV, explica como ligá-la.

### Abrir o painel (linhas 54–55)

```powershell
Start-Sleep -Seconds 1
Start-Process "$base/operador"
```
Espera 1 s e abre o painel do operador no navegador padrão, na tela principal (o notebook).
**Por que esperar?** Para a janela da TV terminar de abrir e ir para a TV antes; abrindo as duas ao mesmo tempo, a do painel poderia pegar o foco ou o navegador poderia juntar as duas numa janela só.
**Por que o painel não usa as opções especiais?** Porque ele deve abrir como uma janela comum, no navegador do dia a dia do operador, com barra de endereço e abas.

---

## 7.3 Problemas comuns e onde mexer

| Sintoma | Causa provável | Onde está a solução |
|---|---|---|
| "Cannot find module ...server.js" | o `.bat` foi aberto de dentro de um ZIP (o Windows extrai só ele, sem o resto) | extraia a pasta inteira antes de rodar |
| "Instale o Node.js..." | Node não instalado ou fora do PATH | instale em nodejs.org e **abra o `.bat` de novo** (o PATH só é relido em janelas novas) |
| "O servidor do DEV PATH nao respondeu" | o servidor deu erro ao iniciar | leia a janela preta (ex.: todas as portas de 8787 a 8807 ocupadas) |
| A apresentação abriu no notebook | HDMI desligado ou em modo "Duplicar" | Windows + P → **Estender**, e rode de novo |
| A TV abriu com barra do navegador | nenhum Chrome/Edge achado nos caminhos da lista → caiu no navegador padrão | aperte F na TV para tela cheia, ou instale o Chrome |
| Abriu outro programa em vez do DEV PATH | outro programa na porta | o servidor já pula para a próxima porta livre; feche as janelas antigas e rode de novo |
| Windows pergunta se o Node pode usar a rede | firewall, primeira execução | marque **Redes privadas** e permita (senão o celular não acessa) |

## 7.4 Rodar sem os scripts (útil para testes)

No terminal, dentro da pasta do projeto:
```bat
node server.js
```
e abra manualmente `http://localhost:8787` (TV) e `http://localhost:8787/operador` (painel).

Com opções (no `cmd`):
```bat
set PORT=8810
set DATA_DIR=C:\teste-devpath
set ADMIN_KEY=minhasenha
node server.js
```
No PowerShell, a sintaxe muda: `$env:PORT = "8810"` em vez de `set PORT=8810`.
