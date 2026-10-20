/*
 * DEV PATH V5 — MANIFESTO DA NARRAÇÃO, DA MÚSICA E DOS EFEITOS
 * ------------------------------------------------------------
 * Assim como o content.js guarda os textos da tela, este arquivo guarda o que a TV FALA.
 * Para trocar uma frase, edite o `text`. Para usar uma gravação de verdade, coloque o MP3
 * no caminho de `audio` (veja public/audio/README.md); enquanto o arquivo não existir,
 * a TV lê o `text` com a voz do navegador.
 *
 * Cada cena (a chave é o tipo da cena em tv.js → STEPS; os semestres são journey1…journey6)
 * tem uma lista de `segments`, falados em ordem. Campos de um segmento:
 *   id        nome curto (aparece nos testes e na documentação)
 *   text      o que é dito e mostrado na legenda. {nome} = primeiro nome do visitante
 *   audio     MP3 gravado (opcional). Se existir, tem prioridade sobre a voz do navegador
 *   dynamic   true = fala personalizada (com o nome): sempre pela voz do navegador
 *   fallback  { text, audio } usado quando a fala dinâmica não é possível (sem nome ou sem voz)
 *   profile   só toca para quem escolheu esse interesse no celular (design, logic, apps, business)
 *   voice     'female' ou 'male': quem fala este trecho (sem isso, vale o `voice` da cena)
 *   markers   [{ word, action, target, label, time }] — quando a narração chega em `word`,
 *             a TV executa `action` (highlight = acende o que contém `target`;
 *             unlock = "COMPETÊNCIA DESBLOQUEADA ✓" com `label`).
 *             `time` (segundos dentro do MP3) é opcional: sem ele, o tempo é calculado pela posição da palavra.
 *
 * Campos da cena:
 *   voice     'female' (narradora) ou 'male' (narrador). As cenas se alternam, e cada transição
 *             entre semestres é dita por quem narrou o semestre anterior, como um diálogo.
 *   hold      segundos parados na tela depois que a narração termina (padrão: config.hold)
 * Cenas sem entrada aqui (map, market) não têm narração e usam a duração de STEPS.
 * A duração de STEPS também é o "durationFallback": vale quando não há voz nenhuma.
 */
