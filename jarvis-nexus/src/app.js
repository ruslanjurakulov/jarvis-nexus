import { NexusOrb } from './orb.js';
import { AudioVisualizer } from './audio.js';
import { SystemTelemetry } from './system.js';

const $ = (id) => document.getElementById(id);
const screens = ['bootScreen', 'identifyScreen', 'welcomeScreen', 'dashboard'];
const moduleInfo = {
  CORE: 'Central orchestration and status visualization.',
  VOICE: 'Microphone input, live waveform and speech command routing.',
  SYSTEM: 'Browser telemetry, render performance and runtime diagnostics.',
  NETWORK: 'Connection state, link quality, round-trip latency and downlink data.',
  CAMERA: 'Optical sensor preview. Hand tracking will attach to this module in the next build.',
  FILES: 'File analysis and workspace routing placeholder for backend integration.',
  AI: 'AI reasoning state, task progress and command execution visualization.'
};

function showScreen(id) {
  for (const screen of screens) $(screen).classList.toggle('active', screen === id);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function runBoot() {
  const log = $('bootLog');
  const progress = $('bootProgress');
  const percent = $('bootPercent');
  const steps = [
    ['NEXUS kernel handshake', 10],
    ['Rendering subsystem', 22],
    ['Audio response matrix', 37],
    ['Optical sensor bridge', 52],
    ['Network telemetry', 66],
    ['Command parser', 79],
    ['AI state controller', 91],
    ['Interface online', 100]
  ];
  for (const [label, value] of steps) {
    const row = document.createElement('div');
    row.innerHTML = `<span class="ok">[ OK ]</span> ${label}`;
    log.appendChild(row);
    progress.style.width = `${value}%`;
    percent.textContent = `${value}%`;
    await sleep(220 + Math.random() * 240);
  }
  await sleep(420);
  const remembered = localStorage.getItem('jarvis.operator');
  if (remembered) {
    $('operatorName').value = remembered;
    await authenticate(remembered, true);
  } else {
    showScreen('identifyScreen');
    setTimeout(() => $('operatorName').focus(), 500);
  }
}

async function authenticate(rawName, quick = false) {
  const name = String(rawName || '').trim().slice(0, 32).toUpperCase() || 'OPERATOR';
  localStorage.setItem('jarvis.operator', name);
  $('welcomeName').textContent = name;
  showScreen('welcomeScreen');
  await sleep(quick ? 900 : 1500);
  showScreen('dashboard');
}

const orb = new NexusOrb($('orbCanvas'));
const audio = new AudioVisualizer($('waveCanvas'), $('audioLevel'));
const telemetry = new SystemTelemetry({
  fpsValue: $('fpsValue'), fpsBar: $('fpsBar'), heapValue: $('heapValue'), heapBar: $('heapBar'),
  networkValue: $('networkValue'), networkBar: $('networkBar'), uptimeValue: $('uptimeValue'),
  clock: $('clock'), dateLabel: $('dateLabel'), rttValue: $('rttValue'), downlinkValue: $('downlinkValue'),
  netTypeValue: $('netTypeValue'), linkQuality: $('linkQuality')
});
telemetry.start();

function setState(state, message) {
  $('aiState').textContent = state;
  $('systemMessage').textContent = message || state;
  orb.pulse(state === 'THINKING' ? 1 : state === 'LISTENING' ? .84 : .7);
}

function setModule(module) {
  const key = module in moduleInfo ? module : 'CORE';
  $('activeModuleLabel').textContent = key;
  $('moduleDescription').textContent = moduleInfo[key];
  $('coreMode').textContent = key;
  orb.setMode(key);
  document.querySelectorAll('#moduleRing button').forEach((button) => button.classList.toggle('active', button.dataset.module === key));
  if (key === 'VOICE' && !audio.running) $('systemMessage').textContent = 'VOICE MODULE SELECTED — MICROPHONE STANDBY';
  if (key === 'CAMERA') $('systemMessage').textContent = 'OPTICAL SENSOR MODULE SELECTED';
}

function setProgress(value, label = 'PROCESSING') {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  $('gaugeValue').textContent = pct;
  $('gaugeLabel').textContent = label;
  $('gaugeArc').style.strokeDashoffset = `${301.59 * (1 - pct / 100)}`;
}

async function traceCommand(command = 'SYSTEM DIAGNOSTIC') {
  const steps = [...document.querySelectorAll('#processRoute [data-step]')];
  steps.forEach((step) => step.classList.remove('active'));
  setState('LISTENING', `COMMAND RECEIVED // ${command.toUpperCase()}`);
  setProgress(8, 'RECEIVED');
  for (let i = 0; i < steps.length; i++) {
    await sleep(420);
    steps.forEach((step, idx) => step.classList.toggle('active', idx === i));
    const labels = ['CAPTURE', 'PARSING', 'THINKING', 'EXECUTING'];
    const states = ['LISTENING', 'PARSING', 'THINKING', 'EXECUTING'];
    setState(states[i], `${labels[i]} // ${command.toUpperCase()}`);
    setProgress(20 + i * 24, labels[i]);
  }
  await sleep(520);
  setProgress(100, 'COMPLETE');
  setState('READY', `COMMAND COMPLETE // ${command.toUpperCase()}`);
  orb.pulse(1);
  await sleep(700);
  steps.forEach((step) => step.classList.remove('active'));
}

function routeVoiceCommand(text) {
  const command = text.toLowerCase();
  if (command.includes('system')) setModule('SYSTEM');
  else if (command.includes('network')) setModule('NETWORK');
  else if (command.includes('camera')) setModule('CAMERA');
  else if (command.includes('voice')) setModule('VOICE');
  else if (command.includes('file')) setModule('FILES');
  else if (command.includes('ai') || command.includes('jarvis')) setModule('AI');
  else if (command.includes('reset')) orb.reset();
  traceCommand(text);
}

let recognition = null;
let voiceEnabled = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  $('speechSupport').textContent = 'SUPPORTED';
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';
  recognition.onresult = (event) => {
    let interim = '', finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal) finalText += `${transcript} `; else interim += `${transcript} `;
    }
    $('transcript').textContent = finalText || interim || 'Listening...';
    if (finalText.trim()) routeVoiceCommand(finalText.trim());
  };
  recognition.onerror = (event) => { $('transcript').textContent = `Speech error: ${event.error}`; };
  recognition.onend = () => { if (voiceEnabled) { try { recognition.start(); } catch {} } };
} else {
  $('speechSupport').textContent = 'UNAVAILABLE';
}

