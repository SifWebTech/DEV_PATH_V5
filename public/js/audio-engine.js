/*
 * DEV PATH V5 — motor de áudio da TV
 * ------------------------------------------------------------
 * Três canais com volume próprio, todos passando por um volume geral (mudo):
 *
 *   música   (loop sem emenda) ──────────────────────┐
 *   narração (MP3) ─▶ corta-graves ─▶ presença ─▶ compressor ─┼─▶ geral ─▶ compressor geral ─▶ caixas de som
 *   efeitos ──────────────────────────────────────┘
 *
 * A cadeia da narração deixa a voz mais clara e com volume constante (como em rádio/podcast);
 * o compressor geral segura picos quando voz, música e efeito tocam juntos.
 *
 * Usa a Web Audio API: cada canal é um GainNode, e toda mudança de volume é uma rampa
 * (fade), nunca um salto. "Ducking" = abaixar a música enquanto a narração fala.
 * Nada aqui pode travar a apresentação: arquivo que falta ou erro de áudio vira silêncio.
 *
 *   AudioEngine.init(config)        prepara (ainda mudo até o navegador liberar o som)
 *   AudioEngine.unlock()            chamado no clique "Ativar áudio"; começa a música
 *   AudioEngine.playMusic() / pauseMusic()
 *   AudioEngine.duck() / restore()  música baixa / volta, com fade
 *   AudioEngine.playNarration(url)  → { done: Promise, pause, resume, stop, time, duration }
 *   AudioEngine.playSFX('unlock')
 *   AudioEngine.setMusicVolume(v), setNarrationVolume(v), setSfxVolume(v)
 *   AudioEngine.setMuted(bool), AudioEngine.exists(url), AudioEngine.preload([urls])
 */