window.DEVPATH_NARRACAO = {
  config: {
    narration: true,          // false = apresentação sem voz (a música e os efeitos continuam)
    captions: true,           // legenda na TV ao ligar (tecla L ou painel alternam)
    hold: 1.2,                // pausa padrão depois de cada narração, em segundos
    idleCallEvery: 90,        // a cada quantos segundos a TV chama quem passa (0 = nunca)

    // Volumes de 0 a 1. Música baixa; durante a voz ela abaixa ainda mais (ducking).
    volume: {
      music: 0.12,            // música sem narração (0,10 a 0,14)
      musicDucked: 0.045,     // música durante a narração (0,035 a 0,055)
      narration: 0.95,        // narração (0,90 a 1,00)
      sfx: 0.18,              // efeitos (0,12 a 0,25)
    },
    duckMs: 700,              // tempo para a música abaixar quando a voz começa
    restoreMs: 900,           // tempo para a música voltar quando a voz termina

    // trilha (ferramentas/gerar_musica.py compõe as três opções):
    //   opcao-1-synthwave.mp3 · opcao-2-future-house.mp3 · opcao-3-electro-pop.mp3
    music: 'audio/music/opcao-3-electro-pop.mp3',
    synthMusic: true,         // sem o MP3 acima, o navegador sintetiza uma trilha discreta (false = silêncio)
    sfx: {
      transition: 'audio/sfx/transition.mp3',
      unlock: 'audio/sfx/unlock.mp3',
      start: 'audio/sfx/start.mp3',
      final: 'audio/sfx/final.mp3',
    },
    synthSfx: true,           // sem os MP3 acima, efeitos sintetizados bem curtos (false = sem efeitos)

    // A narração principal são os MP3 gerados com vozes neurais (ferramentas/gerar_narracao.py):
    // Thalita (narradora) e Antonio (narrador). A voz do navegador só entra no "Olá, {nome}."
    // (não dá para gravar todos os nomes) e se faltar algum MP3. Para combinar com os MP3, a TV abre
    // no Edge, que tem as mesmas vozes "Online (Natural)"; sem internet, Maria e Daniel do Windows.
    voice: {
      female: { prefer: ['Thalita', 'Francisca', 'Maria'] },
      male: { prefer: ['Antonio', 'Donato', 'Fabio', 'Julio', 'Daniel'] },
      avoid: ['Google'],     // vozes que nunca devem ser usadas (soam robotizadas)
      lang: 'pt-BR',
      rate: 1.0,
      pitch: 1.0,
    },
  },

  scenes: {
    /* tela de espera (QR Code): chamada que se repete a cada config.idleCallEvery segundos */
    idle: {
      voice: 'male',
      segments: [
        { id: 'espera', audio: 'audio/narration/00-espera.mp3',
          text: 'Quer descobrir como uma ideia se transforma em tecnologia? Escaneie o QR Code e comece seu DEV PATH.' },
      ],
    },

    /* 1. terminal: boas-vindas com o nome */
    boot: {
      voice: 'female',
      segments: [
        { id: 'ola', dynamic: true, text: 'Olá, {nome}.',
          fallback: { text: 'Olá. Seu DEV PATH começa agora.', audio: 'audio/narration/01a-ola-sem-nome.mp3' } },
        { id: 'boas-vindas', audio: 'audio/narration/01-boas-vindas.mp3',
          text: 'A partir de agora, você vai percorrer uma jornada de seis semestres e descobrir como uma ideia pode se transformar em uma solução digital de verdade.' },
      ],
    },

    /* 2. gancho: introdução do interesse escolhido no celular */
    hook: {
      voice: 'male',
      segments: [
        { id: 'interesse-mobile', profile: 'apps', audio: 'audio/narration/02-interesse-mobile.mp3',
          text: 'Você escolheu desenvolvimento mobile. Durante a jornada, observe como programação, dados, servidores e experiência do usuário vão se conectando até chegar ao desenvolvimento para dispositivos móveis.' },
        { id: 'interesse-web', profile: 'design', audio: 'audio/narration/02-interesse-web.mp3',
          text: 'Você escolheu desenvolvimento web. Observe como lógica, interfaces, servidores e dados vão se conectando até formar aplicações completas.' },
        { id: 'interesse-dados', profile: 'logic', audio: 'audio/narration/02-interesse-dados.mp3',
          text: 'Você escolheu dados. Repare como lógica, estruturas, banco de dados e servidores passam a trabalhar juntos.' },
        { id: 'interesse-produto', profile: 'business', audio: 'audio/narration/02-interesse-produto.mp3',
          text: 'Você escolheu produtos digitais. Observe como tecnologia, experiência, prototipagem e negócio passam a se conectar.' },
      ],
    },

    /* 4–9. os seis semestres (a transição entra no começo do semestre seguinte) */
    journey1: {
      voice: 'female',
      segments: [
        { id: 'semestre-1', audio: 'audio/narration/03-semestre-1.mp3',
          text: 'Tudo começa aprendendo a pensar como quem cria. No primeiro semestre, você desenvolve raciocínio lógico, conhece os fundamentos da internet, começa a trabalhar com conteúdo, design e descobre como transformar uma ideia em uma primeira estrutura digital.',
          markers: [
            { word: 'raciocínio lógico', action: 'highlight', target: 'Algoritmos' },
            { word: 'fundamentos da internet', action: 'highlight', target: 'Bases da Internet' },
            { word: 'conteúdo', action: 'highlight', target: 'Criação de Conteúdo' },
            { word: 'design', action: 'highlight', target: 'Design Digital' },
            { word: 'primeira estrutura digital', action: 'unlock', label: 'Pensar como quem cria' },
          ] },
      ],
    },
    journey2: {
      voice: 'male',
      segments: [
        { id: 'transicao-1-2', voice: 'female', audio: 'audio/narration/04a-transicao-1-2.mp3',
          text: 'Agora que você aprendeu a estruturar uma ideia, chegou a hora de dar forma a ela.' },
        { id: 'semestre-2', audio: 'audio/narration/04-semestre-2.mp3',
          text: 'Agora a ideia começa a ganhar forma. No segundo semestre, você evolui na criação de interfaces, aprende a organizar informações, compreende melhor as redes e passa a entender a estrutura que existe por trás de uma experiência digital.',
          markers: [
            { word: 'criação de interfaces', action: 'highlight', target: 'Prática de Design' },
            { word: 'organizar informações', action: 'highlight', target: 'Estrutura de Dados' },
            { word: 'redes', action: 'highlight', target: 'Redes e Internet' },
            { word: 'experiência digital', action: 'unlock', label: 'Dar forma às ideias' },
          ] },
      ],
    },
    journey3: {
      voice: 'female',
      segments: [
        { id: 'transicao-2-3', voice: 'male', audio: 'audio/narration/05a-transicao-2-3.mp3',
          text: 'A interface já existe. Agora o sistema precisa começar a guardar, processar e responder.' },
        { id: 'semestre-3', audio: 'audio/narration/05-semestre-3.mp3',
          text: 'No terceiro semestre, o sistema começa a ganhar inteligência. Entram banco de dados, programação web, servidores e engenharia de software. A página deixa de ser apenas visual e começa a receber, processar, armazenar e devolver informações.',
          markers: [
            { word: 'banco de dados', action: 'highlight', target: 'banco de dados' },
            { word: 'programação web', action: 'highlight', target: 'Programação de Sítios' },
            { word: 'servidores', action: 'highlight', target: 'Servidores e seus' },
            { word: 'engenharia de software', action: 'highlight', target: 'Engenharia de Software' },
            { word: 'devolver informações', action: 'unlock', label: 'Sistemas com inteligência' },
          ] },
      ],
    },
    journey4: {
      voice: 'male',
      segments: [
        { id: 'transicao-3-4', voice: 'female', audio: 'audio/narration/06a-transicao-3-4.mp3',
          text: 'Agora que o sistema funciona, chegou a hora de conectar suas partes e protegê-las.' },
        { id: 'semestre-4', audio: 'audio/narration/06-semestre-4.mp3',
          text: 'Chegou a hora de conectar as partes. Interface, servidor e banco de dados passam a trabalhar juntos. Você também aprende sobre segurança, gestão de projetos e navegação. É aqui que começa a enxergar o sistema como uma arquitetura completa.',
          markers: [
            { word: 'servidor', action: 'highlight', target: 'servidor' },
            { word: 'segurança', action: 'highlight', target: 'Segurança' },
            { word: 'gestão de projetos', action: 'highlight', target: 'Gestão de Projetos' },
            { word: 'navegação', action: 'highlight', target: 'Navegação' },
            { word: 'arquitetura completa', action: 'unlock', label: 'Arquitetura completa' },
          ] },
      ],
    },
    journey5: {
      voice: 'female',
      segments: [
        { id: 'transicao-4-5', voice: 'male', audio: 'audio/narration/07a-transicao-4-5.mp3',
          text: 'A tecnologia já funciona. Agora ela precisa resolver problemas reais para pessoas reais.' },
        { id: 'semestre-5', audio: 'audio/narration/07-semestre-5.mp3',
          text: 'No quinto semestre, tecnologia começa a se transformar em produto. Desenvolvimento mobile, servidores, prototipagem, usabilidade e marketing se encontram. Você não pensa apenas em código. Você começa a pensar em pessoas, experiência e oportunidades.',
          markers: [
            { word: 'mobile', action: 'highlight', target: 'Dispositivos Móveis' },
            { word: 'servidores', action: 'highlight', target: 'Servidores II' },
            { word: 'prototipagem', action: 'highlight', target: 'Prototipagem' },
            { word: 'marketing', action: 'highlight', target: 'Marketing' },
            { word: 'oportunidades', action: 'unlock', label: 'Tecnologia vira produto' },
          ] },
      ],
    },
    journey6: {
      voice: 'male',
      segments: [
        { id: 'transicao-5-6', voice: 'female', audio: 'audio/narration/08a-transicao-5-6.mp3',
          text: 'Você já aprendeu a construir as partes. Agora é hora de integrar tudo.' },
        { id: 'semestre-6', audio: 'audio/narration/08-semestre-6.mp3',
          text: 'E no sexto semestre, tudo se conecta. Serviços, dispositivos móveis, projeto, empresa e tecnologia trabalham juntos. É o momento de integrar o conhecimento e transformar o que você aprendeu em uma solução completa e apresentável.',
          markers: [
            { word: 'serviços', action: 'highlight', target: 'Orientada a Serviços' },
            { word: 'dispositivos móveis', action: 'highlight', target: 'Dispositivos Móveis II' },
            { word: 'projeto', action: 'highlight', target: 'Projeto de TG' },
            { word: 'empresa', action: 'highlight', target: 'Criação de Empresas' },
            { word: 'solução completa', action: 'unlock', label: 'Solução completa e apresentável' },
          ] },
      ],
    },

    /* 10. o que você vai poder criar */
    create: {
      voice: 'female',
      segments: [
        { id: 'criar', audio: 'audio/narration/09-criar.mp3',
          text: 'E o resultado dessa jornada? Sites, aplicativos, sistemas, serviços digitais, soluções com banco de dados e produtos capazes de resolver problemas reais.',
          markers: [
            { word: 'Sites', action: 'highlight', target: 'Sites' },
            { word: 'aplicativos', action: 'highlight', target: 'Aplicativos' },
            { word: 'sistemas', action: 'highlight', target: 'Sistemas para empresas' },
            { word: 'serviços digitais', action: 'highlight', target: 'APIs' },
            { word: 'banco de dados', action: 'highlight', target: 'Dashboards' },
            { word: 'produtos', action: 'highlight', target: 'próprio produto' },
          ] },
      ],
    },

    /* 11. carreiras */
    careers: {
      voice: 'male',
      segments: [
        { id: 'carreiras', audio: 'audio/narration/10-carreiras.mp3',
          text: 'Esse conhecimento abre diferentes caminhos: desenvolvimento web, mobile, back-end, dados, UX e UI, cloud, análise de sistemas, produtos digitais e empreendedorismo.',
          markers: [
            { word: 'web', action: 'highlight', target: 'Front-end' },
            { word: 'mobile', action: 'highlight', target: 'Mobile' },
            { word: 'back-end', action: 'highlight', target: 'Back-end' },
            { word: 'dados', action: 'highlight', target: 'Banco de dados' },
            { word: 'UX e UI', action: 'highlight', target: 'UX/UI' },
            { word: 'cloud', action: 'highlight', target: 'cloud' },
            { word: 'análise de sistemas', action: 'highlight', target: 'Analista de sistemas' },
            { word: 'produtos digitais', action: 'highlight', target: 'Projetos digitais' },
            { word: 'empreendedorismo', action: 'highlight', target: 'Empreendedor' },
          ] },
      ],
    },

    /* 13. formação Fatec */
    fatec: {
      voice: 'female',
      segments: [
        { id: 'formacao', audio: 'audio/narration/11-formacao.mp3',
          text: 'Tudo isso em uma formação pública, tecnológica e conectada às necessidades do mercado. Um ambiente onde cada semestre acrescenta uma nova peça ao que você já aprendeu.',
          markers: [
            { word: 'pública', action: 'highlight', target: 'Público e gratuito' },
            { word: 'cada semestre', action: 'highlight', target: '6 semestres' },
          ] },
      ],
    },

    /* 14. fechamento + crachá: os dois narradores fecham juntos; a chamada fica alguns segundos na tela */
    finale: {
      voice: 'female',
      hold: 6,
      segments: [
        { id: 'fechamento-a', audio: 'audio/narration/12a-fechamento.mp3',
          text: 'Talvez o próximo aplicativo, site ou sistema que alguém usa todos os dias seja criado por você.' },
        { id: 'fechamento-b', voice: 'male', audio: 'audio/narration/12b-fechamento.mp3',
          text: 'Não apenas use tecnologia. Aprenda a criá-la. Seja Fatec com o curso de Sistemas para Internet.' },
      ],
    },
  },
};
