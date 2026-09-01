import { createJarvisCore } from './orb3d.js';
import { createHandTracker } from './handTracker.js';

const $ = (id) => document.getElementById(id);
const screens = ['bootScreen', 'identifyScreen', 'welcomeScreen', 'dashboard'];
const startTime = performance.now();
let core;
let cameraStream = null;
let micStream = null;
let handTracker = null;
let handEnabled = false;
let analyser = null;
let audioData = null;
let recognition = null;
let recognitionActive = false;
let currentState = 'idle';
let demoTimer = null;

const moduleCopy = {
  CORE: 'Central orchestration and 3D status visualization.',
  VOICE: 'Speech input, sound response and command routing.',
  SYSTEM: 'Browser telemetry, performance and runtime diagnostics.',
  NETWORK: 'Connection type, latency estimate and online status.',
  CAMERA: 'Optical sensor preview and MediaPipe hand control.',
  FILES: 'Reserved file workflow module for future desktop integration.',
  AI: 'Reasoning state, command execution and assistant feedback.',
};

function showScreen(id) {
  screens.forEach((name) => $(name)?.classList.toggle('active', name === id));
}

function setMessage(text) {
  $('systemMessage').textContent = text;
}

function setState(state, message) {
  currentState = state;
  const labels = {
    idle: 'STANDBY', listening: 'LISTENING', thinking: 'THINKING', executing: 'EXECUTING', speaking: 'SPEAKING'
  };
  const aiState = $('aiState');
  aiState.textContent = labels[state] || state.toUpperCase();
  aiState.className = state === 'idle' ? '' : `state-${state}`;
  core?.setState(state);
  if (message) setMessage(message);
}

function setGauge(value, label = 'READY') {
  const n = Math.max(0, Math.min(100, Math.round(value)));
  $('gaugeValue').textContent = String(n);
  $('gaugeLabel').textContent = label;
  const circumference = 301.59;
  $('gaugeArc').style.strokeDashoffset = String(circumference * (1 - n / 100));
}

function selectModule(name) {
  const moduleName = name.toUpperCase();
  $('activeModuleLabel').textContent = moduleName;
  $('coreMode').textContent = moduleName;
  $('moduleDescription').textContent = moduleCopy[moduleName] || moduleCopy.CORE;
  document.querySelectorAll('#moduleRing button').forEach((button) => {
    button.classList.toggle('active', button.dataset.module === moduleName);
  });
  setMessage(`${moduleName} MODULE SELECTED`);
}

function routeStep(step) {
  document.querySelectorAll('#processRoute [data-step]').forEach((el) => el.classList.toggle('active', el.dataset.step === step));
}

function boot() {
  const lines = [
    'NEXUS KERNEL ............... OK',
    'THREE.JS RENDER PIPELINE ... READY',
    'OPTICAL INTERFACE .......... STANDBY',
    'VOICE INTERFACE ............ STANDBY',
    'HAND GESTURE BRIDGE ........ READY',
    'SECURITY LAYER ............. VERIFIED',
    'JARVIS CORE ................ ONLINE',
  ];
  let percent = 0;
  let lineIndex = 0;
  const timer = setInterval(() => {
    percent = Math.min(100, percent + 2 + Math.random() * 5);
    $('bootProgress').style.width = `${percent}%`;
    $('bootPercent').textContent = `${Math.round(percent)}%`;
    if (lineIndex < lines.length && percent > (lineIndex + 1) * 12) {
      const row = document.createElement('div');
      row.textContent = `> ${lines[lineIndex++]}`;
      $('bootLog').appendChild(row);
    }
    if (percent >= 100) {
      clearInterval(timer);
      setTimeout(() => {
        const savedName = localStorage.getItem('jarvis.operator');
        if (savedName) welcome(savedName);
        else showScreen('identifyScreen');
      }, 450);
    }
  }, 70);
}

function authenticate() {
  const name = $('operatorName').value.trim() || 'OPERATOR';
  localStorage.setItem('jarvis.operator', name);
  welcome(name);
}

function welcome(name) {
  $('welcomeName').textContent = name.toUpperCase();
  showScreen('welcomeScreen');
  setTimeout(() => {
    showScreen('dashboard');
    setState('idle', `WELCOME ${name.toUpperCase()} // NEXUS READY`);
  }, 1500);
}

function updateClock() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString([], { hour12: false });
  $('dateLabel').textContent = now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();
}

