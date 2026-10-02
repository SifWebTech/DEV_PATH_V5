/*
 * DEV PATH V5 — TV / apresentação
 * ------------------------------------------------------------
 * Palco fixo de 1920×1080 escalado para a tela. A apresentação é
 * uma lista de cenas (STEPS) com duração própria. Os seis semestres
 * compartilham a mesma cena ("journey"): em vez de trocar de slide,
 * o produto na tela evolui de rascunho até um app lançado.
 *
 * Para mudar textos e disciplinas, edite js/content.js.
 * Para mudar a duração das cenas, edite STEPS logo abaixo.
 */
(() => {
  'use strict';
  const C = window.DEVPATH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = $('#stage');
  const root = $('#sceneRoot');
  const COLOR = { orange: '#ff7a1a', green: '#2bff88', blue: '#22b8ff', white: '#f3f8ff' };

  /* ---------- linha do tempo (duração em segundos) ---------- */
  const STEPS = [
    { type: 'boot', dur: 8, label: 'Inicializando seu futuro' },
    { type: 'hook', dur: 8, label: 'Você e a tecnologia' },
    { type: 'map', dur: 8, label: 'O caminho em 6 semestres' },
    ...C.semesters.map((s) => ({ type: 'journey', sem: s.n, dur: 15, label: `${s.n}º semestre: ${s.stage}` })),
    { type: 'create', dur: 10, label: 'O que você vai poder criar' },
    { type: 'careers', dur: 10, label: 'Onde você pode chegar' },
    { type: 'market', dur: 8, label: 'Tecnologia em todo lugar' },
    { type: 'fatec', dur: 10, label: 'Por que a Fatec' },
    { type: 'finale', dur: 18, label: 'Seu crachá de dev' },
  ];

  const S = {
    online: false,
    mobileUrl: '',
    todayCount: 0,
    queueNext: [],
    lead: null,      // { id, name, interest } — null no modo ocioso
    i: -1,
    timer: null,
    paused: false,
    stepEnds: 0,
    remaining: 0,
    token: 0,        // invalida animações assíncronas da cena anterior
  };

  const firstName = () => (S.lead?.name || '').split(' ')[0];
  const profile = () => C.profiles[S.lead?.interest] || C.profiles.apps;
  const productName = () => profile().product(firstName() || 'Dev');
  const domain = () => productName().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '') + '.com.br';

  /* ---------- palco escalado ---------- */
  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit);
  fit();

  /* ---------- efeito "decodificar" nos títulos ---------- */
  const GLYPHS = '<>/{}[]#$01=+*_;';
  function scramble(el, delay = 0, dur = 900) {
    const text = el.dataset.text ?? el.textContent;
    el.dataset.text = text;
    if (reduced) { el.textContent = text; return; }
    const token = S.token;
    el.textContent = text.replace(/\S/g, ' ');
    setTimeout(() => {
      const t0 = performance.now();
      const tick = (now) => {
        if (token !== S.token) return;
        const p = Math.min((now - t0) / dur, 1);
        const n = Math.floor(p * text.length);
        el.textContent = text.slice(0, n) + text.slice(n).replace(/\S/g, () => (Math.random() < p + 0.15 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ' '));
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = text;
      };
      requestAnimationFrame(tick);
    }, delay);
  }
  const scrambleAll = (el) => $$('[data-scramble]', el).forEach((n) => scramble(n, Number(n.dataset.scramble) || 0));

  /* ---------- troca de cena ---------- */
  function swapScene(html, mount) {
    S.token++;
    // marca TODAS as cenas ainda visíveis (avançar rápido pode deixar mais de uma na tela)
    $$('.scene:not(.is-out)', root).forEach((old) => {
      old.classList.add('is-out');
      // tira os ids da cena que sai, para a nova não ser confundida com ela
      [old, ...old.querySelectorAll('[id]')].forEach((n) => n.removeAttribute('id'));
      setTimeout(() => old.remove(), 600);
    });
    flash();
    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    const el = wrap.firstElementChild;
    root.appendChild(el);
    scrambleAll(el);
    mount?.(el);
    return el;
  }

  function flash() {
    const f = $('#flash');
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  /* ============================================================
   * CENAS
   * ============================================================ */

  /* ---------- ocioso: QR Code ---------- */
  function renderIdle() {
    stage.dataset.scene = 'idle';
    circuit.setEnergy(0.12);
    const next = S.queueNext.length ? `<p class="idle-next">Em seguida na tela: <b>${S.queueNext.map(esc).join(', ')}</b></p>` : '';
    swapScene(`
      <section class="scene scene-idle">
        <div class="idle-copy">
          <p class="kicker">// curso superior de tecnologia, gratuito, em 3 anos</p>
          <h1 class="idle-title">
            <span data-scramble="0">Não apenas</span>
            <span data-scramble="200">use tecnologia.</span>
            <span class="c-green" data-scramble="500">Aprenda a criá-la.</span>
          </h1>
          <p class="idle-sub">Sistemas para Internet transforma criatividade, lógica e tecnologia em aplicações que funcionam no mundo real.</p>
          ${next}
          <ul class="idle-feed" id="idleFeed"></ul>
        </div>
        <div class="idle-qr">
          <div class="qr-frame">
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
            <div id="qr" class="qr"></div>
            <span class="qr-scan"></span>
          </div>
          <p class="qr-cta">Aponte a câmera do celular</p>
          <ol class="qr-steps">
            <li><b>1</b>Faça seu cadastro</li>
            <li><b>2</b>Toque em começar</li>
            <li><b>3</b>Assista aqui na tela</li>
          </ol>
          <p class="qr-url" id="qrUrl"></p>
          <p class="idle-count"><b id="todayCount">${S.todayCount}</b> futuros devs conectados hoje</p>
        </div>
      </section>`, () => drawQR());
    updateHud();
  }

  function drawQR() {
    const box = $('#qr');
    if (!box) return;
    const url = S.online ? S.mobileUrl : C.links.vestibular;
    $('#qrUrl').textContent = S.online ? url.replace(/^https?:\/\//, '') : 'Modo demonstração: pressione Enter para começar';
    box.innerHTML = qrSvg(url);
  }

  function qrSvg(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#f3f8ff"/><path d="${d}" fill="#040816"/></svg>`;
  }

  /* ---------- 1. boot: terminal ---------- */
  function renderBoot() {
    const n = firstName();
    const lines = [
      ['cmd', `$ devpath init --curso "sistemas-para-internet"`],
      ['out', `> conectando ${n || 'novo dev'} ao futuro`, ' ok'],
      ['out', '> carregando 6 semestres', ' ok'],
      ['out', '> público, gratuito, 3 anos, Fatec Jales', ' ok'],
      ['bar', '> compilando sua jornada'],
      ['done', `✓ pronto. vamos nessa${n ? ', ' + n : ''}.`],
    ];
    swapScene(`
      <section class="scene scene-boot">
        <div class="term">
          <div class="term-bar"><i></i><i></i><i></i><span>~/fatec-jales/sistemas-para-internet</span></div>
          <div class="term-body" id="termBody"></div>
        </div>
      </section>`, async () => {
      const token = S.token;
      const body = $('#termBody');
      for (const [kind, text, ok] of lines) {
        if (token !== S.token) return;
        const p = document.createElement('p');
        p.className = 't-' + kind;
        body.appendChild(p);
        await type(p, text, kind === 'cmd' ? 28 : 14, token);
        if (ok) { await wait(160); p.insertAdjacentHTML('beforeend', `<span class="t-ok">${ok}</span>`); }
        if (kind === 'bar') {
          p.insertAdjacentHTML('beforeend', ' <span class="t-progress"><i></i></span> <span class="t-pct">0%</span>');
          const pct = $('.t-pct', p);
          for (let k = 0; k <= 100; k += 4) { if (token !== S.token) return; pct.textContent = k + '%'; await wait(28); }
        }
        await wait(kind === 'cmd' ? 380 : 220);
      }
      body.insertAdjacentHTML('beforeend', '<p class="t-cursor">_</p>');
    });
  }

  async function type(el, text, speed, token) {
    if (reduced) { el.textContent = text; return; }
    for (let k = 1; k <= text.length; k++) {
      if (token !== S.token) return;
      el.textContent = text.slice(0, k);
      await wait(speed);
    }
  }

  /* ---------- 2. gancho ---------- */
  function renderHook() {
    const n = firstName();
    const apps = ['mensagens', 'música', 'delivery', 'banco', 'mapas', 'jogos', 'vídeos', 'compras', 'fotos', 'transporte', 'redes sociais', 'estudos'];
    swapScene(`
      <section class="scene scene-hook">
        <div class="hook-apps" aria-hidden="true">
          ${apps.map((a, k) => `<span style="--k:${k};--x:${(k * 157) % 100}%;--y:${(k * 73) % 100}%">${a}</span>`).join('')}
        </div>
        <h1 class="hook-a" data-scramble="200">${esc(n ? n + ', você' : 'Você')} usa tecnologia o dia inteiro.</h1>
        <h1 class="hook-b c-orange" data-scramble="3400">Em 3 anos, você aprende a criá-la.</h1>
      </section>`);
  }

  /* ---------- 3. mapa dos 6 semestres ---------- */
  function renderMap() {
    const xs = C.semesters.map((_, k) => 160 + k * 320);
    swapScene(`
      <section class="scene scene-map">
        <h1 class="map-title"><span data-scramble="0">6 semestres.</span> <span class="c-blue" data-scramble="400">Da ideia ao lançamento.</span></h1>
        <svg class="map-graph" viewBox="0 0 1920 420" aria-hidden="true">
          <path class="map-line" d="M60 210 H1860" />
          <path class="map-branch" d="M${xs[4]} 210 C ${xs[4] + 120} 210, ${xs[4] + 80} 90, ${xs[4] + 200} 90 H ${xs[5] - 60} C ${xs[5] - 10} 90, ${xs[5] - 30} 210, ${xs[5]} 210" />
          ${C.semesters.map((s, k) => `
            <g class="map-node" style="--k:${k};--c:${COLOR[s.color]}">
              <circle cx="${xs[k]}" cy="210" r="34" />
              <circle class="ring" cx="${xs[k]}" cy="210" r="48" />
              <text x="${xs[k]}" y="222">${String(s.n).padStart(2, '0')}</text>
              <text class="lbl" x="${xs[k]}" y="310">${s.stage}</text>
            </g>`).join('')}
          <text class="map-tg" x="${(xs[4] + xs[5]) / 2}" y="66" text-anchor="middle">projeto final (TG)</text>
        </svg>
        <p class="map-sub">Cada semestre soma uma camada nova ao que você já sabe. Repare no produto que vai nascer na tela.</p>
      </section>`);
  }

  /* ---------- 4. jornada: os 6 semestres ---------- */
  const CODE = {
    1: ['index.html', [['tag', '<h1>'], ['txt', 'Olá, mundo!'], ['tag', '</h1>'], ['nl'], ['tag', '<p>'], ['txt', 'Minha primeira página'], ['tag', '</p>'], ['nl'], ['tag', '<button>'], ['txt', 'Começar'], ['tag', '</button>']]],
    2: ['style.css', [['key', '.hero'], ['txt', ' {'], ['nl'], ['prop', '  background'], ['txt', ': '], ['str', 'linear-gradient(#22b8ff, #2bff88)'], ['txt', ';'], ['nl'], ['prop', '  border-radius'], ['txt', ': '], ['num', '24px'], ['txt', ';'], ['nl'], ['txt', '}']]],
    3: ['consulta.sql', [['key', 'SELECT'], ['txt', ' nome, preco'], ['nl'], ['key', 'FROM'], ['txt', ' produtos'], ['nl'], ['key', 'WHERE'], ['txt', ' ativo = '], ['num', 'true'], ['txt', ';']]],
    4: ['server.js', [['txt', 'app.'], ['key', 'post'], ['txt', '('], ['str', "'/login'"], ['txt', ', '], ['key', 'async'], ['txt', ' (req, res) => {'], ['nl'], ['key', '  const'], ['txt', ' user = '], ['key', 'await'], ['txt', ' auth(req.body);'], ['nl'], ['txt', '  res.json({ ok: '], ['num', 'true'], ['txt', ' });'], ['nl'], ['txt', '});']]],
    5: ['App.jsx', [['tag', '<Screen'], ['prop', ' title'], ['txt', '='], ['str', '"{produto}"'], ['tag', '>'], ['nl'], ['tag', '  <ProductList'], ['prop', ' data'], ['txt', '={produtos} '], ['tag', '/>'], ['nl'], ['tag', '  <Checkout'], ['prop', ' pix'], ['tag', ' />'], ['nl'], ['tag', '</Screen>']]],
    6: ['terminal', [['key', '$ '], ['txt', 'git push origin main'], ['nl'], ['ok', '✓ testes aprovados'], ['nl'], ['ok', '✓ build concluído'], ['nl'], ['ok', '✓ no ar: '], ['str', '{dominio}']]],
  };
  const PRODUCTS = [['Açaí da Praça', 'R$ 14,90'], ['Camiseta Dev', 'R$ 49,90'], ['Agenda Online', 'grátis']];

  function renderJourney(n) {
    stage.dataset.scene = 'journey';
    swapScene(`
      <section class="scene scene-journey" id="journey">
        <ol class="track" id="jTrack">
          ${C.semesters.map((s) => `<li style="--c:${COLOR[s.color]}"><b>${String(s.n).padStart(2, '0')}</b><span>${s.stage}</span></li>`).join('')}
        </ol>

        <div class="j-copy">
          <p class="j-kicker"><b id="jNum">01</b><span>/06 semestre</span></p>
          <h2 class="j-title" id="jTitle"></h2>
          <p class="j-hook" id="jHook"></p>
          <p class="j-unlock-label" id="jCount">disciplinas do semestre</p>
          <ul class="unlocks" id="jUnlocks"></ul>

          <div class="love">
            <div class="love-head">
              <svg class="love-heart" id="heart" viewBox="0 0 32 29" aria-hidden="true"><path d="M16 28 3.2 15.4A8 8 0 0 1 16 4.6a8 8 0 0 1 12.8 10.8Z"/></svg>
              <p><b id="bpm">72</b> bpm <span id="mood">curiosidade</span></p>
              <span class="love-label">sua paixão pelo curso</span>
            </div>
            <canvas id="ekg" width="740" height="72"></canvas>
            <div class="love-bar"><i id="loveBar"></i></div>
          </div>
        </div>

        <div class="build" id="build">
          <p class="users" id="users"><i></i><b id="usersN">0</b> pessoas usando agora</p>
          <div class="node node-db"><svg viewBox="0 0 48 56"><ellipse cx="24" cy="9" rx="20" ry="7"/><path d="M4 9v38c0 4 9 7 20 7s20-3 20-7V9M4 22c0 4 9 7 20 7s20-3 20-7M4 35c0 4 9 7 20 7s20-3 20-7"/></svg><span>banco de dados</span></div>
          <div class="node node-server"><svg viewBox="0 0 52 52"><rect x="3" y="4" width="46" height="18" rx="4"/><rect x="3" y="30" width="46" height="18" rx="4"/><circle cx="12" cy="13" r="2.5"/><circle cx="12" cy="39" r="2.5"/><path d="M22 13h18M22 39h18"/></svg><span>servidor + API</span></div>
          <svg class="wires" viewBox="0 0 900 780" aria-hidden="true">
            <path class="wire wire-db" d="M790 200 C 740 200, 760 260, 712 260" />
            <path class="wire wire-srv" d="M790 420 C 740 420, 760 360, 712 360" />
            <path class="wire wire-link" d="M836 250 V 370" />
          </svg>

          <div class="browser">
            <div class="b-bar">
              <i></i><i></i><i></i>
              <div class="b-url"><svg class="lock" viewBox="0 0 16 18"><rect x="2" y="8" width="12" height="9" rx="2"/><path d="M5 8V5a3 3 0 0 1 6 0v3"/></svg><span id="bUrl">rascunho.html</span></div>
              <span class="b-live">online</span>
            </div>
            <div class="site">
              <nav class="s-nav"><b class="s-logo" id="sLogo"></b><span></span><span></span><span></span><em class="s-login">entrar</em></nav>
              <div class="s-hero"><h4 id="sHero">Olá, mundo!</h4><p>Minha primeira página</p><button tabindex="-1">Começar</button></div>
              <div class="s-cards">
                ${PRODUCTS.map(([t, p]) => `<div class="s-card"><i class="thumb"></i><b>${t}</b><small>${p}</small></div>`).join('')}
              </div>
              <svg class="s-chart" viewBox="0 0 200 60"><path d="M0 52 L30 44 L55 47 L85 30 L110 34 L140 18 L170 20 L200 4"/></svg>
              <div class="heat"><i style="left:22%;top:30%"></i><i style="left:68%;top:46%"></i><i style="left:40%;top:76%"></i><i style="left:84%;top:18%"></i></div>
            </div>
          </div>

          <div class="phone">
            <div class="p-notch"></div>
            <div class="p-screen">
              <b class="p-logo" id="pLogo"></b>
              <div class="p-hero"></div>
              ${PRODUCTS.map(([t, p]) => `<div class="p-row"><i></i><span>${t}</span><small>${p}</small></div>`).join('')}
              <div class="p-cta">comprar com Pix</div>
            </div>
          </div>

          <div class="editor">
            <div class="e-tab"><i></i><span id="eTab">index.html</span></div>
            <pre id="eCode"></pre>
          </div>

          <div class="confetti" id="confetti"></div>
        </div>

      </section>`, () => { startEkg(); updateJourney(n); });
  }

  function updateJourney(n) {
    const s = C.semesters[n - 1];
    const j = $('#journey');
    const token = ++S.token;
    const c = COLOR[s.color];
    j.style.setProperty('--c', c);
    j.dataset.level = n;
    flash();

    // trilha superior
    $$('#jTrack li').forEach((li, k) => {
      li.classList.toggle('done', k < n - 1);
      li.classList.toggle('on', k === n - 1);
    });

    // texto
    $('#jNum').textContent = String(n).padStart(2, '0');
    const title = $('#jTitle');
    title.dataset.text = s.title;
    scramble(title, 0, 700);
    const hook = $('#jHook');
    hook.classList.remove('in'); void hook.offsetWidth;
    hook.textContent = s.hook;
    hook.classList.add('in');

    // todas as disciplinas do semestre: nome oficial em evidência, tradução embaixo
    $('#jCount').textContent = `as ${s.disciplinas.length} disciplinas do ${n}º semestre`;
    $('#jUnlocks').innerHTML = s.disciplinas.map(([official, plain, star], k) => `
      <li style="--k:${k}"${star ? ' class="star"' : ''}>
        <b>${esc(official).replace(/ ([IVX]+)$/, '\u00a0$1')}</b><small>${esc(plain)}</small>
      </li>`).join(''); // \u00a0 = espaço que não quebra: o "I" não fica sozinho na linha

    // medidor de paixão
    $('#bpm').textContent = s.bpm;
    $('#mood').textContent = s.mood;
    $('#loveBar').style.width = (n / 6) * 100 + '%';
    $('#heart').style.animationDuration = 60 / s.bpm + 's';
    ekg.bpm = s.bpm;
    ekg.color = c;

    // produto em construção
    const build = $('#build');
    for (let k = 1; k <= 6; k++) build.classList.toggle('l' + k, k <= n);
    $('#sLogo').textContent = n >= 2 ? productName() : 'logo';
    $('#pLogo').textContent = productName();
    $('#sHero').textContent = n >= 3 ? `Bem-vindo à ${productName()}` : 'Olá, mundo!';
    $('.s-hero p').textContent = n >= 3 ? 'Peça online e receba rapidinho.' : 'Minha primeira página';
    $('#bUrl').textContent = n >= 6 ? domain() : n >= 4 ? 'https://' + domain() : n >= 2 ? 'localhost:3000' : 'rascunho.html';
    typeCode(n, token);

    circuit.setEnergy(0.12 + n * 0.14);
    if (n === 6) launch(token);
  }

  async function typeCode(n, token) {
    const [file, segs] = CODE[n];
    $('#eTab').textContent = file;
    const pre = $('#eCode');
    pre.innerHTML = '';
    await wait(500);
    for (const [cls, raw] of segs) {
      if (token !== S.token) return;
      if (cls === 'nl') { pre.appendChild(document.createTextNode('\n')); continue; }
      const text = raw.replace('{produto}', productName()).replace('{dominio}', domain());
      const span = document.createElement('span');
      span.className = 'k-' + cls;
      pre.appendChild(span);
      await type(span, text, 22, token);
    }
  }

  async function launch(token) {
    await wait(1600);
    if (token !== S.token) return;
    circuit.burst(70);
    const box = $('#confetti');
    const colors = Object.values(COLOR);
    box.innerHTML = Array.from({ length: 90 }, (_, k) => {
      const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 420;
      return `<i style="--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 120}px;--r:${Math.random() * 720}deg;--d:${Math.random() * 0.3}s;background:${colors[k % 4]}"></i>`;
    }).join('');
    const out = $('#usersN');
    const target = 1284, t0 = performance.now();
    const tick = (now) => {
      if (token !== S.token) return;
      const p = Math.min((now - t0) / 3500, 1);
      out.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('pt-BR');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* eletrocardiograma do medidor de paixão */
  const ekg = { bpm: 72, color: COLOR.orange, raf: 0 };
  function startEkg() {
    cancelAnimationFrame(ekg.raf);
    const cv = $('#ekg');
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height, mid = H * 0.62, speed = 220;
    const wave = (ph) => {
      const bump = (c, w, h) => h * Math.exp(-((ph - c) ** 2) / (2 * w * w));
      return bump(0.12, 0.025, 0.12) - bump(0.28, 0.008, 0.18) + bump(0.31, 0.01, 1) - bump(0.34, 0.01, 0.3) + bump(0.55, 0.04, 0.22);
    };
    const t0 = performance.now();
    const draw = (now) => {
      if (!document.body.contains(cv)) return;
      const t = (now - t0) / 1000;
      const bps = ekg.bpm / 60;
      g.clearRect(0, 0, W, H);
      g.lineWidth = 3;
      g.lineJoin = 'round';
      g.strokeStyle = ekg.color;
      g.shadowColor = ekg.color;
      g.shadowBlur = 14;
      g.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const tt = t - (W - x) / speed;
        const ph = ((tt * bps) % 1 + 1) % 1;
        const y = mid - wave(ph) * H * 0.55;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      ekg.raf = requestAnimationFrame(draw);
    };
    ekg.raf = requestAnimationFrame(draw);
  }

  /* ---------- 5. o que você vai criar ---------- */
  const ICONS = {
    site: '<rect x="6" y="10" width="52" height="40" rx="4"/><path d="M6 20h52M14 30h20M14 38h30"/>',
    app: '<rect x="18" y="4" width="28" height="56" rx="6"/><path d="M28 10h8M24 22h16v12H24zM24 42h16"/>',
    shop: '<path d="M6 10h8l6 30h30l6-22H18"/><circle cx="24" cy="50" r="4"/><circle cx="46" cy="50" r="4"/>',
    dash: '<path d="M8 54h48M14 54V34M26 54V20M38 54V28M50 54V12"/>',
    api: '<path d="M22 12c-8 0-8 6-8 12s-4 8-6 8c2 0 6 2 6 8s0 12 8 12M42 12c8 0 8 6 8 12s4 8 6 8c-2 0-6 2-6 8s0 12-8 12"/><circle cx="32" cy="32" r="4"/>',
    proto: '<rect x="6" y="8" width="24" height="18" rx="2"/><rect x="34" y="8" width="24" height="18" rx="2"/><rect x="20" y="38" width="24" height="18" rx="2"/><path d="M18 26v6h14v6M46 26v6H32"/>',
    system: '<rect x="8" y="8" width="48" height="12" rx="3"/><rect x="8" y="26" width="48" height="12" rx="3"/><rect x="8" y="44" width="48" height="12" rx="3"/><path d="M16 14h4M16 32h4M16 50h4"/>',
    rocket: '<path d="M32 4c10 8 14 20 10 36H22C18 24 22 12 32 4z"/><circle cx="32" cy="22" r="5"/><path d="M22 40l-8 10 10-2M42 40l8 10-10-2M28 48l4 10 4-10"/>',
  };
  function renderCreate() {
    stage.dataset.scene = 'create';
    circuit.setEnergy(0.6);
    const cs = ['orange', 'green', 'blue', 'white'];
    swapScene(`
      <section class="scene scene-create">
        <h1 class="create-title"><span data-scramble="0">O que você vai</span> <span class="c-green" data-scramble="300">poder criar.</span></h1>
        <ul class="create-grid">
          ${C.creations.map(([icon, label], k) => `
            <li style="--k:${k};--c:${COLOR[cs[k % 4]]}">
              <svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[icon]}</svg>
              <span>${label}</span>
            </li>`).join('')}
        </ul>
        <p class="create-sub">Você aprende a transformar uma ideia em uma aplicação funcionando de verdade.</p>
      </section>`);
  }

  /* ---------- 6. carreiras em órbita ---------- */
  function renderCareers() {
    stage.dataset.scene = 'careers';
    const mine = profile().careers;
    const inner = C.careers.slice(0, 5), outer = C.careers.slice(5);
    const ring = (list, r, cls) => `
      <div class="orbit ${cls}" style="--r:${r}px">
        ${list.map((name, k) => `
          <span class="role${mine.includes(name) ? ' mine' : ''}" style="--a:${(360 / list.length) * k}deg"><em>${esc(name)}</em></span>`).join('')}
      </div>`;
    swapScene(`
      <section class="scene scene-careers">
        <div class="careers-copy">
          <h1><span data-scramble="0">Onde você</span><span class="c-orange" data-scramble="300">pode chegar.</span></h1>
          <p>Algumas possibilidades de atuação para quem domina web, dados, mobile e produto. As que brilham em verde combinam com o que você escolheu no celular.</p>
          <p class="careers-pick"><span>seu perfil</span><b>${esc(profile().role)}</b></p>
        </div>
        <div class="orbits">
          ${ring(inner, 210, 'o-in')}
          ${ring(outer, 370, 'o-out')}
          <div class="core"><span>${esc(firstName() || 'você')}</span></div>
        </div>
      </section>`);
  }

  /* ---------- 7. mercado ---------- */
  function renderMarket() {
    stage.dataset.scene = 'market';
    const row = (list) => list.map((s, k) => `<span class="${['o', 'g', 'b', 'w'][k % 4]}">${s}</span>`).join('');
    const a = C.sectors.slice(0, 6), b = C.sectors.slice(6);
    swapScene(`
      <section class="scene scene-market">
        <h1 class="market-title" data-scramble="0">Tecnologia está em praticamente todo setor.</h1>
        <div class="m-row m-left"><div>${row(a)}${row(a)}</div></div>
        <div class="m-row m-right"><div>${row(b)}${row(b)}</div></div>
        <p class="market-sub">Um sistema pode estar dentro de uma indústria, de uma loja, de um hospital, de uma prefeitura ou do negócio que você vai criar.</p>
      </section>`);
  }

  /* ---------- 8. diferenciais Fatec ---------- */
  function renderFatec() {
    stage.dataset.scene = 'fatec';
    const cs = ['orange', 'green', 'blue', 'white'];
    swapScene(`
      <section class="scene scene-fatec">
        <h1 class="fatec-title"><span data-scramble="0">Formação pública, tecnológica</span><span class="c-blue" data-scramble="400">e conectada ao mercado.</span></h1>
        <ul class="fatec-grid">
          ${C.fatec.map(([t, d], k) => `<li style="--k:${k};--c:${COLOR[cs[k]]}"><b>${t}</b><p>${d}</p></li>`).join('')}
        </ul>
        <div class="axis">
          <span>Eixo tecnológico</span>
          <b>${C.axis.name}</b>
          <p>${C.axis.text}</p>
        </div>
      </section>`);
  }

  /* ---------- 9. final: crachá ---------- */
  function renderFinale() {
    stage.dataset.scene = 'finale';
    circuit.setEnergy(0.85);
    const name = S.lead?.name || 'Futuro dev';
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    const bars = Array.from(name + 'sistemasparainternet').slice(0, 34).map((ch) => `<i style="width:${1 + (ch.charCodeAt(0) % 4)}px"></i>`).join('');
    swapScene(`
      <section class="scene scene-finale">
        <div class="finale-copy">
          <h1>
            <span data-scramble="0">Talvez o próximo sistema</span>
            <span data-scramble="250">que você usa todo dia</span>
            <span class="c-green" data-scramble="600">seja criado por você.</span>
          </h1>
          <div class="finale-cta">
            <div class="mini-qr">${qrSvg(C.links.vestibular)}</div>
            <div>
              <p class="cta-big">Descubra o que você pode criar.</p>
              <p>Inscrições e calendário em <b>vestibularfatec.com.br</b></p>
              ${S.lead?.id ? '<p class="cta-phone">Seu crachá também chegou no seu celular.</p>' : ''}
            </div>
          </div>
        </div>
        <div class="badge-wrap">
          <article class="badge">
            <header><span class="logo-mark">&lt;<i>/</i>&gt;</span><span>devpath</span><small>crachá do futuro tecnólogo</small></header>
            <div class="avatar"><span>${esc(initials || '</>')}</span></div>
            <h2 class="badge-name">${esc(name)}</h2>
            <p class="badge-role">${esc(profile().role)}</p>
            <ul class="badge-stack">${profile().stack.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
            <footer>
              <div><b>Sistemas para Internet</b><span>Fatec Jales</span></div>
              <div class="barcode">${bars}</div>
            </footer>
          </article>
        </div>
      </section>`);
  }

  /* ============================================================
   * CONTROLE DA LINHA DO TEMPO
   * ============================================================ */
  const RENDER = { boot: renderBoot, hook: renderHook, map: renderMap, create: renderCreate, careers: renderCareers, market: renderMarket, fatec: renderFatec, finale: renderFinale };

  function begin(lead) {
    S.lead = lead;
    S.paused = false;
    go(0);
  }

  function go(i) {
    clearTimeout(S.timer);
    if (i < 0) i = 0;
    if (i >= STEPS.length) return end();
    const prev = STEPS[S.i];
    const step = STEPS[i];
    S.i = i;
    stage.dataset.scene = step.type;
    if (step.type === 'journey') {
      if (prev?.type === 'journey' && $('#journey')) updateJourney(step.sem);
      else renderJourney(step.sem);
    } else {
      cancelAnimationFrame(ekg.raf);
      if (step.type !== 'create' && step.type !== 'finale') circuit.setEnergy(0.4);
      RENDER[step.type]();
    }
    updateHud();
    reportScene();
    schedule(step.dur * 1000);
  }

  function reportScene() {
    const step = STEPS[S.i];
    if (step) post('/api/tv/scene', { index: S.i + 1, total: STEPS.length, label: step.label, paused: S.paused });
  }

  function schedule(ms) {
    clearTimeout(S.timer);
    S.remaining = ms;
    S.stepEnds = performance.now() + ms;
    if (!S.paused) S.timer = setTimeout(() => go(S.i + 1), ms);
    const bar = $('#hudProgress li.on i');
    if (bar) { bar.style.animationDuration = ms + 'ms'; bar.style.animationPlayState = S.paused ? 'paused' : 'running'; }
  }

  function togglePause() {
    if (S.i < 0) return;
    S.paused = !S.paused;
    if (S.paused) {
      clearTimeout(S.timer);
      S.remaining = S.stepEnds - performance.now();
    } else {
      S.stepEnds = performance.now() + S.remaining;
      S.timer = setTimeout(() => go(S.i + 1), S.remaining);
    }
    const bar = $('#hudProgress li.on i');
    if (bar) bar.style.animationPlayState = S.paused ? 'paused' : 'running';
    updateHud();
    reportScene();
  }

  function end() {
    clearTimeout(S.timer);
    cancelAnimationFrame(ekg.raf);
    S.i = -1;
    S.lead = null;
    S.paused = false;
    renderIdle();
    post('/api/tv/done', {}); // libera o próximo da fila e limpa o painel do operador
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    const list = $('#hudProgress');
    if (S.i < 0) list.innerHTML = '';
    else {
      list.innerHTML = STEPS.map((s, k) => `<li class="${k < S.i ? 'done' : k === S.i ? 'on' : ''}" title="${esc(s.label)}"><i></i></li>`).join('');
    }
    const live = $('#hudLiveText');
    $('#hudLive').classList.toggle('off', !S.online);
    if (S.i >= 0) live.textContent = S.paused ? 'pausado' : `ao vivo: ${firstName() || 'demonstração'}`;
    else live.textContent = S.online ? 'pronto para conectar' : 'modo demonstração';
  }

  /* ---------- reações e avisos vindos do celular ---------- */
  const REACT = { fire: '🔥', heart: '💚', mind: '🤯', rocket: '🚀' };
  function react({ type, name }) {
    const box = $('#reactions');
    const el = document.createElement('div');
    el.className = 'reaction';
    el.style.setProperty('--x', Math.round(Math.random() * 220) + 'px');
    el.style.setProperty('--sway', (Math.random() * 80 - 40) + 'px');
    el.innerHTML = `<span>${REACT[type] || '✨'}</span><small>${esc(name)}</small>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.remove('show'); void t.offsetWidth;
    t.classList.add('show');
  }

  /* ---------- conexão com o servidor ---------- */
  function post(url, body) {
    if (!S.online) return;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
  }

  function connect() {
    if (location.protocol === 'file:' || !window.EventSource) return renderIdle();
    const es = new EventSource('/api/stream?role=tv');
    es.addEventListener('hello', (e) => {
      const d = JSON.parse(e.data);
      S.online = true;
      S.mobileUrl = d.mobileUrl;
      S.todayCount = d.todayCount;
      if (S.i < 0) {
        if ($('.scene-idle:not(.is-out)')) { drawQR(); $('#todayCount').textContent = d.todayCount; }
        else renderIdle();
      }
      updateHud();
    });
    es.addEventListener('start', (e) => {
      const lead = JSON.parse(e.data);
      if (S.lead?.id === lead.id) return; // reconexão durante a mesma apresentação
      begin(lead);
    });
    es.addEventListener('lead', (e) => {
      const d = JSON.parse(e.data);
      S.todayCount = d.todayCount;
      const count = $('#todayCount');
      if (count) count.textContent = d.todayCount;
      const feed = $('#idleFeed');
      if (feed) {
        feed.insertAdjacentHTML('afterbegin', `<li><i></i>${esc(d.name)} acabou de se conectar</li>`);
        $$('li', feed).slice(3).forEach((li) => li.remove());
      } else toast(`${d.name} acabou de se conectar`);
    });
    es.addEventListener('queue', (e) => {
      S.queueNext = JSON.parse(e.data).next || [];
    });
    es.addEventListener('react', (e) => react(JSON.parse(e.data)));
    // comandos do painel do operador (notebook)
    es.addEventListener('cmd', (e) => {
      const { cmd } = JSON.parse(e.data);
      if (cmd === 'demo' && S.i < 0) begin({ id: null, name: '', interest: 'apps' });
      else if (cmd === 'next' && S.i >= 0) go(S.i + 1);
      else if (cmd === 'prev' && S.i >= 0) go(S.i - 1);
      else if (cmd === 'pause') togglePause();
      else if (cmd === 'stop' && S.i >= 0) end();
    });
    es.onerror = () => {
      if (S.online) { S.online = false; updateHud(); }
    };
    es.onopen = () => { S.online = true; updateHud(); };
    // mostra o modo demonstração se o servidor não responder
    setTimeout(() => { if (S.i < 0 && !$('.scene-idle')) renderIdle(); }, 1500);
  }

  /* ---------- atalhos do operador ---------- */
  addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && S.i < 0) begin({ id: null, name: '', interest: 'apps' });
    else if (e.key === 'ArrowRight' && S.i >= 0) go(S.i + 1);
    else if (e.key === 'ArrowLeft' && S.i >= 0) go(S.i - 1);
    else if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'Escape' && S.i >= 0) end();
    else if (e.key.toLowerCase() === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    else if (e.key.toLowerCase() === 'h') $('#help').hidden = !$('#help').hidden;
  });

  connect();

  /* ---------- ensaio: index.html?cena=4&nome=Ana&perfil=design&pausar ----------
   * Abre direto numa cena (1 = terminal ... 15 = crachá) para ensaiar ou revisar. */
  const q = new URLSearchParams(location.search);
  if (q.has('cena')) {
    setTimeout(() => {
      S.lead = { id: null, name: q.get('nome') || 'Ana Souza', interest: q.get('perfil') || 'apps' };
      const target = Math.max(1, Math.min(STEPS.length, Number(q.get('cena')) || 1)) - 1;
      go(target);
      if (q.has('pausar')) togglePause();
    }, 1700);
  }
})();
