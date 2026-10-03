# DEV PATH V5 — onde paramos

> Diário de trabalho do projeto. Quando voltar, peça "onde paramos?" e este arquivo é o ponto de partida.
> Última atualização: **02/10/2026**

## Contexto

- **Projeto:** apresentação interativa de estande (TV + celular) para captar alunos para o curso de **Sistemas para Internet — Fatec Jales**.
- **Matéria:** 5º semestre, Negócio e Marketing (prof.ª Andresa). A V4 já foi apresentada; a V5 é a evolução.
- **Pasta:** `..V4 - APRESENTADO BOER - DEV_PATH_V4\DEV_PATH_V5` (cópia da V4 usada como base da V5).
- **GitHub:** https://github.com/SifWebTech/DEV_PATH_V5, branch `main`.
- **Fonte das disciplinas:** `..\Horário-SI-2° Sem - 2026SalaseLabs- v2.pdf` (na pasta de cima).
- Como rodar e o que cada parte faz: veja o `README.md`.

## Linha do tempo

| Data | Commit | O que foi feito |
|---|---|---|
| 02/10/2026 | `cc74e61` | Base da V5 copiada da V4. Disciplinas conferidas com o horário oficial: só "Leitura e Produção de Text**os**" estava errada (corrigida). `leads.csv` fora do Git (LGPD). |
| 02/10/2026 | `a95317e` | Tudo renomeado de V4 para V5 (versão 5.0.0). |
| 02/10/2026 | `b759bfe` | **Semestres mostram todas as 43 disciplinas** na TV (antes só 3 por semestre; o resto passava numa faixa no rodapé). Nome oficial grande + tradução; 3 destaques com a cor do semestre. Cada semestre passou de 13 s para 15 s. |
| 02/10/2026 | `0ad9027` | **Fases 1 a 4 da arquitetura V5** (detalhes abaixo). |
| 02/10/2026 | *sem commit* | Ajustes visuais no circuito do fundo (ver "Pendências"). |
| 03/10/2026 | *sem commit* | **Documentação técnica** em `docs/`: um arquivo por assunto (HTML, CSS, fontes WOFF2, JS do navegador, servidor, JSON/CSV, BAT/PS1, Git), explicando cada comando e o porquê de cada sequência. |

## Fases da V5 (todas concluídas)

1. **Funil e métricas:** eventos em `data/eventos.jsonl` (sem dados pessoais). O painel `/operador` mostra o funil (QR → cadastro → começou → assistiu → salvou crachá → vestibular) com conversão por etapa, interesses, cadastros por hora e reações por cena. O nome do evento é definido no painel.
2. **Conversão:** crachá 1080×1920 para stories gerado no celular. Link e QR do vestibular com UTM do evento; cliques contados.
3. **Servidor em módulos** (`server/`: config, http, sessao, leads, funil, store, auth, util). Fila e TV salvas em `data/estado.json` e recuperadas após queda.
4. **WhatsApp** como 3ª opção de contato. Exclusão de dados pelo visitante (celular) e pelo operador (painel). Login do painel por cookie (sem senha na URL). CSV filtrado por evento e interesse.

**Testes feitos:** roteiro automático da API (28/28 ok), recuperação após queda, capturas de tela da TV, do celular, do painel e do crachá PNG.
**Não testado:** celular de verdade na rede do estande e TV pelo HDMI.

## Pendências (estado atual)

- [ ] **Alterações sem commit**, ainda em teste na TV:
  - `public/css/tv.css`: `#circuit` com `opacity: .6` (circuito do fundo mais transparente).
  - `public/js/circuit.js`, linha 86, alterada pelo usuário: pulsos mais lentos e com cauda menor
    (`speed: 150 + Math.random() * 100 + energy * 100, tail: 50 + energy * 50`;
    o original era `speed: 160 + Math.random() * 220 + energy * 380, tail: 70 + energy * 90`).
  - Falta decidir se ficam e subir para o GitHub.
- [ ] **Ensaio completo** no notebook + TV + celular real antes do evento.
- [ ] Na **primeira execução** da V5 com os dados reais, o servidor adiciona a coluna "evento" ao `data/leads.csv` e salva o original em `data/leads-backup-v4.csv`. É automático; só conferir.
- [ ] Antes do evento: dar o **nome do evento** no painel e, se quiser, trocar a senha (`set ADMIN_KEY=...`).
- [ ] Opcional: o comentário em `public/js/tv.js` (perto do fim) diz "15 = crachá", mas são 14 cenas (o README está certo).

## Ajustes rápidos que já foram explicados

- **Transparência do circuito:** `opacity` do `#circuit` em `public/css/tv.css` (1 = original, 0 = invisível). Ajuste fino por parte em `public/js/circuit.js`: trilhas (linha 71, `'1c'`), bolinhas (76, `'30'`), grade (80, `'#22b8ff14'`), brilho do pulso (113, `0.22`), núcleo do pulso (116, `0.9`).
- **Velocidade, quantidade e cauda dos pulsos:** `circuit.js`, linha 86 (`speed`, `tail`) e linha 98 (`4 + energy * 26` pulsos por segundo).
- **O que faz os pulsos andarem:** `circuit.js`, linha 102 (`p.d += p.speed * dt`), dentro do loop `frame()` com `requestAnimationFrame`.
- **Palco 1920×1080 que se ajusta a qualquer tela:** `#viewport` e `#stage` em `tv.css` + função `fit()` em `tv.js` (escala = menor entre largura/1920 e altura/1080).
- **Textos e disciplinas:** `public/js/content.js` (`disciplinas: [nome oficial, tradução, destaque]`).
- **Duração das cenas:** `STEPS` no topo de `public/js/tv.js` (~2 min 50 s no total).

## Como testar sem mexer nos leads reais

```bat
set DATA_DIR=C:\caminho\para\uma\pasta-de-teste
set PORT=8810
node server.js
```

Com `DATA_DIR`, o servidor grava leads, eventos e estado em outra pasta, e o `data/` real fica intocado.
