# JARVIS Nexus

Interactive futuristic JARVIS HUD prototype inspired by cinematic control interfaces, implemented with browser-native APIs and no runtime dependencies.

## Current capabilities

- Boot → identity → welcome → main HUD flow
- Interactive central Nexus orb (drag, scroll zoom, reset)
- Circular module selector: Voice, System, Network, Camera, Files, AI
- Live browser telemetry: FPS, JS heap when supported, network state, RTT/downlink when exposed, uptime
- Live microphone waveform via Web Audio API
- Optional Web Speech API command recognition
- Camera preview via `getUserMedia`
- Command routing animation and 0–100 progress gauge
- Fullscreen mode and responsive layout
- Operator name persisted in browser `localStorage`

## Run

No install step is required for this prototype.

```bash
npm run dev
```

Open `http://localhost:3000`.

> Microphone/camera require browser permission and work on `localhost` or HTTPS.

## Voice command examples

When Web Speech API is supported, say words such as:

- `system`
- `network`
- `camera`
- `voice`
- `files`
- `AI`
- `reset`

The current build routes commands visually; OS-level command execution will be added through a trusted local backend rather than directly from the browser.

## Planned architecture

1. Replace the prototype orb renderer with a Three.js/WebGL scene.
2. Add MediaPipe hand tracking for rotate/zoom/selection gestures.
3. Add a local bridge (Node/Electron/Tauri or Python service) for actual CPU/RAM/disk/process telemetry.
4. Add a permissioned command registry for browser/app/file actions.
5. Connect the AI state machine to an LLM backend.
6. Add face/identity verification only as an explicit opt-in module.

## Security model

The browser UI never receives shell access. Native actions will go through an allowlisted local command bridge with explicit permissions and audit logging.
