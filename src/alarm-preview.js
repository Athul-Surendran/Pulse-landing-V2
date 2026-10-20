import * as THREE from 'three';

export function createAlarmPreview(container, { onActivate, wheelRotate = false, fitToView = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(1.35, 1.05, 3.4);
  camera.lookAt(0, 0.22, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x728798, 3));
  for (const [color, intensity, position] of [[0xffffff, 4, [2, 4, 5]], [0xccecff, 3, [-3, 1, -2]]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  const model = new THREE.Group();
  scene.add(model);
  const steel = new THREE.MeshStandardMaterial({ color: 0xa9bac4, metalness: 0.65, roughness: 0.25 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x486574, metalness: 0.55, roughness: 0.3 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc0aa82, metalness: 0.6, roughness: 0.32 });
  const xray = new THREE.MeshStandardMaterial({ color: 0x91bed0, transparent: true, opacity: 0.2, roughness: 0.2, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const fault = new THREE.MeshStandardMaterial({ color: 0xe80004, roughness: 0.75, emissive: 0xe80004, emissiveIntensity: 0.12 });
  const water = new THREE.MeshBasicMaterial({ color: 0x75b7d5, transparent: true, opacity: 0.8 });
  const geometries = new Set();
  const materials = new Set([steel, darkMetal, brass, xray, fault, water]);
  function mesh(geometry, material, position) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    model.add(object);
    return object;
  }
  function axialCylinder(radius, length, x, material, radial = 48, open = false) {
    const object = mesh(new THREE.CylinderGeometry(radius, radius, length, radial, 1, open), material, [x, 0, 0]);
    object.rotation.z = Math.PI / 2;
    return object;
  }
  axialCylinder(0.32, 1.1, 0, xray, 48, true);
  const body = mesh(new THREE.SphereGeometry(0.4, 40, 24), xray, [0, 0, 0]);
  body.scale.set(1.25, 1, 1);
  for (const x of [-0.38, 0.38]) {
    const seat = mesh(new THREE.TorusGeometry(0.28, 0.025, 10, 40), brass, [x, 0, 0]);
    seat.rotation.y = Math.PI / 2;
  }
  const boltGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.12, 6);
  for (const sign of [-1, 1]) {
    axialCylinder(0.25, 0.78, sign * 1.06, xray, 48, true);
    for (const x of [0.57, 0.68]) {
      const flange = mesh(new THREE.TorusGeometry(0.31, 0.065, 12, 48), steel, [sign * x, 0, 0]);
      flange.rotation.y = Math.PI / 2;
    }
    const gasket = mesh(new THREE.TorusGeometry(0.285, 0.02, 8, 48), darkMetal, [sign * 0.625, 0, 0]);
    gasket.rotation.y = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const bolt = mesh(boltGeometry, brass, [sign * 0.7, Math.cos(angle) * 0.32, Math.sin(angle) * 0.32]);
      bolt.rotation.z = Math.PI / 2;
    }
    const end = mesh(new THREE.TorusGeometry(0.25, 0.018, 8, 48), steel, [sign * 1.45, 0, 0]);
    end.rotation.y = Math.PI / 2;
  }
  mesh(new THREE.CylinderGeometry(0.12, 0.19, 0.22, 24), brass, [0, 0.4, 0]);
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.39, 16), steel, [0, 0.66, 0]);
  mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 6), brass, [0, 0.85, 0]);
  const handwheel = mesh(new THREE.TorusGeometry(0.3, 0.035, 12, 48), darkMetal, [0, 0.88, 0]);
  handwheel.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI / 3;
    const spoke = mesh(new THREE.BoxGeometry(0.57, 0.025, 0.025), darkMetal, [0, 0.88, 0]);
    spoke.rotation.y = angle;
  }
  const debrisGeometry = new THREE.IcosahedronGeometry(0.085, 1);
  for (let i = 0; i < 11; i++) {
    const piece = mesh(debrisGeometry, fault, [(i % 3 - 1) * 0.075, Math.sin(i * 2.4) * 0.12, Math.cos(i * 2.4) * 0.12]);
    piece.scale.set(0.65, 1, 1);
  }
  const markers = [];
  const markerGeometry = new THREE.SphereGeometry(0.025, 8, 6);
  for (let i = 0; i < 8; i++) markers.push(mesh(markerGeometry, water, [-1.35 + i * 0.14, 0, 0]));

  let width = 0, height = 0, inView = false, clock = 0, yaw = -0.3, pitch = 0.08;
  let drag = null, localPaused = false, dragged = false;
  const resizeObserver = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    if (fitToView) {
      const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
      camera.position.set(1.35, 0.83, 3.4).normalize().multiplyScalar(1.7 / Math.sin(halfFov) * 1.05).add(new THREE.Vector3(0, 0.22, 0));
      camera.lookAt(0, 0.22, 0);
    }
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; });
  intersectionObserver.observe(container);
  function pointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    dragged = false;
    drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, id: event.pointerId };
    container.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) dragged = true;
    yaw += (event.clientX - drag.x) * 0.012;
    pitch = THREE.MathUtils.clamp(pitch + (event.clientY - drag.y) * 0.008, -0.5, 0.5);
    drag.x = event.clientX;
    drag.y = event.clientY;
  }
  function pointerUp(event) {
    if (event.type === 'pointercancel') dragged = true;
    drag = null;
  }
  function activate() {
    if (!dragged) onActivate?.();
    dragged = false;
  }
  function keyDown(event) {
    if (onActivate && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      onActivate();
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') yaw -= 0.15;
    if (event.key === 'ArrowRight') yaw += 0.15;
    if (event.key === 'ArrowUp') pitch = Math.max(-0.5, pitch - 0.1);
    if (event.key === 'ArrowDown') pitch = Math.min(0.5, pitch + 0.1);
  }
  function wheel(event) {
    if (event.ctrlKey) return;
    event.preventDefault();
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    yaw += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * units * 0.006;
  }
  container.addEventListener('pointerdown', pointerDown);
  container.addEventListener('pointermove', pointerMove);
  container.addEventListener('lostpointercapture', pointerUp);
  container.addEventListener('pointercancel', pointerUp);
  container.addEventListener('keydown', keyDown);
  if (onActivate) container.addEventListener('click', activate);
  if (wheelRotate) container.addEventListener('wheel', wheel, { passive: false });
  return {
    render(delta, visible, paused) {
      if (!visible || !inView || !width || !height) return;
      if (!paused && !localPaused && !drag) clock += THREE.MathUtils.clamp(delta, 0, 0.05);
      model.rotation.set(pitch, yaw + clock * 0.28, -0.12);
      markers.forEach((marker, i) => {
        marker.position.x = Math.min(-0.18, -1.35 + ((i / markers.length + clock * 0.3) % 1) * 1.25);
      });
      renderer.render(scene, camera);
    },
    setPaused(value) { localPaused = value; },
    resetView() { yaw = -0.3; pitch = 0.08; clock = 0; },
    getDiagnostics() { return { angle: model.rotation.y, drawCalls: renderer.info.render.calls, localPaused }; },
    dispose() {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      container.removeEventListener('pointerdown', pointerDown);
      container.removeEventListener('pointermove', pointerMove);
      container.removeEventListener('lostpointercapture', pointerUp);
      container.removeEventListener('pointercancel', pointerUp);
      container.removeEventListener('keydown', keyDown);
      container.removeEventListener('click', activate);
      container.removeEventListener('wheel', wheel);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
