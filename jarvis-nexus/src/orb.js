const TAU = Math.PI * 2;

export class NexusOrb {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rotationX = -0.15;
    this.rotationY = 0;
    this.targetX = this.rotationX;
    this.targetY = this.rotationY;
    this.zoom = 1;
    this.targetZoom = 1;
    this.dragging = false;
    this.last = { x: 0, y: 0 };
    this.energy = 0.5;
    this.targetEnergy = 0.5;
    this.mode = 'CORE';
    this.particles = Array.from({ length: 310 }, () => this.makeParticle());
    this.resize();
    this.bind();
    this.loop(performance.now());
  }

  makeParticle() {
    const u = Math.random();
    const v = Math.random();
    const theta = TAU * u;
    const phi = Math.acos(2 * v - 1);
    const radius = .74 + Math.random() * .28;
    return { x: radius * Math.sin(phi) * Math.cos(theta), y: radius * Math.cos(phi), z: radius * Math.sin(phi) * Math.sin(theta), size: .45 + Math.random() * 1.2, alpha: .15 + Math.random() * .8 };
  }

  bind() {
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true; this.last = { x: e.clientX, y: e.clientY }; this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.last.x, dy = e.clientY - this.last.y;
      this.targetY += dx * .006; this.targetX += dy * .006;
      this.targetX = Math.max(-1.2, Math.min(1.2, this.targetX));
      this.last = { x: e.clientX, y: e.clientY };
    });
    const end = () => { this.dragging = false; };
    this.canvas.addEventListener('pointerup', end); this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.targetZoom *= e.deltaY > 0 ? .92 : 1.08;
      this.targetZoom = Math.max(.72, Math.min(1.42, this.targetZoom));
    }, { passive: false });
    this.canvas.addEventListener('dblclick', () => this.reset());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  reset() { this.targetX = -.15; this.targetY = 0; this.targetZoom = 1; }
  setMode(mode) { this.mode = mode; this.targetEnergy = mode === 'AI' ? .95 : mode === 'VOICE' ? .78 : mode === 'SYSTEM' ? .68 : .58; }
  pulse(strength = 1) { this.targetEnergy = Math.max(this.targetEnergy, strength); setTimeout(() => { this.targetEnergy = .55; }, 650); }

  rotatePoint(p) {
    const cy = Math.cos(this.rotationY), sy = Math.sin(this.rotationY);
    const cx = Math.cos(this.rotationX), sx = Math.sin(this.rotationX);
    const x1 = p.x * cy - p.z * sy;
    const z1 = p.x * sy + p.z * cy;
    const y2 = p.y * cx - z1 * sx;
    const z2 = p.y * sx + z1 * cx;
    return { x: x1, y: y2, z: z2 };
  }

  loop(now) {
    this.rotationX += (this.targetX - this.rotationX) * .07;
    this.rotationY += (this.targetY - this.rotationY) * .07;
    if (!this.dragging) { this.rotationY += .0016; this.targetY += .0016; }
    this.zoom += (this.targetZoom - this.zoom) * .08;
    this.energy += (this.targetEnergy - this.energy) * .075;
    this.draw(now / 1000);
    requestAnimationFrame((t) => this.loop(t));
  }

  circle(ctx, x, y, r, stroke, width = 1, dash = []) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  }

  draw(time) {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height, cx = w / 2, cy = h / 2;
    const base = Math.min(w, h) * .205 * this.zoom;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(cx, cy, base * .05, cx, cy, base * 2.9);
    glow.addColorStop(0, `rgba(95,246,255,${.10 + this.energy * .08})`);
    glow.addColorStop(.34, 'rgba(22,127,136,.05)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

    // Rotating outer segmented rings.
    const rings = [1.35, 1.58, 1.86, 2.14];
    rings.forEach((scale, i) => {
      const r = base * scale;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * (i % 2 ? -.06 : .045) * (i + 1));
      const segments = 18 + i * 7;
      for (let s = 0; s < segments; s++) {
        if ((s + i) % (4 + i) === 0) continue;
        const a0 = (s / segments) * TAU;
        const gap = .012 + i * .002;
        const len = TAU / segments - gap;
        ctx.beginPath(); ctx.arc(0, 0, r, a0, a0 + len);
        ctx.strokeStyle = i === 1 ? 'rgba(255,187,102,.24)' : `rgba(95,246,255,${.13 + i * .025})`;
        ctx.lineWidth = i === 3 ? 1 : 1.4;
        ctx.stroke();
      }
      ctx.restore();
    });

    // Angular ticks.
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-time * .025);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const r1 = base * 2.28, r2 = r1 + (i % 6 === 0 ? 10 : 4);
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.strokeStyle = i % 6 === 0 ? 'rgba(95,246,255,.42)' : 'rgba(95,246,255,.13)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();

    // Core sphere.
    const coreGrad = ctx.createRadialGradient(cx - base * .26, cy - base * .3, base * .05, cx, cy, base);
    coreGrad.addColorStop(0, `rgba(209,255,255,${.55 + this.energy * .28})`);
    coreGrad.addColorStop(.16, `rgba(75,232,242,${.34 + this.energy * .22})`);
    coreGrad.addColorStop(.56, 'rgba(8,64,72,.24)');
    coreGrad.addColorStop(1, 'rgba(0,8,12,.10)');
    ctx.beginPath(); ctx.arc(cx, cy, base, 0, TAU); ctx.fillStyle = coreGrad; ctx.fill();
    this.circle(ctx, cx, cy, base, `rgba(95,246,255,${.46 + this.energy * .22})`, 1.2);
    this.circle(ctx, cx, cy, base * .91, 'rgba(95,246,255,.11)', 1, [2, 5]);

    // Latitude and longitude lines for depth.
    ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = 'rgba(95,246,255,.11)'; ctx.lineWidth = .7;
    for (let lat = -2; lat <= 2; lat++) {
      const y = Math.sin(lat * .38 + this.rotationX) * base * .7;
      const rx = Math.sqrt(Math.max(0, 1 - (y / base) ** 2)) * base;
      ctx.beginPath(); ctx.ellipse(0, y, rx, rx * .22, this.rotationY * .35, 0, TAU); ctx.stroke();
    }
    for (let lon = 0; lon < 7; lon++) {
      ctx.beginPath(); ctx.ellipse(0, 0, base * Math.abs(Math.cos(this.rotationY + lon * Math.PI / 7)), base, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // 3D-ish particles with z-depth.
    const pts = this.particles.map((p) => this.rotatePoint(p)).sort((a, b) => a.z - b.z);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const scale = 1 + p.z * .17;
      const x = cx + p.x * base * scale;
      const y = cy + p.y * base * scale;
      const source = this.particles[i % this.particles.length];
      const alpha = Math.max(.05, Math.min(.8, source.alpha * (.45 + (p.z + 1) * .28)));
      ctx.fillStyle = `rgba(145,255,178,${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, source.size * (p.z > 0 ? 1.15 : .72), 0, TAU); ctx.fill();
    }

    // Energy arcs.
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * .31);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const start = i * 2.05 + Math.sin(time * .8 + i) * .18;
      ctx.arc(0, 0, base * (1.08 + i * .08), start, start + .32 + this.energy * .28);
      ctx.strokeStyle = i === 1 ? `rgba(255,187,102,${.25 + this.energy * .5})` : `rgba(95,246,255,${.25 + this.energy * .52})`;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 9; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.restore(); ctx.shadowBlur = 0;
  }
}
