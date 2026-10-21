/*
 * DEV PATH V5 — celular do visitante
 * cadastro → botão começar → acompanha a TV e reage → recebe o crachá
 * O id do cadastro fica no aparelho, então recarregar a página não perde o lugar.
 *
 * Funil: a página avisa o servidor quando é aberta pelo QR, quando o visitante começa
 * a preencher e quando salva o crachá. Só vai um id aleatório do aparelho, sem dados pessoais.
 */
(() => {
  'use strict';
  const C = window.DEVPATH;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const local = (key) => ({
    get() { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
    clear() { try { localStorage.removeItem(key); } catch {} },
  });
  const store = local('devpath-lead');

  // id anônimo do aparelho, para o funil não contar duas vezes quem recarrega a página
  const visitante = (() => {
    const s = local('devpath-visitante');
    let id = s.get();
    if (!id) {
      id = crypto.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      s.set(id);
    }
    return id;
  })();

  // código do QR (/join/<código>): diz ao servidor em qual telão este visitante vai assistir
  const joinCode = (location.pathname.match(/^\/join\/([A-Za-z0-9]+)/) || [])[1] || '';
  let lead = store.get();
  let es = null;
  let interest = '';

  const postJSON = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const track = (tipo) => postJSON('/api/evento', { tipo, visitante, lead: lead?.id }).catch(() => {});

  function show(id) {
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== id; });
    window.scrollTo(0, 0);
  }

  /* ---------- formulário ---------- */
  const chips = $('#interestChips');
  chips.innerHTML = Object.entries(C.profiles).map(([key, p]) =>
    `<button type="button" class="chip" role="radio" aria-checked="false" data-interest="${key}">${esc(p.label)}</button>`).join('');
  chips.setAttribute('role', 'radiogroup');
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-interest]');
    if (!b) return;
    interest = b.dataset.interest;
    chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === b)));
    setErr('interest', '');
  });

  // WhatsApp: vai formatando "(17) 99999-0000" enquanto a pessoa digita
  $('#fContact').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
    e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`
      : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
    setErr('contact', '');
  });

  function setErr(field, msg) {
    const el = document.querySelector(`[data-err="${field}"]`);
    if (el) el.textContent = msg || '';
  }

  // primeira interação com o formulário = "começou o cadastro" no funil
  $('#leadForm').addEventListener('focusin', () => track('form_inicio'), { once: true });

  $('#leadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    ['name', 'contact', 'email', 'interest', 'consent'].forEach((f) => setErr(f, ''));
    $('#formError').textContent = '';
    $('#formNotice').textContent = '';
    const body = {
      name: $('#fName').value,
      contact: $('#fContact').value,
      contactType: 'whatsapp',
      email: $('#fEmail').value,
      interest,
      consent: $('#fConsent').checked,
      visitante,
      joinCode,
    };
    const btn = $('#saveBtn');
    btn.disabled = true;
    btn.textContent = 'Salvando…';
    try {
      const res = await postJSON('/api/lead', body);
      const data = await res.json();
      if (res.status === 422 || res.status === 429) {
        Object.entries(data.errors || {}).forEach(([f, m]) => setErr(f, m));
        if (data.errors?.form) $('#formError').textContent = data.errors.form;
        document.querySelector('.err:not(:empty)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (res.ok) {
        lead = { ...data, joinCode }; // joinCode: a apresentação no celular (/assistir) volta para esta página
        store.set(lead);
        goReady();
      } else throw new Error();
    } catch {
      $('#formError').textContent = 'Não foi possível falar com a TV. Confira se o celular está no mesmo Wi-Fi do estande e tente de novo.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar e continuar';
    }
  });

  /* ---------- pronto ---------- */
  function goReady(jaAssistiu = false) {
    const nome = lead.name.split(' ')[0];
    $('#readyHello').textContent = `Tudo certo, ${nome}.`;
    $('#notMe').textContent = `Não é ${nome}? Fazer um novo cadastro`;
    $('#badgeLink').hidden = !jaAssistiu;
    show('vReady');
    tvQueue();
  }

  // Outra pessoa usando este celular: esquece o cadastro guardado aqui (no servidor ele continua)
  $('#notMe').addEventListener('click', () => {
    $('#leadForm').reset();
    interest = '';
    chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
    forgetLead();
  });
  $('#badgeLink').addEventListener('click', () => showBadge());

  // Quanto falta para o telão ficar livre (cada apresentação leva cerca de 4 minutos)
  async function tvQueue() {
    const note = $('#tvQueue');
    note.textContent = '';
    try {
      const st = await (await fetch('/api/displays/' + encodeURIComponent(lead.display || '') + '/state', { cache: 'no-store' })).json();
      const waiting = st.queue + (st.current ? 1 : 0);
      if (st.status === 'OFFLINE') note.textContent = 'O telão está desligado agora.';
      else if (!waiting) note.textContent = 'O telão está livre agora.';
      else note.textContent = `${waiting} ${waiting === 1 ? 'pessoa' : 'pessoas'} na frente no telão (cerca de ${waiting * 4} min).`;
    } catch {}
  }

  // A mesma apresentação do telão, aqui no celular: o cadastro vai junto pelo localStorage
  const watchHere = () => location.assign('/assistir');
  $('#soloBtn').addEventListener('click', () => {
    $('#soloBtn').classList.add('pressed');
    navigator.vibrate?.(40);
    watchHere();
  });

  // Estava na fila do telão e cansou de esperar: sai da fila e assiste no celular
  $('#switchSolo').addEventListener('click', async () => {
    try { await postJSON('/api/fila/sair', { id: lead.id }); } catch {}
    es?.close();
    es = null;
    watchHere();
  });

  $('#startBtn').addEventListener('click', async () => {
    const btn = $('#startBtn');
    btn.classList.add('pressed');
    navigator.vibrate?.(40);
    try {
      const res = await postJSON('/api/start', { id: lead.id });
      if (res.status === 404) { forgetLead(); return; }
      const status = await res.json();
      listen();
      applyStatus(status);
    } catch {
      btn.classList.remove('pressed');
      alert('Sem conexão com a TV. Confira o Wi-Fi e toque de novo.');
    }
  });

  /* ---------- ao vivo ---------- */
  function listen() {
    if (es) return;
    es = new EventSource('/api/stream?role=phone&id=' + encodeURIComponent(lead.id));
    let first = true; // a 1ª resposta (ao abrir a página) não abre o crachá: quem decide é a abertura, lá embaixo
    es.addEventListener('status', (e) => {
      const st = JSON.parse(e.data);
      if (first && st.state === 'done') { first = false; return; }
      first = false;
      applyStatus(st);
    });
    es.addEventListener('scene', (e) => {
      const d = JSON.parse(e.data);
      $('#sceneLabel').textContent = d.label;
      $('#sceneBar').style.width = (d.index / d.total) * 100 + '%';
    });
  }

  function applyStatus(st) {
    const box = $('#liveStatus');
    // na fila (não sendo o próximo de um telão livre): pode trocar para o celular a qualquer momento
    $('#switchSolo').hidden = st.state !== 'queued' || (st.position === 1 && !st.busy && st.tvOnline !== false);
    if (st.state === 'queued') {
      show('vLive');
      box.className = 'live-status wait';
      box.innerHTML = st.tvOnline === false
        ? 'Aguardando a TV ligar…'
        : st.busy
          ? `Há uma experiência em andamento na TV.<br>${st.position === 1 ? '<b>Você é o próximo.</b>' : `Você está na fila: posição <b>${st.position}</b>`}`
          : st.position === 1 ? 'Você é o próximo! Fique de olho na TV.' : `Você está na fila: posição <b>${st.position}</b>`;
      $('#sceneLabel').textContent = 'Em instantes';
    } else if (st.state === 'playing') {
      show('vLive');
      box.className = 'live-status on';
      box.innerHTML = '<i></i>Sua experiência está acontecendo na TV.';
    } else if (st.state === 'done') {
      showBadge();
    } else if (st.state === 'unknown') {
      forgetLead();
    }
  }

  // cadastro apagado (pelo visitante, pelo operador ou servidor sem registro): volta ao formulário
  function forgetLead(msg = '') {
    store.clear();
    lead = null;
    es?.close();
    es = null;
    $('#formNotice').textContent = msg;
    show('vForm');
  }

  document.querySelectorAll('[data-react]').forEach((b) => b.addEventListener('click', () => {
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    navigator.vibrate?.(15);
    postJSON('/api/react', { id: lead.id, type: b.dataset.react }).catch(() => {});
  }));

  /* ---------- crachá ---------- */
  function showBadge() {
    const p = C.profiles[lead.interest] || C.profiles.apps;
    const initials = lead.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    $('#mBadge').innerHTML = `
      <header><span class="logo-mark">&lt;<i>/</i>&gt;</span><span>devpath</span></header>
      <div class="m-avatar"><span>${esc(initials)}</span></div>
      <h2>${esc(lead.name)}</h2>
      <p class="m-role">${esc(p.role)}</p>
      <ul>${p.stack.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <footer><img class="fatec-logo" src="img/fatec-jales.png" alt="Fatec Jales Prof. José Camargo" style="--fatec-h: 44px"><b>Sistemas para Internet</b></footer>`;
    // o servidor registra o clique e redireciona com a UTM do evento
    $('#vestLink').href = '/ir/vestibular?lead=' + encodeURIComponent(lead.id);
    $('#shot').hidden = true;
    show('vDone');
  }
  $('#fatecLink').href = C.links.fatec;

  // Próximos passos: só aparecem os botões com link configurado em content.js (nada de URL inventada)
  $('#courseLink').href = C.links.curso || C.links.fatec;
  $('#fatecLink').hidden = !C.links.curso; // sem página do curso, "Conhecer o curso" já leva ao site da Fatec
  if (C.links.instagram) { $('#followLink').href = C.links.instagram; $('#followLink').hidden = false; }
  $('#infoBtn').addEventListener('click', () => {
    if (C.links.contato) { window.open(C.links.contato, '_blank', 'noopener'); return; }
    // o cadastro com consentimento já é o pedido de informações
    const note = $('#infoNote');
    note.textContent = 'Pronto! Você já está na lista: a Fatec Jales vai mandar as novidades do curso e do vestibular pelo contato que você cadastrou.';
    note.hidden = false;
  });
  const unpress = () => ['#startBtn', '#soloBtn'].forEach((s) => $(s).classList.remove('pressed'));
  $('#againBtn').addEventListener('click', () => { unpress(); goReady(); });
  addEventListener('pageshow', (e) => { if (e.persisted) unpress(); }); // voltou pelo botão "voltar" do navegador

  // Imagem 1080×1920 (formato dos stories), desenhada no próprio celular — funciona sem internet
  $('#saveBadge').addEventListener('click', async () => {
    const btn = $('#saveBadge');
    btn.disabled = true;
    btn.textContent = 'Gerando imagem…';
    try {
      const blob = await badgeImage(lead, C.profiles[lead.interest] || C.profiles.apps);
      const file = new File([blob], 'cracha-devpath.png', { type: 'image/png' });
      track('compartilhou');
      // Compartilhar direto só existe em https; no Wi-Fi do estande (http) mostramos a imagem para salvar
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Meu crachá DEV PATH', text: 'Sistemas para Internet · Fatec Jales' }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        $('#shotImg').src = url;
        $('#shotDl').href = url;
        $('#shot').hidden = false;
        $('#shot').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch {
      alert('Não deu para gerar a imagem. Tire um print da tela do crachá.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar crachá para os stories';
    }
  });

  // LGPD: o próprio visitante apaga o cadastro
  $('#deleteBtn').addEventListener('click', async () => {
    if (!confirm('Excluir seu nome e contato do cadastro da Fatec? Você não vai receber nossas mensagens.')) return;
    try {
      const res = await postJSON('/api/lead/excluir', { id: lead.id });
      if (!res.ok && res.status !== 404) throw new Error();
      forgetLead('Pronto: seus dados foram excluídos.');
    } catch {
      alert('Sem conexão com o estande. Tente de novo ou peça para alguém da equipe.');
    }
  });

  async function badgeImage(who, p) {
    await Promise.all(['800 90px Unbounded', '600 52px Unbounded', '500 32px "JetBrains Mono"'].map((f) => document.fonts.load(f))).catch(() => {});
    const W = 1080, H = 1920;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const DISPLAY = 'Unbounded, "Arial Black", sans-serif';
    const MONO = '"JetBrains Mono", Consolas, monospace';
    const COL = { ink: '#040816', white: '#f3f8ff', dim: '#8fa3c8', orange: '#ff7a1a', green: '#2bff88', blue: '#22b8ff' };

    const rr = (x, y, w, h, r) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };
    const wrap = (text, maxW) => {
      const lines = [];
      let line = '';
      for (const word of String(text).split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (g.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
      }
      if (line) lines.push(line);
      return lines;
    };

    // fundo
    g.fillStyle = COL.ink; g.fillRect(0, 0, W, H);
    for (const [x, y, c] of [[W, 0, '#22b8ff38'], [0, H, '#ff7a1a2e']]) {
      const rg = g.createRadialGradient(x, y, 0, x, y, 1100);
      rg.addColorStop(0, c); rg.addColorStop(1, '#04081600');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    g.fillStyle = '#22b8ff10';
    for (let y = 0; y < H; y += 48) g.fillRect(0, y, W, 2);

    // logo
    g.textBaseline = 'alphabetic';
    g.font = `800 64px ${MONO}`;
    let x = 80;
    for (const [ch, c] of [['<', COL.green], ['/', COL.orange], ['>', COL.green]]) {
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 24;
      g.fillText(ch, x, 170); x += g.measureText(ch).width - 6;
    }
    g.shadowBlur = 0;
    g.font = `700 58px ${DISPLAY}`; g.fillStyle = COL.white;
    g.fillText('dev', x + 22, 168);
    const devW = g.measureText('dev').width;
    g.font = `300 58px ${DISPLAY}`; g.fillStyle = COL.blue;
    g.fillText('path', x + 22 + devW, 168);
    // logo da Fatec Jales numa plaquinha branca, à direita (sem a imagem, o nome em texto)
    const logo = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = 'img/fatec-jales.png'; });
    if (logo) {
      const lh = 110, lw = lh * logo.width / logo.height, lp = 14;
      rr(W - 80 - lw - lp * 2, 70, lw + lp * 2, lh + lp * 2, 18);
      g.fillStyle = '#ffffff'; g.fill();
      g.drawImage(logo, W - 80 - lw - lp, 70 + lp, lw, lh);
    } else {
      g.font = `500 30px ${MONO}`; g.fillStyle = COL.dim; g.textAlign = 'right';
      g.fillText('Fatec Jales', W - 80, 166);
      g.textAlign = 'left';
    }
    g.font = `500 34px ${MONO}`; g.fillStyle = COL.green;
    g.fillText('// crachá do futuro tecnólogo', 80, 290);

    // mede o conteúdo do cartão antes de desenhar, para o cartão ter a altura certa
    const pad = 70, cardX = 80, cardW = W - 160, inner = cardW - pad * 2;
    let nameSize = 96, nameLines;
    do { g.font = `800 ${nameSize}px ${DISPLAY}`; nameLines = wrap(who.name, inner); nameSize -= 8; } while (nameLines.length > 2 && nameSize > 56);
    nameSize += 8;
    g.font = `600 50px ${DISPLAY}`;
    const roleLines = wrap(p.role, inner);
    g.font = `500 32px ${MONO}`;
    const chipRows = [];
    let row = [], rowW = 0;
    for (const t of p.stack) {
      const w = g.measureText(t).width + 56;
      if (rowW + w > inner && row.length) { chipRows.push(row); row = []; rowW = 0; }
      row.push([t, w]); rowW += w + 16;
    }
    if (row.length) chipRows.push(row);

    const cardY = 340;
    const avatarH = 256;
    const nameH = nameLines.length * nameSize * 1.08;
    const roleH = roleLines.length * 62;
    const chipsH = chipRows.length * 80;
    const cardH = pad + avatarH + 50 + nameH + 30 + roleH + 40 + chipsH + 40 + 150;

    // cartão
    const grad = g.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    grad.addColorStop(0, '#0d1c46'); grad.addColorStop(0.6, '#050b1e');
    rr(cardX, cardY, cardW, cardH, 44);
    g.fillStyle = grad; g.fill();
    g.shadowColor = COL.blue; g.shadowBlur = 50;
    g.strokeStyle = COL.blue; g.lineWidth = 4; g.stroke();
    g.shadowBlur = 0;

    // avatar com anel nas três cores
    const ax = cardX + pad + 120, ay = cardY + pad + 120;
    const av = g.createRadialGradient(ax, ay, 10, ax, ay, 120);
    av.addColorStop(0, '#ff7a1a55'); av.addColorStop(1, '#050b1e');
    g.fillStyle = av; g.beginPath(); g.arc(ax, ay, 110, 0, Math.PI * 2); g.fill();
    g.lineWidth = 10; g.lineCap = 'round';
    [[COL.orange, -1.9], [COL.green, 0.2], [COL.blue, 2.3]].forEach(([c, a]) => {
      g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 20;
      g.beginPath(); g.arc(ax, ay, 128, a, a + 1.6); g.stroke();
    });
    g.shadowBlur = 0;
    const initials = who.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    g.font = `800 84px ${DISPLAY}`; g.fillStyle = COL.white; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(initials, ax, ay + 4);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';

    // nome, perfil e disciplinas
    let y = cardY + pad + avatarH + 50;
    g.font = `800 ${nameSize}px ${DISPLAY}`; g.fillStyle = COL.white;
    for (const l of nameLines) { y += nameSize; g.fillText(l, cardX + pad, y); y += nameSize * 0.08; }
    y += 30;
    g.font = `600 50px ${DISPLAY}`; g.fillStyle = COL.green; g.shadowColor = COL.green; g.shadowBlur = 22;
    for (const l of roleLines) { y += 52; g.fillText(l, cardX + pad, y); y += 10; }
    g.shadowBlur = 0;
    y += 40;
    g.font = `500 32px ${MONO}`;
    for (const r of chipRows) {
      let cx = cardX + pad;
      for (const [t, w] of r) {
        rr(cx, y, w, 64, 32);
        g.strokeStyle = '#22b8ff99'; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = COL.blue; g.fillText(t, cx + 28, y + 43);
        cx += w + 16;
      }
      y += 80;
    }
    y += 40;
    g.setLineDash([10, 10]); g.strokeStyle = '#2b4a8a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cardX + pad, y); g.lineTo(cardX + cardW - pad, y); g.stroke();
    g.setLineDash([]);
    g.font = `700 44px ${DISPLAY}`; g.fillStyle = COL.white;
    g.fillText('Sistemas para Internet', cardX + pad, y + 70);
    g.font = `500 30px ${MONO}`; g.fillStyle = COL.dim;
    g.fillText('Fatec Jales · superior gratuito em 3 anos', cardX + pad, y + 118);

    // chamada no rodapé
    g.textAlign = 'center';
    g.font = `700 46px ${DISPLAY}`; g.fillStyle = COL.white;
    g.fillText('Bora criar tecnologia?', W / 2, H - 170);
    g.font = `500 36px ${MONO}`; g.fillStyle = COL.green;
    g.fillText('vestibularfatec.com.br', W / 2, H - 110);

    return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
  }

  /* ---------- abertura ---------- */
  track('qr_aberto');
  // Cadastro guardado de um QR de outro telão: não serve aqui (iria para a fila de outra TV), começa do zero
  if (lead?.id && lead.joinCode && joinCode && lead.joinCode !== joinCode) forgetLead();
  if (lead?.id && location.hash === '#cracha') {
    // voltou da apresentação no celular (/assistir): direto para o crachá
    history.replaceState(null, '', location.pathname);
    showBadge();
  } else if (lead?.id) {
    // O crachá só aparece direto quando uma apresentação termina com a página aberta. Ao ler o QR de novo
    // (cadastro já guardado neste celular), a primeira resposta do servidor nunca abre o crachá:
    // vai para a escolha (assistir de novo, ver o crachá ou "não é você? novo cadastro").
    goReady(); // já mostra a escolha (sem piscar o formulário); a resposta do servidor ajusta (fila, ao vivo…)
    listen();
    es.addEventListener('status', function first(e) {
      es.removeEventListener('status', first);
      const st = JSON.parse(e.data);
      if (st.state === 'ready' || st.state === 'done') goReady(st.state === 'done');
    });
  } else show('vForm');
})();
