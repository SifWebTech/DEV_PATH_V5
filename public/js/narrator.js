/*
 * DEV PATH V5 — narrador da TV
 * ------------------------------------------------------------
 * Lê o manifesto (js/narration.js) e fala uma cena de cada vez. Para cada trecho escolhe,
 * nesta ordem:
 *   1. o MP3 gravado (se o arquivo existir)          → AudioEngine.playNarration
 *   2. a voz do navegador em português (speechSynthesis) — só aqui, em nenhum outro arquivo
 *   3. modo silencioso: legenda e marcadores no tempo estimado, sem voz
 *
 * Enquanto fala, avisa a TV:
 *   Narrator.onSpeaking(fn)  true/false  → a TV abaixa/volta a música (ducking)
 *   Narrator.onCaption(fn)   texto       → legenda
 *   Narrator.onMarker(fn)    marcador    → destaque, competência desbloqueada…
 *   Narrator.onBlocked(fn)                → o navegador bloqueou a voz (falta o clique)
 *
 *   const h = await Narrator.play('journey3', { nome: 'Ana', id: '<id do cadastro>', perfil: 'apps', fallbackSec: 15 })
 *   h.voiced   há voz? (se não, a TV usa a duração de STEPS)
 *   h.done     Promise: 'ended' (terminou) ou 'stopped' (outra cena começou)
 *   h.pause() / h.resume()        Narrator.stop()
 */
