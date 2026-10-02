/*
 * DEV PATH V5 — CONTEÚDO EDITÁVEL
 * ------------------------------------------------------------
 * Todo o texto da apresentação mora aqui. Para mudar uma frase,
 * disciplina ou carreira, edite este arquivo e recarregue a TV.
 *
 * Disciplinas: cada semestre lista TODAS as disciplinas do horário oficial
 * de SI (2º semestre de 2026), em `disciplinas`: [nome oficial, tradução, destaque].
 * A tradução explica a disciplina na linguagem de quem está no ensino médio;
 * as marcadas com destaque (true) ganham cor e aparecem primeiro na TV.
 */
window.DEVPATH = {
  links: {
    vestibular: 'https://www.vestibularfatec.com.br/',
    fatec: 'https://www.fatecjales.edu.br/',
  },

  // Perfis escolhidos no celular. Definem o crachá final e o produto construído na tela.
  profiles: {
    design: {
      label: 'Criar visuais e interfaces',
      role: 'UX/UI & Front-end',
      product: (n) => `Studio ${n}`,
      stack: ['Design Digital', 'Projeto de Navegação e Interação', 'Prototipagem e Usabilidade', 'Acessibilidade'],
      careers: ['UX/UI', 'Front-end', 'Projetos digitais'],
    },
    logic: {
      label: 'Resolver problemas com lógica',
      role: 'Back-end & Dados',
      product: (n) => `${n}.dev`,
      stack: ['Algoritmos e Lógica', 'Estrutura de Dados', 'Banco de Dados e Internet', 'Desenvolvimento para Servidores'],
      careers: ['Back-end', 'Banco de dados', 'Analista de sistemas'],
    },
    apps: {
      label: 'Criar aplicativos',
      role: 'Mobile & Full Stack',
      product: (n) => `${n} App`,
      stack: ['Dispositivos Móveis I e II', 'Programação de Sítios Internet', 'Arquitetura Orientada a Serviços', 'Banco de Dados'],
      careers: ['Mobile', 'Full Stack', 'Back-end'],
    },
    business: {
      label: 'Ter meu próprio negócio',
      role: 'Produtos digitais & Startups',
      product: (n) => `Loja ${n}`,
      stack: ['Negócios e Marketing Eletrônicos', 'Criação de Empresas para Internet', 'Gestão de Projetos', 'Prototipagem e Usabilidade'],
      careers: ['Empreendedor de tecnologia', 'Projetos digitais', 'Consultoria'],
    },
  },

  // Batimento do "medidor de paixão": sobe a cada semestre.
  semesters: [
    {
      n: 1,
      color: 'orange',
      stage: 'Ideia',
      title: 'Aprender a pensar como quem cria',
      hook: 'Tudo que existe na tela começou como uma ideia e um raciocínio.',
      bpm: 72,
      mood: 'curiosidade',
      disciplinas: [
        ['Algoritmos e Lógica de Programação', 'o jeito de pensar por trás de todo app', true],
        ['Design Digital', 'cores, tipografia e composição de telas', true],
        ['Padrões de Projeto de Sítios Internet I', 'sua primeira página no ar', true],
        ['Bases da Internet', 'como a web funciona por dentro'],
        ['Criação de Conteúdo na Web', 'textos, imagens e vídeos que atraem'],
        ['Fundamentos de Matemática Elementar', 'a base dos cálculos da programação'],
        ['Leitura e Produção de Textos', 'comunicar ideias com clareza'],
        ['Inglês I', 'a língua da tecnologia'],
      ],
    },
    {
      n: 2,
      color: 'blue',
      stage: 'Interface',
      title: 'Dar forma às ideias',
      hook: 'O rascunho vira uma interface que dá vontade de usar.',
      bpm: 86,
      mood: 'interesse',
      disciplinas: [
        ['Prática de Design', 'interfaces bonitas e fáceis de usar', true],
        ['Padrões de Projetos de Sítios II', 'layouts que se adaptam a qualquer tela', true],
        ['Redes e Internet', 'como os dispositivos conversam entre si', true],
        ['Estrutura de Dados', 'organizar informação para o código voar'],
        ['Matemática Discreta', 'a matemática por trás dos computadores'],
        ['Legislação Aplicada à Internet', 'direitos, LGPD e regras do mundo digital'],
        ['Inglês II', 'ler documentação e trocar ideias'],
      ],
    },
    {
      n: 3,
      color: 'green',
      stage: 'Dados',
      title: 'Fazer o sistema ganhar inteligência',
      hook: 'A página começa a guardar, buscar e entender informações.',
      bpm: 98,
      mood: 'empolgação',
      disciplinas: [
        ['Banco de Dados e Internet I', 'guardar e encontrar informações', true],
        ['Programação de Sítios Internet', 'páginas que viram sistemas de verdade', true],
        ['Acessibilidade', 'tecnologia que funciona para todas as pessoas', true],
        ['Engenharia de Software para Web', 'planejar sistemas do jeito certo'],
        ['Servidores e seus Sistemas Operacionais', 'as máquinas que mantêm tudo no ar'],
        ['Estatística', 'transformar dados em decisões'],
        ['Inglês III', 'inglês técnico do dia a dia dev'],
      ],
    },
    {
      n: 4,
      color: 'blue',
      stage: 'Conexão',
      title: 'Conectar e proteger sistemas',
      hook: 'Interface, servidor e banco de dados passam a trabalhar juntos — com segurança.',
      bpm: 112,
      mood: 'foco total',
      disciplinas: [
        ['Desenvolvimento para Servidores I', 'o back-end que faz tudo funcionar', true],
        ['Segurança em Sistemas para Internet', 'proteger pessoas e dados', true],
        ['Projeto de Navegação e Interação', 'UX: caminhos que fazem sentido', true],
        ['Banco de Dados e Internet II', 'dados mais rápidos e poderosos'],
        ['Prática de Gestão de Projetos', 'prazos, equipe e entregas'],
        ['Tópicos Especiais em Sistemas para Internet I', 'as novidades do mercado'],
        ['Inglês IV', 'reuniões e apresentações em inglês'],
      ],
    },
    {
      n: 5,
      color: 'orange',
      stage: 'Produto',
      title: 'Transformar tecnologia em produto',
      hook: 'Seu sistema chega ao celular e encontra pessoas reais.',
      bpm: 126,
      mood: 'paixão',
      disciplinas: [
        ['Desenvolvimento para Dispositivos Móveis I', 'seu primeiro app no celular', true],
        ['Projeto de Prototipagem e Teste de Usabilidade', 'testar com pessoas antes de lançar', true],
        ['Negócios e Marketing Eletrônicos', 'tecnologia que vira negócio', true],
        ['Desenvolvimento para Servidores II', 'APIs que aguentam muita gente'],
        ['Projeto do TG em Sistemas para Internet I', 'começa o seu projeto final'],
        ['Tópicos Especiais em Sistemas para Internet II', 'tecnologias em alta'],
        ['Inglês V', 'inglês para a carreira'],
      ],
    },
    {
      n: 6,
      color: 'green',
      stage: 'Lançamento',
      title: 'Integrar, empreender e entregar',
      hook: 'Tudo se conecta: seu projeto sai do papel e vai para o mundo.',
      bpm: 140,
      mood: 'não dá mais pra parar',
      disciplinas: [
        ['Desenvolvimento para Dispositivos Móveis II', 'apps completos e conectados', true],
        ['Arquitetura Orientada a Serviços', 'APIs e sistemas que se integram', true],
        ['Criação de Empresas para Internet', 'sua startup sai do papel', true],
        ['Projeto de TG em Sistemas para Internet II', 'seu projeto final pronto'],
        ['Projeto de Encontrabilidade', 'ser encontrado no Google (SEO)'],
        ['Tópicos Especiais em Sistemas para Internet III', 'o que vem por aí na tecnologia'],
        ['Inglês VI', 'pronto para o mercado global'],
      ],
    },
  ],

  // "O que você vai poder criar" — ícone desenhado em SVG (ver tv.js → ICONS)
  creations: [
    ['site', 'Sites'],
    ['app', 'Aplicativos'],
    ['shop', 'Lojas virtuais'],
    ['dash', 'Dashboards'],
    ['api', 'APIs e integrações'],
    ['proto', 'Protótipos'],
    ['system', 'Sistemas para empresas'],
    ['rocket', 'Seu próprio produto'],
  ],

  // Possibilidades de atuação — não são promessas de cargo.
  careers: [
    'Front-end', 'Back-end', 'Full Stack', 'Mobile', 'UX/UI', 'Banco de dados',
    'Analista de sistemas', 'Qualidade e testes', 'Servidores e cloud', 'Projetos digitais',
    'Consultoria', 'Empreendedor de tecnologia',
  ],

  sectors: [
    'indústrias', 'agronegócio', 'lojas', 'bancos e fintechs', 'hospitais', 'prefeituras',
    'startups', 'agências digitais', 'escritórios', 'e-commerce', 'software houses', 'o seu próprio negócio',
  ],

  fatec: [
    ['Público e gratuito', 'Ensino superior do Centro Paula Souza, sem mensalidade.'],
    ['3 anos, 6 semestres', 'Formação de tecnólogo focada em prática.'],
    ['Inglês do 1º ao 6º', 'A língua da documentação e do mercado global de tecnologia.'],
    ['Projeto final real', 'No Trabalho de Graduação você constrói uma solução do zero.'],
  ],

  axis: {
    name: 'Informação e Comunicação',
    text: 'Tecnologias para criar, processar, armazenar, proteger e compartilhar informações por meio de sistemas digitais e redes.',
  },
};
