import * as THREE from 'https://esm.sh/three@0.185.0';

export function createJarvisCore(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.15, 6.2);

  const root = new THREE.Group();
  scene.add(root);

  const hemi = new THREE.HemisphereLight(0x73e9ff, 0x051015, 1.8);
  const key = new THREE.PointLight(0x8cf7ff, 18, 20, 2);
  key.position.set(2.5, 3, 4);
  const rim = new THREE.PointLight(0xff9838, 8, 15, 2);
  rim.position.set(-3, -1, 1);
  scene.add(hemi, key, rim);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x5ddce9,
    emissive: 0x0a8190,
    emissiveIntensity: 2.4,
    metalness: 0.62,
    roughness: 0.16,
    transparent: true,
    opacity: 0.95,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.86, 5), coreMat);
  root.add(core);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.03, 2),
    new THREE.MeshBasicMaterial({ color: 0x8af8ff, wireframe: true, transparent: true, opacity: 0.18 })
  );
  root.add(wire);

  const haloMat = new THREE.MeshBasicMaterial({ color: 0x65f3ff, transparent: true, opacity: 0.16, side: THREE.BackSide });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.18, 48, 32), haloMat);
  root.add(halo);

  const ringGroup = new THREE.Group();
  root.add(ringGroup);
  const ringDefs = [
    [1.55, 0.018, 0x67f5ff, 0.6, 0.25],
    [1.9, 0.014, 0x37cfe4, 1.05, -0.35],
    [2.23, 0.012, 0xff9d38, 1.38, 0.48],
  ];
  const rings = ringDefs.map(([r, tube, color, rx, ry], i) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(r, tube, 8, 160),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: i === 2 ? 0.58 : 0.48 })
    );
    mesh.rotation.set(rx, ry, i * 0.3);
    ringGroup.add(mesh);
    return mesh;
  });

  const tickGroup = new THREE.Group();
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const len = i % 6 === 0 ? 0.22 : 0.1;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(a) * 2.52, Math.sin(a) * 2.52, 0),
      new THREE.Vector3(Math.cos(a) * (2.52 + len), Math.sin(a) * (2.52 + len), 0),
    ]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: i % 6 === 0 ? 0xffa341 : 0x56dbe8, transparent: true, opacity: 0.48 }));
    tickGroup.add(line);
  }
  tickGroup.rotation.x = 0.28;
  root.add(tickGroup);

  const particleCount = 900;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    const radius = 2.4 + Math.random() * 2.8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi) * 0.55;
  }
  const particlesGeo = new THREE.BufferGeometry();
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particlesGeo,
    new THREE.PointsMaterial({ color: 0x68e9f4, size: 0.016, transparent: true, opacity: 0.42, depthWrite: false })
  );
  scene.add(particles);

  let targetRotX = 0.1;
  let targetRotY = 0;
  let targetDistance = 6.2;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let disposed = false;
  let mode = 'idle';

  const statePalette = {
    idle: [0x5ddce9, 0x0a8190, 2.4],
    listening: [0xffad4f, 0xa34f0a, 3.2],
    thinking: [0xffdf6e, 0x91750a, 3.6],
    executing: [0xff7f32, 0xb23a08, 3.8],
    speaking: [0x8fffb1, 0x1b8d4a, 3.0],
  };

  function setState(next = 'idle') {
    mode = next;
    const [color, emissive, intensity] = statePalette[next] || statePalette.idle;
    coreMat.color.setHex(color);
    coreMat.emissive.setHex(emissive);
    coreMat.emissiveIntensity = intensity;
  }

  function rotateBy(dx, dy) {
    targetRotY += dx;
    targetRotX = THREE.MathUtils.clamp(targetRotX + dy, -1.15, 1.15);
  }

  function zoomBy(factor) {
    targetDistance = THREE.MathUtils.clamp(targetDistance * factor, 3.2, 10.5);
  }

  function resetView() {
    targetRotX = 0.1;
    targetRotY = 0;
    targetDistance = 6.2;
  }

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    rotateBy(dx * 0.008, dy * 0.008);
  });
  const stopDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? 1.08 : 0.92);
  }, { passive: false });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const clock = new THREE.Clock();
  function animate() {
    if (disposed) return;
    const t = clock.getElapsedTime();
    root.rotation.x += (targetRotX - root.rotation.x) * 0.06;
    root.rotation.y += (targetRotY - root.rotation.y) * 0.06;
    camera.position.z += (targetDistance - camera.position.z) * 0.07;
    root.rotation.y += mode === 'thinking' ? 0.006 : 0.0016;
    rings[0].rotation.z += 0.004;
    rings[1].rotation.z -= 0.003;
    rings[2].rotation.z += 0.002;
    tickGroup.rotation.z -= 0.0009;
    particles.rotation.y += 0.00045;
    core.scale.setScalar(1 + Math.sin(t * (mode === 'listening' ? 5 : 2.2)) * 0.025);
    halo.scale.setScalar(1 + Math.sin(t * 1.7) * 0.035);
    haloMat.opacity = 0.13 + (Math.sin(t * 2.4) + 1) * 0.035;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  function dispose() {
    disposed = true;
    observer.disconnect();
    renderer.dispose();
    scene.traverse((obj) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
      else obj.material?.dispose?.();
    });
  }

  return { rotateBy, zoomBy, resetView, setState, dispose };
}