(() => {
  'use strict';
  const M = window.DEVPATH_NARRACAO || { config: {}, scenes: {} };
  const CFG = M.config;
  const VOICE = CFG.voice || {};
  const CPS = 14.5; // caracteres falados por segundo (voz pt-BR em velocidade 1): base das estimativas
  const synth = window.speechSynthesis;
  const Utter = window.SpeechSynthesisUtterance;
  const GENDERS = ['female', 'male'];

  const N = {
    voices: { female: null, male: null }, // voz do navegador para cada narrador
    cps: {},                        // velocidade real de cada voz (aprendida enquanto fala)
    blocked: false,                 // o navegador recusou a voz ("not-allowed")
    failed: new Set(),              // vozes que deram erro (ex.: voz online sem internet): não são usadas de novo
    enabled: CFG.narration !== false,
    muted: false,
    run: null,                      // reprodução atual
    token: 0,                       // muda a cada play/stop: eventos atrasados de falas antigas são ignorados
    on: { marker: new Set(), caption: new Set(), speaking: new Set(), blocked: new Set() },
  };

  const emit = (kind, value) => N.on[kind].forEach((fn) => { try { fn(value); } catch (err) { console.error(err); } });
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const fill = (text, o) => String(text || '').replace(/\{nome\}/g, o.nome || '');
  const other = (g) => (g === 'male' ? 'female' : 'male');
  // sem voz do tipo pedido, a outra fala no lugar (nunca fica mudo por falta de uma voz)
  const voiceFor = (g) => N.voices[g] || N.voices[other(g)] || null;
  const ttsReady = (g = 'female') => !!(synth && Utter && voiceFor(g) && !N.blocked);
  // vozes que nunca são usadas (ex.: a voz do Google, robotizada); lista em config.voice.avoid
  const avoided = (v) => (VOICE.avoid || []).some((n) => norm(v.name).includes(norm(n)));
  const cancelSpeech = () => { if (synth.speaking || synth.pending) synth.cancel(); };

  // "Frase um. Frase dois?" → [{ text, start }]
  function split(text) {
    const out = [];
    const re = /[^.!?]+[.!?]*\s*/g;
    let m;
    while ((m = re.exec(text))) if (m[0].trim()) out.push({ text: m[0].trim(), start: m.index });
    return out.length ? out : [{ text, start: 0 }];
  }
  const estimate = (text) => text.length / (CPS * (VOICE.rate || 1)) + 0.35 * split(text).length;

  /* ---------- vozes do navegador ---------- */
  // Uma voz feminina e uma masculina, cada uma pela sua lista de preferência (config.voice.female/male).
  // Sem internet, só vozes instaladas no computador (as "Google…" e "Online (Natural)" precisam de rede).
  function pickVoices() {
    if (!synth) return;
    const usable = synth.getVoices().filter((v) => !N.failed.has(v.name) && !avoided(v) && (navigator.onLine !== false || v.localService));
    const lang = norm(VOICE.lang || 'pt-BR').replace('_', '-');
    const pt = usable.filter((v) => norm(v.lang).replace('_', '-') === lang);
    const pool = pt.length ? pt : usable.filter((v) => norm(v.lang).startsWith(lang.slice(0, 2)));
    for (const g of GENDERS) {
      N.voices[g] = null;
      for (const name of VOICE[g]?.prefer || []) {
        N.voices[g] = pool.find((v) => norm(v.name).includes(norm(name))) || null;
        if (N.voices[g]) break;
      }
    }
    if (!N.voices.female && !N.voices.male) N.voices.female = pool[0] || null; // nenhuma da lista: qualquer voz em português
  }
  if (synth) {
    pickVoices();
    synth.addEventListener?.('voiceschanged', pickVoices);
    addEventListener('online', pickVoices);
    addEventListener('offline', pickVoices);
  }

  // Chamado dentro do clique "Ativar áudio": o Chrome só libera a voz depois de um gesto
  function prime() {
    N.blocked = false;
    if (!synth || !Utter) return;
    try {
      const u = new Utter(' ');
      u.volume = 0;
      synth.speak(u); // sem cancel(): nas vozes da Microsoft, cancel() logo antes de falar corta a fala seguinte
    } catch {}
  }

  /* ---------- marcadores e legenda ---------- */
  // Cada marcador vira uma posição no texto (onde a palavra aparece), procurando em ordem
  function placeMarkers(text, markers = []) {
    const hay = norm(text);
    let from = 0;
    return markers.map((m) => {
      let pos = -1;
      if (m.word) {
        const w = norm(m.word);
        pos = hay.indexOf(w, from);
        if (pos < 0) pos = hay.indexOf(w);
      }
      if (pos >= 0) from = pos + 1;
      else pos = m.time != null ? Math.min(text.length, Math.round(m.time * CPS)) : text.length;
      return { ...m, pos, fired: false };
    });
  }

  function fire(run, seg, m) {
    m.fired = true;
    emit('marker', { action: m.action, target: m.target, label: m.label, word: m.word, scene: run.key, segment: seg.id });
  }
  const fireUpTo = (run, seg, pos) => seg.markers.forEach((m) => { if (!m.fired && m.pos <= pos) fire(run, seg, m); });

  function caption(seg, pos) {
    let k = 0;
    seg.sentences.forEach((s, i) => { if (s.start <= pos) k = i; });
    if (k !== seg.capIdx) { seg.capIdx = k; emit('caption', seg.sentences[k].text); }
  }

  /* ---------- plano: o que tocar em cada trecho ---------- */
  async function resolve(seg, o, sceneVoice) {
    let text = seg.text, audio = seg.audio;
    const gender = seg.voice || sceneVoice || 'female';
    if (seg.dynamic) {
      // 1º o MP3 que o servidor gera com o nome (mesma voz neural); 2º a voz do navegador; 3º o fallback gravado
      const own = seg.server && o.id ? seg.server.replace('{id}', o.id) : '';
      if (N.enabled && o.nome && AudioEngine.ready && own && (await AudioEngine.exists(own))) return item(seg, fill(text, o), own, 'mp3', gender);
      if (N.enabled && o.nome && AudioEngine.ready && ttsReady(gender)) return item(seg, fill(text, o), null, 'tts', gender);
      text = seg.fallback?.text;
      audio = seg.fallback?.audio;
      if (!text) return null;
    }
    text = fill(text, o);
    let mode = 'silent';
    if (N.enabled && AudioEngine.ready) {
      if (audio && (await AudioEngine.exists(audio)) !== false) mode = 'mp3';
      else if (ttsReady(gender)) mode = 'tts';
    }
    return item(seg, text, audio, mode, gender);
  }
  const item = (seg, text, audio, mode, gender) => ({
    id: seg.id, text, audio, mode, gender, dynamic: !!seg.dynamic, sentences: split(text), markers: placeMarkers(text, seg.markers), capIdx: -1,
  });

  /* ---------- reprodução de uma cena ---------- */
  async function playScene(key, scene, opts = {}) {
    stop();
    if (!scene?.segments?.length) return null;
    const token = N.token;
    const perfil = opts.perfil || 'apps';
    const list = scene.segments.filter((s) => !s.profile || s.profile === perfil);
    const plan = (await Promise.all(list.map((s) => resolve(s, opts, scene.voice)))).filter(Boolean);
    if (token !== N.token || !plan.length) return null; // outra cena começou enquanto conferia os arquivos

    const voiced = plan.some((p) => p.mode !== 'silent');
    const total = plan.reduce((a, p) => a + estimate(p.text), 0);
    // sem voz: a legenda se encaixa na duração de STEPS (quem manda é o relógio da TV)
    const scale = !voiced && opts.fallbackSec ? Math.min(1, Math.max(1, opts.fallbackSec - 0.8) / total) : 1;
    const run = {
      key, token, plan, voiced, scale,
      estimate: total * scale,
      hold: scene.hold ?? CFG.hold ?? 1,
      paused: false, current: null, timers: new Set(),
    };
    run.done = new Promise((r) => { run.resolve = r; });
    N.run = run;
    loop(run);
    return {
      key, voiced, hold: run.hold, done: run.done,
      get estimate() { return run.estimate; },
      pause: () => pause(run),
      resume: () => resume(run),
      modes: plan.map((p) => `${p.id}:${p.mode}:${p.gender}`),
    };
  }

  async function loop(run) {
    const alive = () => run.token === N.token;
    if (run.voiced) emit('speaking', true);
    for (const seg of run.plan) {
      if (!alive()) return;
      try {
        if (seg.mode === 'mp3') await playMp3(run, seg);
        else if (seg.mode === 'tts') await playTts(run, seg);
        else await playSilent(run, seg);
      } catch (err) {
        console.warn('narração:', err);
      }
      if (!alive()) return;
      fireUpTo(run, seg, Infinity); // nenhum destaque fica para trás
    }
    if (!alive()) return;
    N.run = null;
    emit('caption', '');
    if (run.voiced) emit('speaking', false);
    run.resolve('ended');
  }

  // Relógio comum ao modo silencioso e ao MP3: só conta o tempo enquanto não está pausado
  function every(run, fn) {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = run.paused ? 0 : (now - last) / 1000;
      last = now;
      fn(dt);
    }, 100);
    run.timers.add(id);
    return () => { clearInterval(id); run.timers.delete(id); };
  }

  function playSilent(run, seg, fromPos = 0) {
    return new Promise((resolve) => {
      const len = seg.text.length;
      const dur = Math.max(0.3, estimate(seg.text.slice(fromPos)) * run.scale);
      let t = 0;
      const step = (dt) => {
        t = Math.min(dur, t + dt);
        const pos = fromPos + (t / dur) * (len - fromPos);
        caption(seg, pos);
        fireUpTo(run, seg, pos);
        if (t >= dur) { clear(); resolve(); }
      };
      const clear = every(run, step);
      run.current = { stop: () => { clear(); resolve(); } };
      step(0);
    });
  }

  function playMp3(run, seg) {
    return new Promise((resolve) => {
      const h = AudioEngine.playNarration(seg.audio);
      const est = estimate(seg.text);
      // instante de cada palavra, gravado junto com o MP3 (ferramentas/gerar_narracao.py);
      // sem ele (MP3 gravado por uma pessoa), a posição é proporcional à duração
      const words = window.DEVPATH_NARRACAO_TEMPOS?.[seg.audio]?.w;
      const posAt = (t, dur) => {
        if (!words?.length) return Math.min(1, t / dur) * seg.text.length;
        let p = 0;
        for (const [ts, cp] of words) { if (ts <= t) p = cp; else break; }
        return p;
      };
      let wall = 0, settled = false;
      const finish = (result) => { if (settled) return; settled = true; clear(); resolve(result); };
      const clear = every(run, (dt) => {
        wall += dt;
        const t = h.time();
        const dur = h.duration() || est;
        const pos = posAt(t, dur);
        caption(seg, pos);
        seg.markers.forEach((m) => { if (!m.fired && (m.time != null ? t >= m.time : m.pos <= pos)) fire(run, seg, m); });
        if (wall > dur * 1.5 + 6) { h.stop(); finish(); } // travou: segue a apresentação
      });
      run.current = { pause: h.pause, resume: h.resume, stop: () => { h.stop(); finish(); } };
      h.done.then(() => finish(), () => finish('fallback'));
    }).then((r) => {
      if (r !== 'fallback' || run.token !== N.token) return undefined;
      return ttsReady(seg.gender) ? playTts(run, seg) : playSilent(run, seg); // MP3 com erro: segue com a voz do navegador
    });
  }

  /* Medido no Chrome do Windows: as vozes da Microsoft (no computador) demoram 2–3 s para começar cada
   * fala e cortam a fala seguinte se houver cancel() logo antes; a voz do Google (online) começa rápido,
   * mas não avisa as palavras (sem "boundary") e o Chrome corta falas online longas.
   * Por isso: voz do computador fala o trecho inteiro de uma vez; voz online, uma frase por vez;
   * sem aviso de palavras, a posição (legenda e destaques) é calculada pelo tempo. */
  function playTts(run, seg) {
    return new Promise((resolve) => {
      let i = 0, uid = 0, retries = 0, done = false;
      let startTimer = 0, endTimer = 0, tick = 0;
      const clear = () => { clearTimeout(startTimer); clearTimeout(endTimer); clearInterval(tick); };
      const finish = (next) => { if (done) return; done = true; uid++; clear(); resolve(next); };

      const speak = () => {
        if (done || run.paused || run.token !== N.token) return;
        if (i >= seg.sentences.length) return finish();
        const s = seg.sentences[i];
        if (!ttsReady(seg.gender)) return finish(playSilent(run, seg, s.start)); // sem voz nenhuma: segue sem som
        const voice = voiceFor(seg.gender);
        const whole = voice.localService;
        const chunk = whole ? seg.text.slice(s.start) : s.text;
        const my = ++uid;
        const u = new Utter(chunk);
        u.lang = VOICE.lang || 'pt-BR';
        u.voice = voice;
        u.rate = VOICE.rate || 1;
        u.pitch = VOICE.pitch || 1;
        u.volume = N.muted ? 0 : AudioEngine.narrationVolume;
        let started = false, t0 = 0, boundaries = false;

        // chegou na posição pos do texto: legenda, destaques e onde retomar depois de uma pausa
        const at = (pos) => {
          caption(seg, pos);
          fireUpTo(run, seg, pos);
          seg.sentences.forEach((x, k) => { if (x.start <= pos && k > i) i = k; });
        };
        const next = () => {
          if (my !== uid) return;
          uid++;
          clear();
          if (started) { // aprende a velocidade real desta voz
            const real = chunk.length / Math.max(0.5, (performance.now() - t0) / 1000);
            N.cps[voice.name] = N.cps[voice.name] ? (N.cps[voice.name] + real) / 2 : real;
          }
          fireUpTo(run, seg, s.start + chunk.length);
          i = whole ? seg.sentences.length : seg.sentences.indexOf(s) + 1;
          retries = 0;
          speak();
        };
        // a voz não funcionou (ex.: voz online sem internet): troca de voz e repete
        const voiceFailed = () => {
          if (my !== uid) return;
          uid++;
          clear();
          console.warn('narração: a voz', voice.name, 'falhou; trocando de voz');
          N.failed.add(voice.name);
          pickVoices();
          speak();
        };
        // terminou sem começar: tenta mais uma vez a mesma voz; na segunda, troca
        const retry = () => {
          if (my !== uid) return;
          if (retries++ >= 1) { retries = 0; voiceFailed(); return; }
          uid++;
          clear();
          setTimeout(speak, 300);
        };

        u.onstart = () => {
          if (my !== uid) return;
          started = true;
          t0 = performance.now();
          clearTimeout(startTimer);
          // Chrome às vezes não dispara "end": depois de um tempo razoável, segue
          // a saudação com o nome é curta: as vozes online do Edge avisam o fim com segundos de atraso,
          // então ela segue depois do tempo estimado em vez de esperar o aviso
          const limite = seg.dynamic ? estimate(chunk) * 1.3 + 0.6 : estimate(chunk) * 2 + 4;
          endTimer = setTimeout(() => { if (my === uid) { cancelSpeech(); next(); } }, limite * 1000);
          const cps = N.cps[voice.name] || CPS * (VOICE.rate || 1);
          tick = setInterval(() => {
            if (my !== uid || boundaries || run.paused) return;
            at(s.start + Math.min(chunk.length, ((performance.now() - t0) / 1000) * cps));
          }, 150);
        };
        u.onboundary = (e) => { if (my !== uid) return; boundaries = true; at(s.start + (e.charIndex || 0)); };
        u.onend = () => (started ? next() : retry());
        u.onerror = (e) => {
          if (my !== uid) return; // fala cancelada por nós (pausa, troca de cena)
          if (e.error === 'not-allowed') { N.blocked = true; emit('blocked', true); return finish(playSilent(run, seg, s.start)); }
          if (started) return next(); // cortada no meio: segue para o próximo trecho
          retry();
        };
        // nem começou em 8 s: a voz não está respondendo
        startTimer = setTimeout(() => { if (my === uid && !started) { cancelSpeech(); retries = 1; retry(); } }, 8000);

        at(s.start);
        synth.speak(u);
      };

      const cut = () => { uid++; clear(); cancelSpeech(); };
      // depois de um cancel(), espera um pouco antes de falar de novo (ver o comentário acima)
      const later = () => setTimeout(speak, 250);
      run.current = {
        pause: cut,              // a voz do navegador não pausa bem: corta e, ao continuar,
        resume: later,           // retoma do começo da frase em que parou
        restart: () => { cut(); later(); },
        stop: () => { cut(); finish(); },
      };
      if (synth.speaking || synth.pending) { synth.cancel(); later(); } else speak();
    });
  }

  /* ---------- controle ---------- */
  function pause(run) {
    if (run !== N.run || run.paused) return;
    run.paused = true;
    run.current?.pause?.();
  }
  function resume(run) {
    if (run !== N.run || !run.paused) return;
    run.paused = false;
    run.current?.resume?.();
  }

  function stop() {
    const run = N.run;
    N.token += 1;
    N.run = null;
    if (!run) return;
    run.current?.stop?.();
    run.timers.forEach(clearInterval);
    emit('caption', '');
    if (run.voiced) emit('speaking', false);
    run.resolve('stopped');
  }

  window.Narrator = {
    play: (key, opts) => playScene(key, M.scenes[key], opts),
    has: (key) => !!M.scenes[key]?.segments?.length,
    // baixa antes os MP3 de uma cena (a TV chama para a cena seguinte)
    preload(key, perfil = 'apps') {
      const segs = M.scenes[key]?.segments || [];
      AudioEngine.preload(segs.filter((s) => !s.profile || s.profile === perfil).flatMap((s) => [s.audio, s.fallback?.audio]));
    },
    // Só a saudação com o nome ("Olá, Ana."), com o mesmo fallback do manifesto
    speakDynamicWelcome: (nome) => playScene('welcome', {
      segments: [M.scenes.boot?.segments?.find((s) => s.dynamic) || { id: 'ola', dynamic: true, text: 'Olá, {nome}.', fallback: { text: 'Olá. Seu DEV PATH começa agora.' } }],
    }, { nome }),
    stop,
    prime,
    setEnabled(v) { N.enabled = !!v; },
    setMuted(v) { N.muted = !!v; N.run?.current?.restart?.(); },
    get enabled() { return N.enabled; },
    state: () => ({
      voice: [N.voices.female?.name, N.voices.male?.name].filter(Boolean).join(' + ') || null,
      female: N.voices.female?.name || null,
      male: N.voices.male?.name || null,
      tts: ttsReady(), blocked: N.blocked, enabled: N.enabled, speaking: !!N.run?.voiced,
    }),
    onMarker(fn) { N.on.marker.add(fn); return () => N.on.marker.delete(fn); },
    onCaption(fn) { N.on.caption.add(fn); return () => N.on.caption.delete(fn); },
    onSpeaking(fn) { N.on.speaking.add(fn); return () => N.on.speaking.delete(fn); },
    onBlocked(fn) { N.on.blocked.add(fn); return () => N.on.blocked.delete(fn); },
  };
})();
