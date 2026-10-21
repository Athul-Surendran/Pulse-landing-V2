import * as THREE from 'three';

// A small, render-on-demand study of the story tower, without the district or story rig.
export function createBuilding(host, { variant, select, floor }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 250);
  camera.position.set(variant === 'action' ? 66 : 72, variant === 'action' ? 63 : 48, 86);
  camera.lookAt(0, 25, 0);
  scene.add(new THREE.HemisphereLight(0xf3fbff, 0x6c8795, 2.8));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-25, 70, 45);
  scene.add(light);
  const root = new THREE.Group();
  root.rotation.y = -0.3;
  scene.add(root);
  const resources = new Set();
  const track = resource => { resources.add(resource); return resource; };
  const slab = track(new THREE.MeshStandardMaterial({ color: 0xe5edf2, roughness: 0.6 }));
  const metal = track(new THREE.MeshStandardMaterial({ color: 0xc3d2dc, metalness: 0.5, roughness: 0.4 }));
  const highlight = track(new THREE.MeshStandardMaterial({ color: 0x238dad, metalness: 0.3, roughness: 0.3, emissive: 0x113745 }));
  const floorMeshes = [];
  const selections = [];
  const box = track(new THREE.BoxGeometry(1, 1, 1));
  function mesh(geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    item.scale.set(sx, sy, sz);
    root.add(item);
    return item;
  }
  function outline(level) {
    return Array.from({ length: 49 }, (_, i) => {
      const a = i / 48 * Math.PI * 2;
      const wave = 1 + 0.09 * Math.sin(3 * a + level * 0.12) + 0.045 * Math.cos(2 * a - level * 0.1);
      const taper = 1 - level * 0.007;
      return new THREE.Vector2(Math.cos(a) * 5.5 * wave * taper + Math.sin(level * 0.2) * 0.28, Math.sin(a) * 4.15 * wave * taper);
    });
  }
  for (let level = 0; level <= 14; level++) {
    const points = outline(level);
    const shape = new THREE.Shape(points);
    const geometry = track(new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }));
    geometry.rotateX(-Math.PI / 2);
    mesh(geometry, slab, 0, level * 3.6, 0);
    if (level === 14) break;
    const glass = track(new THREE.MeshStandardMaterial({ color: level === 9 ? 0x5d9aad : 0x8bafc4, metalness: 0.42, roughness: 0.26 }));
    const shellGeometry = track(new THREE.ExtrudeGeometry(shape, { depth: 3.38, bevelEnabled: false }));
    shellGeometry.rotateX(-Math.PI / 2);
    const shell = mesh(shellGeometry, glass, 0, level * 3.6 + 0.22, 0);
    shell.userData.floor = level + 1;
    floorMeshes.push({ shell, glass });
    selections.push(shell);
    // The action view opens the front of Level 10 to expose its plant relationship.
    if (variant === 'action' && level === 9) {
      shell.visible = false;
      mesh(box, highlight, -1.6, level * 3.6 + 1, 0, 3, 1.5, 2);
      mesh(box, metal, 1.6, level * 3.6 + 1.8, 0, 2.8, 0.4, 1);
    }
    for (let i = 0; i < 48; i += 2) {
      const p = points[i];
      mesh(box, metal, p.x, level * 3.6 + 1.9, -p.y, 0.065, 3.4, 0.065);
    }
  }
  mesh(box, slab, 0, -0.5, 0, 20, 0.6, 15);
  mesh(box, metal, -7, 3.5, -1, 4, 7, 8);
  mesh(box, slab, -7, 7.1, -1, 4.2, 0.3, 8.2);
  mesh(box, metal, 0, 51.5, 0, 3.4, 2.5, 2);
  const ray = new THREE.Raycaster();
  let disposed = false;
  let active = true;
  const draw = () => {
    if (disposed || !active || document.hidden || !host.clientWidth || !host.clientHeight) return;
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  function setFloor(value) {
    floorMeshes.forEach(({ shell, glass }, i) => { shell.material = value === i + 1 ? highlight : glass; });
    draw();
  }
  function click(event) {
    if (variant !== 'performance') return;
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hit = ray.intersectObjects(selections)[0];
    if (hit) select(hit.object.userData.floor);
  }
  function contextLost(event) {
    event.preventDefault();
    host.dispatchEvent(new Event('pp-model-failed'));
  }
  renderer.domElement.addEventListener('click', click);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const observer = new ResizeObserver(draw);
  observer.observe(host);
  setFloor(floor);
  return {
    setFloor,
    setActive(value) { active = value; draw(); },
    dispose() {
      disposed = true;
      observer.disconnect();
      renderer.domElement.removeEventListener('click', click);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      resources.forEach(resource => resource.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
