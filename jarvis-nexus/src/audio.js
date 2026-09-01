export class AudioVisualizer {
  constructor(canvas, levelElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.levelElement = levelElement;
    this.running = false;
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.data = new Uint8Array(256);
    this.phase = 0;
    this.drawIdle();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async start() {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.74;
    source.connect(this.analyser);
    this.data = new Uint8Array(this.analyser.fftSize);
    this.running = true;
    this.drawLive();
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.analyser = null;
    this.levelElement.textContent = '0.00';
    this.drawIdle();
  }

  drawGrid(width, height) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(95,246,255,.065)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y <= height; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  }

  drawIdle() {
    this.resize();
    const rect = this.canvas.getBoundingClientRect();
    const loop = () => {
      if (this.running) return;
      this.phase += 0.025;
      this.drawGrid(rect.width, rect.height);
      const ctx = this.ctx;
      ctx.beginPath();
      for (let x = 0; x <= rect.width; x += 3) {
        const taper = 0.35 + 0.65 * Math.sin((x / rect.width) * Math.PI);
        const y = rect.height / 2 + Math.sin(x * 0.035 + this.phase) * 2.2 * taper + Math.sin(x * 0.011 - this.phase * 1.8) * 1.2;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(95,246,255,.34)';
      ctx.lineWidth = 1;
      ctx.stroke();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  drawLive() {
    this.resize();
    const loop = () => {
      if (!this.running || !this.analyser) return;
      const rect = this.canvas.getBoundingClientRect();
      this.analyser.getByteTimeDomainData(this.data);
      this.drawGrid(rect.width, rect.height);
      const ctx = this.ctx;
      ctx.beginPath();
      let rms = 0;
      for (let i = 0; i < this.data.length; i++) {
        const normalized = (this.data[i] - 128) / 128;
        rms += normalized * normalized;
        const x = (i / (this.data.length - 1)) * rect.width;
        const y = rect.height / 2 + normalized * rect.height * .39;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      rms = Math.sqrt(rms / this.data.length);
      this.levelElement.textContent = rms.toFixed(2);
      ctx.strokeStyle = 'rgba(255,187,102,.95)';
      ctx.shadowColor = 'rgba(255,187,102,.5)';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.shadowBlur = 0;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
