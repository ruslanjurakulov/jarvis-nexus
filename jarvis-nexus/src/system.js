export class SystemTelemetry {
  constructor(elements) {
    this.el = elements;
    this.startedAt = performance.now();
    this.lastFrame = performance.now();
    this.frames = 0;
    this.lastFpsUpdate = this.lastFrame;
    this.fps = 60;
    this.connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  }

  start() {
    this.tickClock();
    this.tickUptime();
    this.updateNetwork();
    this.sampleFps(performance.now());
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
    this.uptimeTimer = setInterval(() => this.tickUptime(), 1000);
    this.networkTimer = setInterval(() => this.updateNetwork(), 2500);
    window.addEventListener('online', () => this.updateNetwork());
    window.addEventListener('offline', () => this.updateNetwork());
    this.connection?.addEventListener?.('change', () => this.updateNetwork());
  }

  stop() {
    clearInterval(this.clockTimer);
    clearInterval(this.uptimeTimer);
    clearInterval(this.networkTimer);
  }

  sampleFps(now) {
    this.frames += 1;
    const elapsed = now - this.lastFpsUpdate;
    if (elapsed >= 800) {
      this.fps = Math.round((this.frames * 1000) / elapsed);
      this.frames = 0;
      this.lastFpsUpdate = now;
      this.el.fpsValue.textContent = `${this.fps} FPS`;
      this.el.fpsBar.style.width = `${Math.min(100, (this.fps / 60) * 100)}%`;
      this.updateHeap();
    }
    requestAnimationFrame((t) => this.sampleFps(t));
  }

  updateHeap() {
    const memory = performance.memory;
    if (!memory?.jsHeapSizeLimit) {
      this.el.heapValue.textContent = 'UNAVAILABLE';
      this.el.heapBar.style.width = '0%';
      return;
    }
    const used = memory.usedJSHeapSize;
    const limit = memory.jsHeapSizeLimit;
    const percent = Math.max(0, Math.min(100, (used / limit) * 100));
    this.el.heapValue.textContent = `${(used / 1048576).toFixed(0)} MB`;
    this.el.heapBar.style.width = `${percent}%`;
  }

  updateNetwork() {
    const online = navigator.onLine;
    this.el.networkValue.textContent = online ? 'ONLINE' : 'OFFLINE';
    this.el.networkBar.style.width = online ? '100%' : '3%';
    this.el.rttValue.textContent = this.connection?.rtt ? `${this.connection.rtt} MS` : 'N/A';
    this.el.downlinkValue.textContent = this.connection?.downlink ? `${this.connection.downlink} MBPS` : 'N/A';
    this.el.netTypeValue.textContent = (this.connection?.effectiveType || 'N/A').toUpperCase();
    const score = !online ? 0 : this.connection?.rtt ? Math.max(0, Math.min(100, 100 - this.connection.rtt / 4)) : 75;
    this.el.linkQuality.textContent = score > 80 ? 'EXCELLENT' : score > 55 ? 'STABLE' : score > 0 ? 'DEGRADED' : 'OFFLINE';
  }

  tickClock() {
    const now = new Date();
    this.el.clock.textContent = now.toLocaleTimeString([], { hour12: false });
    this.el.dateLabel.textContent = now.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();
  }

  tickUptime() {
    const seconds = Math.floor((performance.now() - this.startedAt) / 1000);
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    this.el.uptimeValue.textContent = `${h}:${m}:${s}`;
  }
}
