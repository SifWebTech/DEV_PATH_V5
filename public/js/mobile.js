/*
 * DEV PATH V5 — celular do visitante
 * cadastro → botão começar → acompanha a TV e reage → recebe o crachá
 * O id do cadastro fica no aparelho, então recarregar a página não perde o lugar.
 */
(() => {
  'use strict';
  const C = window.DEVPATH;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('devpath-lead')); } catch { return null; } },
    set(v) { try { localStorage.setItem('devpath-lead', JSON.stringify(v)); } catch {} },
    clear() { try { localStorage.removeItem('devpath-lead'); } catch {} },
  };

  let lead = store.get();
  let es = null;
  let ctype = 'email';
  let interest = '';

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

  document.querySelectorAll('[data-ctype]').forEach((b) => b.addEventListener('click', () => {
    ctype = b.dataset.ctype;
    document.querySelectorAll('[data-ctype]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    const input = $('#fContact');
    input.value = '';
    input.type = ctype === 'email' ? 'email' : 'text';
    input.inputMode = ctype === 'email' ? 'email' : 'text';
    input.autocomplete = ctype === 'email' ? 'email' : 'username';
    input.placeholder = ctype === 'email' ? 'voce@email.com' : '@seuperfil';
    input.focus();
    setErr('contact', '');
  }));

  function setErr(field, msg) {
    const el = document.querySelector(`[data-err="${field}"]`);
    if (el) el.textContent = msg || '';
  }

  $('#leadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    ['name', 'contact', 'interest', 'consent'].forEach((f) => setErr(f, ''));
    $('#formError').textContent = '';
    const body = {
      name: $('#fName').value,
      contact: $('#fContact').value,
      interest,
      consent: $('#fConsent').checked,
    };
    const btn = $('#saveBtn');
    btn.disabled = true;
    btn.textContent = 'Salvando…';
    try {
      const res = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.status === 422) {
        Object.entries(data.errors).forEach(([f, m]) => setErr(f, m));
        document.querySelector('.err:not(:empty)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (res.ok) {
        lead = data;
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
  function goReady() {
    $('#readyHello').textContent = `Tudo certo, ${lead.name.split(' ')[0]}.`;
    show('vReady');
  }

  $('#startBtn').addEventListener('click', async () => {
    const btn = $('#startBtn');
    btn.classList.add('pressed');
    navigator.vibrate?.(40);
    try {
      const res = await fetch('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id }) });
      if (res.status === 404) { store.clear(); lead = null; show('vForm'); return; }
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
    es.addEventListener('status', (e) => applyStatus(JSON.parse(e.data)));
    es.addEventListener('scene', (e) => {
      const d = JSON.parse(e.data);
      $('#sceneLabel').textContent = d.label;
      $('#sceneBar').style.width = (d.index / d.total) * 100 + '%';
    });
  }

  function applyStatus(st) {
    const box = $('#liveStatus');
    if (st.state === 'queued') {
      show('vLive');
      box.className = 'live-status wait';
      box.innerHTML = st.tvOnline === false
        ? 'Aguardando a TV ligar…'
        : st.position === 1 ? 'Você é o próximo! Fique de olho na TV.' : `Você está na fila: posição <b>${st.position}</b>`;
      $('#sceneLabel').textContent = 'Em instantes';
    } else if (st.state === 'playing') {
      show('vLive');
      box.className = 'live-status on';
      box.innerHTML = '<i></i>Ao vivo na TV com o seu nome';
    } else if (st.state === 'done') {
      showBadge();
    } else if (st.state === 'unknown') {
      store.clear(); lead = null; show('vForm');
    }
  }

  document.querySelectorAll('[data-react]').forEach((b) => b.addEventListener('click', () => {
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    navigator.vibrate?.(15);
    fetch('/api/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, type: b.dataset.react }) }).catch(() => {});
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
      <footer><b>Sistemas para Internet</b><span>Fatec Jales</span></footer>`;
    show('vDone');
  }
  $('#vestLink').href = C.links.vestibular;
  $('#fatecLink').href = C.links.fatec;
  $('#againBtn').addEventListener('click', () => { $('#startBtn').classList.remove('pressed'); goReady(); });

  /* ---------- retomada ao recarregar ---------- */
  if (lead?.id) {
    listen(); // o servidor responde com o estado atual (fila, ao vivo, concluído)
    es.addEventListener('status', function first(e) {
      es.removeEventListener('status', first);
      const st = JSON.parse(e.data);
      if (st.state === 'ready') goReady();
    });
  } else show('vForm');
})();
