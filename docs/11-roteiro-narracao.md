# 11. Roteiro da narração

> Texto integral falado na TV, na ordem da apresentação. A fonte é `public/js/narration.js`: este arquivo foi gerado a partir dele.
> Todas as cenas têm narração. Ritmo animado: vozes neurais com velocidade +12% e tom +6 Hz (`ferramentas/gerar_narracao.py`).
> `{nome}` = primeiro nome do visitante. Duração = MP3 gerado.

## Tela de espera (QR Code) — repete a cada 90 s

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narrador (Antonio) | Ei, você! Quer descobrir como uma ideia vira tecnologia de verdade? Escaneie o QR Code e comece agora o seu DEV PATH! | `00-espera.mp3` | 9.3 s |

## 1. Terminal — boas-vindas

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narradora (Thalita) | Olá, {nome}! Que bom ter você aqui!<br>*(sem o MP3 com o nome: "Olá! Que bom ter você aqui! Seu DEV PATH começa agora!")* | gerado pelo servidor com o nome (`server/voz.js`; sem nome: `01a-ola-sem-nome.mp3`) | ~3 s |
| narradora (Thalita) | Prepare-se! Você vai percorrer uma jornada de seis semestres e descobrir como uma ideia se transforma em uma solução digital de verdade! | `01-boas-vindas.mp3` | 7.3 s |

## 2. Gancho — interesse escolhido no celular

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narrador (Antonio) | **Criar aplicativos (mobile):** Você escolheu desenvolvimento mobile! Que demais! Durante a jornada, repare como programação, dados, servidores e experiência do usuário vão se conectando até chegar aos aplicativos de celular. | `02-interesse-mobile.mp3` | 12.8 s |
| narrador (Antonio) | **Criar visuais e interfaces (web):** Você escolheu desenvolvimento web! Ótima escolha! Repare como lógica, interfaces, servidores e dados vão se conectando até formar aplicações completas. | `02-interesse-web.mp3` | 11.1 s |
| narrador (Antonio) | **Resolver problemas com lógica (dados):** Você escolheu dados! Excelente! Repare como lógica, estruturas, banco de dados e servidores passam a trabalhar juntos. | `02-interesse-dados.mp3` | 9.3 s |
| narrador (Antonio) | **Ter meu próprio negócio (produto):** Você escolheu produtos digitais! Muito bom! Repare como tecnologia, experiência, prototipagem e negócio passam a se conectar. | `02-interesse-produto.mp3` | 9.8 s |

## 3. Mapa dos 6 semestres

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narradora (Thalita) | Olha só o mapa: seis semestres, da ideia ao lançamento! Cada semestre soma uma camada nova ao que você já sabe. E fica de olho: um produto vai nascer bem aqui, na tela! | `02b-mapa.mp3` | 10.4 s |

## 4. Primeiro semestre

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narradora (Thalita) | Tudo começa aprendendo a pensar como quem cria! No primeiro semestre, você desenvolve raciocínio lógico, conhece os fundamentos da internet, trabalha com conteúdo e design, e transforma uma ideia na sua primeira estrutura digital! | `03-semestre-1.mp3` | 12.2 s |

## 5. Segundo semestre

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narradora (Thalita) | Você já sabe estruturar uma ideia. Agora é hora de dar forma a ela! | `04a-transicao-1-2.mp3` | 4.4 s |
| narrador (Antonio) | E a ideia ganha forma! No segundo semestre, você evolui na criação de interfaces, aprende a organizar informações, entende as redes e descobre a estrutura que existe por trás de toda experiência digital! | `04-semestre-2.mp3` | 12.6 s |

## 6. Terceiro semestre

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narrador (Antonio) | A interface está pronta. Agora o sistema precisa guardar, processar e responder! | `05a-transicao-2-3.mp3` | 6.0 s |
| narradora (Thalita) | No terceiro semestre, o sistema ganha inteligência! Entram banco de dados, programação web, servidores e engenharia de software. A página deixa de ser só visual e passa a receber, processar, armazenar e devolver informações! | `05-semestre-3.mp3` | 13.9 s |

## 7. Quarto semestre

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narradora (Thalita) | O sistema funciona! Agora é hora de conectar as partes e proteger tudo! | `06a-transicao-3-4.mp3` | 4.7 s |
| narrador (Antonio) | Chegou a hora de conectar tudo! Interface, servidor e banco de dados trabalhando juntos. Você também aprende segurança, gestão de projetos e navegação. É aqui que você passa a enxergar o sistema como uma arquitetura completa! | `06-semestre-4.mp3` | 15.1 s |

## 8. Quinto semestre

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narrador (Antonio) | A tecnologia já funciona. Agora ela vai resolver problemas reais, de pessoas reais! | `07a-transicao-4-5.mp3` | 6.6 s |
| narradora (Thalita) | No quinto semestre, a tecnologia vira produto! Desenvolvimento mobile, servidores, prototipagem, usabilidade e marketing se encontram. Você não pensa só em código: você pensa em pessoas, experiência e oportunidades! | `07-semestre-5.mp3` | 13.9 s |

## 9. Sexto semestre

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narradora (Thalita) | Você já sabe construir cada parte. Agora é hora de integrar tudo! | `08a-transicao-5-6.mp3` | 4.3 s |
| narrador (Antonio) | E no sexto semestre, tudo se conecta! Serviços, dispositivos móveis, projeto, empresa e tecnologia trabalhando juntos. É o momento de transformar tudo o que você aprendeu em uma solução completa, pronta para apresentar! | `08-semestre-6.mp3` | 14.8 s |

## 10. O que você vai poder criar

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narradora (Thalita) | E o resultado dessa jornada? Sites, aplicativos, sistemas, serviços digitais, soluções com banco de dados e produtos capazes de resolver problemas reais. Tudo criado por você! | `09-criar.mp3` | 11.4 s |

## 11. Carreiras

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narrador (Antonio) | E esse conhecimento abre muitos caminhos: desenvolvimento web, mobile, back-end, dados, UX e UI, cloud, análise de sistemas, produtos digitais e empreendedorismo! Qual vai ser o seu? | `10-carreiras.mp3` | 13.4 s |

## 12. Tecnologia em todo setor

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narrador (Antonio) | E sabe onde está a tecnologia? Em praticamente todo setor! Na indústria, na loja, no hospital, na prefeitura e no negócio que você vai criar! | `10b-mercado.mp3` | 10.3 s |

## 13. Formação Fatec

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narradora (Thalita) | E tudo isso numa formação pública, gratuita, tecnológica e conectada ao mercado! Um lugar onde cada semestre acrescenta uma peça nova ao que você já aprendeu. | `11-formacao.mp3` | 9.3 s |

## 14. Fechamento, vestibular e crachá

| Quem fala | Texto | Arquivo | Duração |
|---|---|---|---|
| narradora (Thalita) | Talvez o próximo aplicativo, site ou sistema que todo mundo usa seja criado por você! | `12a-fechamento.mp3` | 4.8 s |
| narrador (Antonio) | Não apenas use tecnologia: aprenda a criá-la! Faça o vestibular da Fatec e venha estudar Sistemas para Internet na Fatec Jales! | `12b-fechamento.mp3` | 9.0 s |
| narradora (Thalita) | E olha o seu celular: o seu crachá de dev já está lá! Salve e compartilhe. No celular também estão os links para conhecer mais o curso e para fazer a sua inscrição no vestibular. Te esperamos! | `12c-cracha.mp3` | 11.3 s |

---

Fala total de uma apresentação (perfil mobile, sem a espera): **208 s** de narração, mais as pausas entre as cenas.
