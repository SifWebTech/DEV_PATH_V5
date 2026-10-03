/*
 * Fundo da TV: trilhas de placa de circuito com pulsos de energia.
 * As trilhas são desenhadas uma vez num canvas fora da tela; a cada
 * quadro só os pulsos são pintados por cima.
 *
 *   circuit.setEnergy(0..1)  → mais pulsos, mais rápidos (sobe a cada semestre)
 *   circuit.burst()          → onda de pulsos (usado no lançamento)
 */
(function () {
  const canvas = document.getElementById('circuit');
  const ctx = canvas.getContext('2d');
  const COLORS = ['#ff7a1a', '#2bff88', '#22b8ff', '#f3f8ff'];
  const GRID = 34;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W, H, DPR, traces = [], pulses = [], base, energy = 0.15, last = 0;

  // Caminho ortogonal/diagonal que começa numa borda e vagueia pela tela
  function makeTrace() {
    const cols = Math.ceil(W / GRID), rows = Math.ceil(H / GRID);
    const side = Math.floor(Math.random() * 4);
    let x = side === 1 ? cols : side === 3 ? 0 : Math.floor(Math.random() * cols);
    let y = side === 0 ? 0 : side === 2 ? rows : Math.floor(Math.random() * rows);
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    let d = side === 0 ? [0, 1] : side === 1 ? [-1, 0] : side === 2 ? [0, -1] : [1, 0];
    const pts = [[x * GRID, y * GRID]];
    const segs = 4 + Math.floor(Math.random() * 7);
    for (let i = 0; i < segs; i++) {
      const len = 2 + Math.floor(Math.random() * 7);
      x += d[0] * len; y += d[1] * len;
      pts.push([x * GRID, y * GRID]);
      // vira 45° para um dos lados — parecido com roteamento de PCB
      const idx = dirs.findIndex((v) => v[0] === d[0] && v[1] === d[1]);
      const turn = [[4, 7], [4, 5], [5, 6], [6, 7], [0, 1], [1, 2], [0, 3], [2, 3]][idx];
      d = dirs[turn[Math.floor(Math.random() * 2)]];
    }
    let length = 0;
    const lens = [];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l); length += l;
    }
    return { pts, lens, length, color: COLORS[Math.floor(Math.random() * 3)] };
  }

  function pointAt(t, dist) {
    let acc = 0;
    for (let i = 0; i < t.lens.length; i++) {
      if (acc + t.lens[i] >= dist) {
        const k = (dist - acc) / t.lens[i];
        const a = t.pts[i], b = t.pts[i + 1];
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      }
      acc += t.lens[i];
    }
    return t.pts[t.pts.length - 1];
  }

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    traces = Array.from({ length: Math.round((W * H) / 26000) }, makeTrace);
    base = document.createElement('canvas');
    base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext('2d');
    b.scale(DPR, DPR);
    b.lineWidth = 1.2;
    b.lineJoin = 'round';
    for (const t of traces) {
      b.strokeStyle = t.color + '1c';
      b.beginPath();
      t.pts.forEach(([px, py], i) => (i ? b.lineTo(px, py) : b.moveTo(px, py)));
      b.stroke();
      const [ex, ey] = t.pts[t.pts.length - 1];
      b.fillStyle = t.color + '30';
      b.beginPath(); b.arc(ex, ey, 3, 0, Math.PI * 2); b.fill();
    }
    // pontos da grade, bem discretos
    b.fillStyle = '#22b8ff14';
    for (let gx = 0; gx < W; gx += GRID) for (let gy = 0; gy < H; gy += GRID) b.fillRect(gx, gy, 1.2, 1.2);
  }

  function spawn() {
    const t = traces[Math.floor(Math.random() * traces.length)];
    pulses.push({ t, d: 0, speed: 250 + Math.random() * 100 + energy * 1000, tail: 150 + energy * 150 });
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // pulsos por segundo: ~4 em repouso, ~30 no auge
    if (Math.random() < (4 + energy * 26) * dt) spawn();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    pulses = pulses.filter((p) => {
      p.d += p.speed * dt;
      if (p.d - p.tail > p.t.length) return false;
      const steps = 8;
      for (let s = 0; s < steps; s++) {
        const d1 = p.d - (p.tail * s) / steps;
        const d2 = p.d - (p.tail * (s + 1)) / steps;
        if (d1 < 0 || d1 > p.t.length) continue;
        const [x1, y1] = pointAt(p.t, d1);
        const [x2, y2] = pointAt(p.t, Math.max(d2, 0));
        const a = 1 - s / steps;
        ctx.strokeStyle = p.t.color;
        ctx.globalAlpha = a * 0.22;
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalAlpha = a * 0.9;
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      return true;
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (pulses.length > 90) pulses.splice(0, pulses.length - 90);
    requestAnimationFrame(frame);
  }

  window.circuit = {
    setEnergy(v) { energy = Math.max(0, Math.min(1, v)); },
    burst(n = 40) { for (let i = 0; i < n; i++) spawn(); },
  };

  addEventListener('resize', resize);
  resize();
  if (reduced) { ctx.drawImage(base, 0, 0); return; }
  requestAnimationFrame((t) => { last = t; frame(t); });
})();
