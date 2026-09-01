const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const PINCH_ON = 0.32;
const PINCH_OFF = 0.45;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

export async function createHandTracker({ video, canvas, onRotate, onZoom, onStatus }) {
  const ctx = canvas.getContext('2d');
  const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm');
  const resolver = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');

  async function makeLandmarker(delegate) {
    return vision.HandLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate,
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  let landmarker;
  try {
    landmarker = await makeLandmarker('GPU');
    onStatus?.('GPU TRACKING');
  } catch {
    landmarker = await makeLandmarker('CPU');
    onStatus?.('CPU TRACKING');
  }

  let running = true;
  let lastVideoTime = -1;
  const pinched = [false, false];
  let prevSingle = null;
  let prevTwoDistance = null;

  function isPinched(hand, index) {
    const scale = Math.max(distance(hand[WRIST], hand[MIDDLE_MCP]), 0.001);
    const ratio = distance(hand[THUMB_TIP], hand[INDEX_TIP]) / scale;
    if (pinched[index]) pinched[index] = ratio < PINCH_OFF;
    else pinched[index] = ratio < PINCH_ON;
    return pinched[index];
  }

  function draw(hands) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1.2 * dpr;
    hands.forEach((hand, hi) => {
      const active = pinched[hi];
      ctx.strokeStyle = active ? '#ffae54' : 'rgba(112,246,255,.72)';
      ctx.fillStyle = active ? '#ffae54' : 'rgba(112,246,255,.9)';
      const points = [WRIST, MIDDLE_MCP, INDEX_TIP, THUMB_TIP];
      ctx.beginPath();
      points.forEach((idx, i) => {
        const p = hand[idx];
        const x = p.x * w;
        const y = p.y * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      points.forEach((idx) => {
        const p = hand[idx];
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 3.2 * dpr, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  function updateGestures(hands) {
    const activeHands = hands.map((hand, i) => ({ hand, pinched: isPinched(hand, i) })).filter((x) => x.pinched);
    if (activeHands.length === 1) {
      const p = activeHands[0].hand[INDEX_TIP];
      if (prevSingle) {
        const dx = p.x - prevSingle.x;
        const dy = p.y - prevSingle.y;
        onRotate?.(-dx * 6.2, dy * 6.2);
      }
      prevSingle = { x: p.x, y: p.y };
      prevTwoDistance = null;
    } else if (activeHands.length >= 2) {
      const p1 = activeHands[0].hand[MIDDLE_MCP];
      const p2 = activeHands[1].hand[MIDDLE_MCP];
      const current = distance(p1, p2);
      if (prevTwoDistance && current > 0.02) {
        const factor = Math.max(0.88, Math.min(1.12, prevTwoDistance / current));
        onZoom?.(factor);
      }
      prevTwoDistance = current;
      prevSingle = null;
    } else {
      prevSingle = null;
      prevTwoDistance = null;
    }
  }

  async function loop() {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      const hands = result.landmarks || [];
      updateGestures(hands);
      draw(hands);
    }
    requestAnimationFrame(loop);
  }
  loop();

  return {
    stop() {
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      landmarker.close?.();
      onStatus?.('HAND CONTROL OFF');
    },
  };
}