$('voiceButton').addEventListener('click', async () => {
  if (!voiceEnabled) {
    try {
      await audio.start();
      voiceEnabled = true;
      $('voiceButton').textContent = 'VOICE ACTIVE';
      $('voiceButton').classList.add('active');
      $('transcript').textContent = SpeechRecognition ? 'Listening for a command...' : 'Microphone waveform active. Speech recognition is not available in this browser.';
      setModule('VOICE');
      setState('LISTENING', 'MICROPHONE LINK ACTIVE');
      try { recognition?.start(); } catch {}
    } catch (error) {
      $('transcript').textContent = `Microphone access failed: ${error.message}`;
      setState('ATTENTION', 'MICROPHONE ACCESS DENIED');
    }
  } else {
    voiceEnabled = false;
    recognition?.stop();
    audio.stop();
    $('voiceButton').textContent = 'ENABLE VOICE';
    $('voiceButton').classList.remove('active');
    setState('READY', 'VOICE MODULE STANDBY');
  }
});

let cameraStream = null;
$('cameraButton').addEventListener('click', async () => {
  if (!cameraStream) {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
      $('cameraVideo').srcObject = cameraStream;
      $('cameraVideo').classList.add('active');
      $('cameraPlaceholder').style.display = 'none';
      $('cameraButton').textContent = 'DEACTIVATE CAMERA';
      $('cameraStatus').textContent = 'ONLINE';
      setModule('CAMERA');
      setState('SCANNING', 'OPTICAL SENSOR ONLINE');
    } catch (error) {
      $('cameraStatus').textContent = 'DENIED';
      setState('ATTENTION', `CAMERA ERROR // ${error.name}`);
    }
  } else {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    $('cameraVideo').srcObject = null;
    $('cameraVideo').classList.remove('active');
    $('cameraPlaceholder').style.display = '';
    $('cameraButton').textContent = 'ACTIVATE CAMERA';
    $('cameraStatus').textContent = 'OFFLINE';
    setState('READY', 'OPTICAL SENSOR STANDBY');
  }
});

document.querySelectorAll('#moduleRing button').forEach((button) => button.addEventListener('click', () => setModule(button.dataset.module)));
$('executeDemoButton').addEventListener('click', () => traceCommand('NEXUS SYSTEM DIAGNOSTIC'));
$('resetButton').addEventListener('click', () => { orb.reset(); setModule('CORE'); setProgress(0, 'READY'); });
$('fullscreenButton').addEventListener('click', async () => {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); else await document.exitFullscreen?.();
});
$('identityButton').addEventListener('click', () => { showScreen('identifyScreen'); $('operatorName').focus(); });
$('identifyButton').addEventListener('click', () => authenticate($('operatorName').value));
$('operatorName').addEventListener('keydown', (event) => { if (event.key === 'Enter') authenticate($('operatorName').value); });

setModule('CORE');
setProgress(0, 'READY');

const params = new URLSearchParams(location.search);
if (params.has('preview')) {
  showScreen('dashboard');
  setState('READY', 'ALL PRIMARY SYSTEMS NOMINAL');
} else {
  runBoot();
}