(() => {
  'use strict';

  const E = {
    cfg: null,
    ctx: null,
    bus: {},            // master, music, narration, sfx (GainNode)
    ready: false,       // AUDIO_READY: o navegador liberou o som
    muted: false,
    ducked: false,
    musicOn: false,
    musicNode: null,    // loop do MP3 ou trilha sintetizada
    narrEl: null,       // <audio> da narração (um só, reaproveitado)
    routed: false,      // a narração passa pelo GainNode? (senão o volume vai no próprio <audio>)
    narrToken: 0,
    buffers: new Map(), // efeitos já decodificados
    known: new Map(),   // url → true/false (existe?)
    listeners: new Set(),
  };

  const vol = () => E.cfg.volume;
  const emit = () => E.listeners.forEach((fn) => { try { fn(state()); } catch {} });
  const state = () => ({
    ready: E.ready, muted: E.muted, ducked: E.ducked, music: E.musicOn,
    context: E.ctx ? E.ctx.state : 'indisponivel',
  });

  /* ---------- volume com rampa (fade) ---------- */
  function ramp(gain, value, ms) {
    if (!gain || !E.ctx) return;
    const t = E.ctx.currentTime;
    const p = gain.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    // setTargetAtTime: aproximação exponencial, soa natural; ms/3 = chega a ~95% no tempo pedido
    p.setTargetAtTime(value, t, Math.max(0.01, ms / 3000));
  }

  /* ---------- existe esse arquivo? (uma consulta só por arquivo) ---------- */
  async function exists(url) {
    if (!url) return false;
    if (E.known.has(url)) return E.known.get(url);
    let ok = null; // null = não dá para saber (página aberta direto do arquivo)
    if (location.protocol !== 'file:') {
      try { ok = (await fetch(url, { method: 'HEAD', cache: 'no-store' })).ok; } catch { ok = false; }
    }
    if (ok !== null) E.known.set(url, ok);
    return ok;
  }

  async function loadBuffer(url) {
    if (E.buffers.has(url)) return E.buffers.get(url);
    const data = await (await fetch(url)).arrayBuffer();
    const buf = await E.ctx.decodeAudioData(data);
    E.buffers.set(url, buf);
    return buf;
  }

  /* ---------- montagem ---------- */
  function init(cfg) {
    E.cfg = cfg;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try {
        E.ctx = new AC();
        const g = (v) => { const n = E.ctx.createGain(); n.gain.value = v; return n; };
        E.bus.master = g(1);
        E.bus.music = g(0);
        E.bus.narration = g(vol().narration);
        E.bus.sfx = g(vol().sfx);
        // compressor geral: suave, só segura picos
        const glue = E.ctx.createDynamicsCompressor();
        glue.threshold.value = -10; glue.knee.value = 8; glue.ratio.value = 2; glue.attack.value = 0.01; glue.release.value = 0.25;
        E.bus.master.connect(glue).connect(E.ctx.destination);
        // voz: tira o grave de microfone (<90 Hz), realça a inteligibilidade (~3 kHz) e iguala o volume
        const hp = E.ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 90;
        const presence = E.ctx.createBiquadFilter();
        presence.type = 'peaking'; presence.frequency.value = 3200; presence.Q.value = 0.9; presence.gain.value = 2.5;
        const comp = E.ctx.createDynamicsCompressor();
        comp.threshold.value = -22; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2;
        E.voiceIn = hp;
        hp.connect(presence).connect(comp).connect(E.bus.narration);
        ['music', 'narration', 'sfx'].forEach((k) => E.bus[k].connect(E.bus.master));
        E.ctx.addEventListener?.('statechange', emit);
      } catch { E.ctx = null; }
    }
    E.narrEl = new Audio();
    E.narrEl.preload = 'auto';
    if (E.ctx) {
      try { E.ctx.createMediaElementSource(E.narrEl).connect(E.voiceIn); E.routed = true; }
      catch { /* sem roteamento: o volume vai direto no elemento */ }
    }
    // Se o navegador já permite som (TV aberta com a flag de autoplay), libera sem clique
    if (E.ctx && E.ctx.state === 'running') unlock();
    return state();
  }

  // Precisa ser chamado dentro de um clique/tecla (regra de autoplay do Chrome/Edge)
  async function unlock() {
    if (E.ready) return true;
    try { if (E.ctx && E.ctx.state !== 'running') await E.ctx.resume(); } catch {}
    // sem Web Audio, considera liberado: o <audio> toca direto
    E.ready = !E.ctx || E.ctx.state === 'running';
    if (E.ready) playMusic();
    emit();
    return E.ready;
  }

  /* ---------- música ---------- */
  async function playMusic() {
    if (!E.ready || E.musicOn) return;
    E.musicOn = true;
    emit();
    try {
      if (!E.musicNode) E.musicNode = await makeMusic();
    } catch { E.musicNode = null; }
    if (!E.musicOn) return; // pausaram enquanto carregava
    E.musicNode?.start?.();
    ramp(E.bus.music, E.ducked ? vol().musicDucked : vol().music, 1500);
  }

  function pauseMusic() {
    E.musicOn = false;
    ramp(E.bus.music, 0, 600);
    emit();
  }

  async function makeMusic() {
    if (!E.ctx) return null;
    if (await exists(E.cfg.music) !== false) {
      try {
        const buf = await loadBuffer(E.cfg.music);
        const src = E.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        // loop sem emenda: pula o silêncio que o codificador MP3 põe no começo e no fim do arquivo
        const [ini, fim] = trimSilence(buf);
        src.loopStart = ini;
        src.loopEnd = fim;
        src.connect(E.bus.music);
        let started = false;
        return { start() { if (!started) { started = true; src.start(0, ini); } } };
      } catch { E.known.set(E.cfg.music, false); }
    }
    return E.cfg.synthMusic ? synthAmbient() : null;
  }

  // Início e fim do som de verdade (em segundos), ignorando até 0,2 s de silêncio em cada ponta
  function trimSilence(buf) {
    const d = buf.getChannelData(0), max = Math.min(d.length, Math.round(buf.sampleRate * 0.2)), thr = 2e-3;
    let a = 0, b = d.length;
    while (a < max && Math.abs(d[a]) < thr) a++;
    while (b > d.length - max && Math.abs(d[b - 1]) < thr) b--;
    if (a >= max) a = 0;
    if (b <= d.length - max) b = d.length;
    return [a / buf.sampleRate, b / buf.sampleRate];
  }

  // Baixa antes os MP3 da próxima cena: a fala começa sem espera
  function preload(urls) {
    if (location.protocol === 'file:') return;
    for (const url of urls || []) {
      if (!url || E.known.get(url) === false || E.warm?.has(url)) continue;
      (E.warm ||= new Set()).add(url);
      fetch(url).catch(() => {});
    }
  }

  /* Trilha provisória gerada pelo navegador: acordes lentos e filtrados + notas esparsas com eco.
   * Não é um arquivo: são osciladores. Some assim que existir audio/music/ambient-devpath.mp3. */
  function synthAmbient() {
    const ctx = E.ctx;
    const out = ctx.createGain();
    // osciladores somados ficam ~18 dB abaixo de um MP3 normal: este ganho os deixa no mesmo nível,
    // para que config.volume.music valha igual para a trilha sintetizada e para o MP3
    out.gain.value = 6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
    const lfo = ctx.createOscillator(), lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.05; lfoAmt.gain.value = 350;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lp.connect(out);
    // eco das notas
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.42; fb.gain.value = 0.38; wet.gain.value = 0.5;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(out);
    out.connect(E.bus.music);

    // Am9 → Fmaj7 → C(add9) → G6: sensação de descoberta, sem tensão
    const CHORDS = [
      [110, 164.81, 196, 246.94, 261.63],
      [87.31, 130.81, 164.81, 196, 220],
      [130.81, 196, 246.94, 293.66, 329.63],
      [98, 146.83, 220, 246.94, 329.63],
    ];
    const BAR = 8; // segundos por acorde
    let next = 0, chord = 0, timer = 0, running = false;

    function pad(freqs, t) {
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.11, t + 3);
      env.gain.setValueAtTime(0.11, t + BAR - 1);
      env.gain.linearRampToValueAtTime(0, t + BAR + 2.5);
      env.connect(lp);
      for (const f of freqs) {
        for (const [type, det] of [['triangle', -6], ['sawtooth', 7]]) {
          const o = ctx.createOscillator();
          o.type = type; o.frequency.value = f; o.detune.value = det;
          const g = ctx.createGain();
          g.gain.value = type === 'sawtooth' ? 0.05 : 0.12;
          o.connect(g).connect(env);
          o.start(t); o.stop(t + BAR + 2.6);
        }
      }
    }
    function blip(f, t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g); g.connect(out); g.connect(delay);
      o.start(t); o.stop(t + 1);
    }
    // agenda alguns segundos à frente (não depende do setInterval ser pontual)
    function tick() {
      if (!running) return;
      while (next < ctx.currentTime + 4) {
        const c = CHORDS[chord++ % CHORDS.length];
        pad(c, next);
        for (let k = 0; k < 16; k++) {
          if (Math.random() < 0.38) blip(c[1 + (k * 3) % 4] * 4, next + k * (BAR / 16));
        }
        next += BAR;
      }
    }
    return {
      start() {
        if (running) return;
        running = true;
        lfo.start?.();
        next = ctx.currentTime + 0.1;
        tick();
        timer = setInterval(tick, 1000);
      },
      stop() { running = false; clearInterval(timer); },
    };
  }

  /* ---------- ducking ---------- */
  function duck() {
    E.ducked = true;
    if (E.musicOn) ramp(E.bus.music, vol().musicDucked, E.cfg.duckMs);
    emit();
  }
  function restore() {
    E.ducked = false;
    if (E.musicOn) ramp(E.bus.music, vol().music, E.cfg.restoreMs);
    emit();
  }

  /* ---------- narração (MP3) ---------- */
  // Sempre uma narração por vez: tocar outra para a anterior.
  function playNarration(url) {
    const el = E.narrEl;
    const token = ++E.narrToken;
    el.pause();
    el.src = url;
    if (!E.routed) el.volume = E.muted ? 0 : vol().narration;
    let finish;
    const done = new Promise((resolve, reject) => {
      finish = (err) => {
        if (token !== E.narrToken) return; // narração antiga: ignora
        el.onended = el.onerror = null;
        err ? reject(err) : resolve('ended');
      };
      el.onended = () => finish();
      el.onerror = () => {
        if (token !== E.narrToken) return; // erro de um src antigo (troca ou parada)
        E.known.set(url, false);
        finish(new Error('audio: ' + url));
      };
    });
    el.play().catch((err) => finish(err));
    return {
      done,
      pause: () => { if (token === E.narrToken) el.pause(); },
      resume: () => { if (token === E.narrToken) el.play().catch(() => {}); },
      stop: () => { if (token === E.narrToken) { el.pause(); E.narrToken++; el.removeAttribute('src'); el.load(); } },
      time: () => el.currentTime || 0,
      duration: () => (Number.isFinite(el.duration) ? el.duration : 0),
      element: el,
    };
  }

  /* ---------- efeitos ---------- */
  async function playSFX(name) {
    if (!E.ready || E.muted || !E.ctx) return;
    const url = E.cfg.sfx?.[name];
    try {
      if (url && await exists(url) !== false) {
        const src = E.ctx.createBufferSource();
        src.buffer = await loadBuffer(url);
        src.connect(E.bus.sfx);
        src.start();
        return;
      }
    } catch { E.known.set(url, false); }
    if (E.cfg.synthSfx) synthSfx(name);
  }

  // Efeitos curtos gerados pelo navegador (quando o MP3 do efeito não existe)
  function synthSfx(name) {
    const ctx = E.ctx, t = ctx.currentTime + 0.01;
    const tone = (f, at, len, peak = 0.3, type = 'sine') => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g).connect(E.bus.sfx);
      o.start(at); o.stop(at + len + 0.05);
    };
    if (name === 'transition') {
      // "whoosh": ruído passando por um filtro que sobe
      const len = 0.6, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
      const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(3200, t + len);
      g.gain.value = 0.8; // o filtro estreito come boa parte do ruído
      src.connect(bp).connect(g).connect(E.bus.sfx);
      src.start(t);
    } else if (name === 'unlock') {
      tone(659.25, t, 0.35); tone(987.77, t + 0.11, 0.6);
    } else if (name === 'start') {
      [440, 554.37, 659.25, 880].forEach((f, k) => tone(f, t + k * 0.08, 0.5, 0.22));
    } else if (name === 'final') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => tone(f, t + k * 0.12, 1.6, 0.18, 'triangle'));
    }
  }

  /* ---------- volumes e mudo ---------- */
  const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  function setMusicVolume(v) { vol().music = clamp(v); if (E.musicOn && !E.ducked) ramp(E.bus.music, vol().music, 400); emit(); }
  function setNarrationVolume(v) { vol().narration = clamp(v); ramp(E.bus.narration, vol().narration, 200); if (!E.routed) E.narrEl.volume = vol().narration; emit(); }
  function setSfxVolume(v) { vol().sfx = clamp(v); ramp(E.bus.sfx, vol().sfx, 200); emit(); }
  function setMuted(m) {
    E.muted = !!m;
    if (E.ctx) ramp(E.bus.master, E.muted ? 0 : 1, 400);
    if (!E.routed) E.narrEl.volume = E.muted ? 0 : vol().narration;
    emit();
  }

  window.AudioEngine = {
    init, unlock, exists, state, preload,
    playMusic, pauseMusic, duck, restore,
    playNarration, playSFX,
    setMusicVolume, setNarrationVolume, setSfxVolume, setMuted,
    get ready() { return E.ready; },
    get muted() { return E.muted; },
    get narrationVolume() { return vol().narration; },
    onChange(fn) { E.listeners.add(fn); return () => E.listeners.delete(fn); },
  };
})();