function formatDuration(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function telemetryLoop() {
  let frames = 0;
  let lastFpsTime = performance.now();
  function frame(now) {
    frames += 1;
    if (now - lastFpsTime >= 1000) {
      const fps = Math.round((frames * 1000) / (now - lastFpsTime));
      frames = 0;
      lastFpsTime = now;
      $('fpsValue').textContent = `${fps} FPS`;
      $('fpsBar').style.width = `${Math.min(100, (fps / 60) * 100)}%`;
      const memory = performance.memory;
      if (memory) {
        const used = memory.usedJSHeapSize / 1048576;
        const limit = memory.jsHeapSizeLimit / 1048576;
        $('heapValue').textContent = `${used.toFixed(0)} MB`;
        $('heapBar').style.width = `${Math.min(100, (used / limit) * 100)}%`;
      } else {
        $('heapValue').textContent = 'BROWSER N/A';
        $('heapBar').style.width = '18%';
      }
      $('uptimeValue').textContent = formatDuration((performance.now() - startTime) / 1000);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function refreshNetwork() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const online = navigator.onLine;
  $('networkValue').textContent = online ? 'ONLINE' : 'OFFLINE';
  $('networkBar').style.width = online ? '92%' : '4%';
  $('linkQuality').textContent = online ? 'NOMINAL' : 'LOST';
  $('rttValue').textContent = connection?.rtt ? `${connection.rtt} ms` : 'N/A';
  $('downlinkValue').textContent = connection?.downlink ? `${connection.downlink} Mb/s` : 'N/A';
  $('netTypeValue').textContent = (connection?.effectiveType || connection?.type || 'N/A').toUpperCase();
}

async function ensureMic() {
  if (micStream) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass();
  const source = context.createMediaStreamSource(micStream);
  analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);
  audioData = new Uint8Array(analyser.fftSize);
  return micStream;
}

function drawWaveform() {
  const canvas = $('waveCanvas');
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(112,246,255,.78)';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  let level = 0;
  if (analyser && audioData) {
    analyser.getByteTimeDomainData(audioData);
    for (let i = 0; i < audioData.length; i += 1) level += Math.abs(audioData[i] - 128);
    level /= audioData.length * 128;
    audioData.forEach((value, i) => {
      const x = (i / (audioData.length - 1)) * w;
      const y = (value / 255) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
  } else {
    const t = performance.now() * 0.002;
    const amp = currentState === 'thinking' ? 0.16 : 0.055;
    for (let i = 0; i < 180; i += 1) {
      const x = (i / 179) * w;
      const y = h / 2 + Math.sin(i * 0.16 + t) * h * amp * (0.45 + 0.55 * Math.sin(i * 0.033 + t * 0.4));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  $('audioLevel').textContent = level.toFixed(2);
  requestAnimationFrame(drawWaveform);
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $('speechSupport').textContent = 'UNSUPPORTED';
    $('voiceButton').disabled = true;
    return;
  }
  $('speechSupport').textContent = 'READY';
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';
  recognition.onstart = () => {
    recognitionActive = true;
    $('voiceButton').textContent = 'LISTENING...';
    setState('listening', 'VOICE CHANNEL OPEN');
    routeStep('voice');
  };
  recognition.onresult = (event) => {
    const text = Array.from(event.results).map((r) => r[0].transcript).join(' ');
    $('transcript').textContent = text;
    if (event.results[event.results.length - 1].isFinal) handleCommand(text);
  };
  recognition.onerror = (event) => {
    $('transcript').textContent = `Voice error: ${event.error}`;
    setState('idle', 'VOICE CHANNEL ERROR');
  };
  recognition.onend = () => {
    recognitionActive = false;
    $('voiceButton').textContent = 'ENABLE VOICE';
    if (currentState === 'listening') setState('idle', 'VOICE CHANNEL CLOSED');
  };
}

async function startVoice() {
  try {
    await ensureMic();
    if (recognitionActive) recognition.stop(); else recognition.start();
  } catch (error) {
    $('transcript').textContent = `Microphone unavailable: ${error.message}`;
    setState('idle', 'MICROPHONE PERMISSION REQUIRED');
  }
}

function handleCommand(text) {
  const command = text.toLowerCase();
  setState('thinking', 'COMMAND PARSER ACTIVE');
  routeStep('parser');
  setGauge(35, 'PARSING');
  setTimeout(() => {
    routeStep('core');
    setGauge(62, 'ROUTING');
    if (command.includes('camera')) selectModule('CAMERA');
    else if (command.includes('network')) selectModule('NETWORK');
    else if (command.includes('system')) selectModule('SYSTEM');
    else if (command.includes('file')) selectModule('FILES');
    else if (command.includes('voice')) selectModule('VOICE');
    else if (command.includes('ai') || command.includes('jarvis')) selectModule('AI');
    if (command.includes('reset')) core?.resetView();
    if (command.includes('fullscreen')) document.documentElement.requestFullscreen?.();
    if (command.includes('hand')) toggleHandControl();
    setTimeout(() => {
      routeStep('execute');
      setGauge(100, 'DONE');
      setState('executing', 'COMMAND EXECUTED');
      setTimeout(() => {
        routeStep('');
        setGauge(0, 'READY');
        setState('idle', 'ALL PRIMARY SYSTEMS NOMINAL');
      }, 900);
    }, 500);
  }, 500);
}

async function toggleCamera() {
  if (cameraStream) {
    handTracker?.stop();
    handTracker = null;
    handEnabled = false;
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    $('cameraVideo').srcObject = null;
    $('cameraPlaceholder').style.display = '';
    $('cameraStatus').textContent = 'OFFLINE';
    $('cameraButton').textContent = 'ACTIVATE CAMERA';
    $('handButton').disabled = true;
    $('handButton').textContent = 'HAND CONTROL';
    selectModule('CORE');
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    $('cameraVideo').srcObject = cameraStream;
    await $('cameraVideo').play();
    $('cameraPlaceholder').style.display = 'none';
    $('cameraStatus').textContent = 'ONLINE';
    $('cameraButton').textContent = 'DISABLE CAMERA';
    $('handButton').disabled = false;
    selectModule('CAMERA');
  } catch (error) {
    $('cameraStatus').textContent = 'DENIED';
    $('transcript').textContent = `Camera unavailable: ${error.message}`;
  }
}

async function toggleHandControl() {
  if (!cameraStream) {
    await toggleCamera();
    if (!cameraStream) return;
  }
  if (handEnabled) {
    handTracker?.stop();
    handTracker = null;
    handEnabled = false;
    $('handButton').textContent = 'HAND CONTROL';
    $('cameraStatus').textContent = 'ONLINE';
    setMessage('HAND CONTROL DISABLED');
    return;
  }
  try {
    $('handButton').textContent = 'LOADING...';
    $('handButton').disabled = true;
    handTracker = await createHandTracker({
      video: $('cameraVideo'),
      canvas: $('handCanvas'),
      onRotate: (dx, dy) => core?.rotateBy(dx, dy),
      onZoom: (factor) => core?.zoomBy(factor),
      onStatus: (status) => { $('cameraStatus').textContent = status; },
    });
    handEnabled = true;
    $('handButton').disabled = false;
    $('handButton').textContent = 'STOP HAND';
    setMessage('PINCH ONE HAND TO ROTATE // PINCH TWO HANDS TO ZOOM');
  } catch (error) {
    $('handButton').disabled = false;
    $('handButton').textContent = 'HAND CONTROL';
    $('cameraStatus').textContent = 'TRACKING ERROR';
    $('transcript').textContent = `Hand tracking failed: ${error.message}`;
  }
}

function runDemo() {
  if (demoTimer) clearInterval(demoTimer);
  let value = 0;
  const steps = [['voice', 15], ['parser', 36], ['core', 62], ['execute', 82]];
  setState('thinking', 'NEXUS DEMONSTRATION RUNNING');
  $('transcript').textContent = 'Analyzing command route → voice → parser → core → execute';
  demoTimer = setInterval(() => {
    value += 2;
    setGauge(value, value < 35 ? 'LISTEN' : value < 62 ? 'PARSE' : value < 82 ? 'THINK' : value < 100 ? 'EXECUTE' : 'DONE');
    const active = [...steps].reverse().find(([, threshold]) => value >= threshold)?.[0];
    if (active) routeStep(active);
    if (value >= 100) {
      clearInterval(demoTimer);
      demoTimer = null;
      setState('executing', 'DEMO COMPLETE');
      setTimeout(() => { setGauge(0, 'READY'); routeStep(''); setState('idle', 'ALL PRIMARY SYSTEMS NOMINAL'); }, 1000);
    }
  }, 45);
}

function bindUi() {
  $('identifyButton').addEventListener('click', authenticate);
  $('operatorName').addEventListener('keydown', (event) => { if (event.key === 'Enter') authenticate(); });
  document.querySelectorAll('#moduleRing button').forEach((button) => button.addEventListener('click', () => selectModule(button.dataset.module)));
  $('voiceButton').addEventListener('click', startVoice);
  $('cameraButton').addEventListener('click', toggleCamera);
  $('handButton').addEventListener('click', toggleHandControl);
  $('executeDemoButton').addEventListener('click', runDemo);
  $('resetButton').addEventListener('click', () => { core?.resetView(); selectModule('CORE'); setGauge(0, 'READY'); });
  $('fullscreenButton').addEventListener('click', async () => {
    if (document.fullscreenElement) await document.exitFullscreen?.(); else await document.documentElement.requestFullscreen?.();
  });
  $('identityButton').addEventListener('click', () => {
    localStorage.removeItem('jarvis.operator');
    $('operatorName').value = '';
    showScreen('identifyScreen');
  });
  window.addEventListener('online', refreshNetwork);
  window.addEventListener('offline', refreshNetwork);
}

function init() {
  core = createJarvisCore($('orbCanvas'));
  bindUi();
  setupSpeechRecognition();
  telemetryLoop();
  refreshNetwork();
  setInterval(refreshNetwork, 5000);
  updateClock();
  setInterval(updateClock, 1000);
  drawWaveform();
  boot();
}

window.addEventListener('beforeunload', () => {
  handTracker?.stop();
  cameraStream?.getTracks().forEach((track) => track.stop());
  micStream?.getTracks().forEach((track) => track.stop());
  core?.dispose();
});

init();
