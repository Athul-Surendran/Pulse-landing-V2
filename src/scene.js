import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const COLORS = { paper: 0xf3f5f8, concrete: 0xd7e1eb, trim: 0xe9eff5, glass: 0x809db5, supply: 0x5098ad, return: 0xb4937d, fault: 0xe80004, healthy: 0x19a877 };
// Scene units are metres. Keep the occupied room below the service plenum.
export const LAYOUT = Object.freeze({
  floorHeight: 3.6, officeY: 36.57, ceilingY: 39.35, serviceY: 39.68,
  upperSlabY: 39.95, fcuWidth: 1.5, fcuDepth: 0.9, fcuHeight: 0.32,
  branchRadius: 0.027, coilRadius: 0.008, deskHeight: 0.75,
});
const vec = (p) => new THREE.Vector3(...p);
const smooth = (a, b, value) => THREE.MathUtils.smoothstep(value, a, b);
const vehicleSpeedRanges = { car: [6.2, 7.5], bus: [3.5, 6], truck: [2.6, 3.4] };
function trafficSpeed(kind, random = Math.random) {
  const [min, max] = vehicleSpeedRanges[kind];
  return min + random() * (max - min);
}

export function advanceTraffic(vehicles, delta, random = Math.random) {
  if (delta <= 0) return;
  for (const vehicle of [...vehicles].sort((a, b) => b.x * b.direction - a.x * a.direction)) {
    if (vehicle.wait > 0) {
      vehicle.wait = Math.max(0, vehicle.wait - delta);
      if (vehicle.wait > 0) continue;
      const entryBlocked = vehicles.some(other =>
        other !== vehicle && other.wait === 0 && other.z === vehicle.z && other.direction === vehicle.direction &&
        other.x * vehicle.direction + 158 < (vehicle.length + other.length) / 2 + 4 + vehicleSpeedRanges[vehicle.kind][1] * 0.6);
      if (entryBlocked) {
        vehicle.wait = 0.5;
        continue;
      }
      vehicle.x = -158 * vehicle.direction;
      vehicle.speed = trafficSpeed(vehicle.kind, random);
    }
    const position = vehicle.x * vehicle.direction;
    let next = position + vehicle.speed * delta;
    for (const other of vehicles) {
      if (other === vehicle || other.wait > 0 || other.z !== vehicle.z || other.direction !== vehicle.direction) continue;
      const ahead = other.x * vehicle.direction;
      if (ahead > position) next = Math.min(next, ahead - (vehicle.length + other.length) / 2 - 4 - vehicle.speed * 0.6);
    }
    vehicle.x = Math.max(position, next) * vehicle.direction;
    if (vehicle.x * vehicle.direction > 158) {
      vehicle.wait = 5 + random() * 16;
      vehicle.trips++;
    }
  }
}

export function createScene(container, reducedMotion) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.paper);
  scene.fog = new THREE.Fog(COLORS.paper, 150, 270);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.04, 300);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.23;
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environmentRoom = new RoomEnvironment();
  const environment = environmentGenerator.fromScene(environmentRoom, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.35;
  environmentRoom.dispose();
  const reflectionCanvas = document.createElement('canvas');
  reflectionCanvas.width = 1024;
  reflectionCanvas.height = 512;
  const reflectionContext = reflectionCanvas.getContext('2d');
  const skyGradient = reflectionContext.createLinearGradient(0, 0, 0, 512);
  skyGradient.addColorStop(0, '#91b5d0');
  skyGradient.addColorStop(0.48, '#eff5fa');
  skyGradient.addColorStop(0.52, '#c2cbd4');
  skyGradient.addColorStop(1, '#8f9da9');
  reflectionContext.fillStyle = skyGradient;
  reflectionContext.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 24; i++) {
    const x = i * 46 - 20, height = 28 + (i * 37 % 94);
    reflectionContext.fillStyle = i % 3 === 0 ? '#a3b4c3' : '#c6d3dd';
    reflectionContext.fillRect(x, 265 - height, 26 + i % 4 * 5, height);
    reflectionContext.fillStyle = '#e6eef4';
    for (let row = 0; row < height - 8; row += 12) reflectionContext.fillRect(x + 3, 265 - height + row + 5, 20, 3);
  }
  for (let i = 0; i < 7; i++) {
    const cloud = reflectionContext.createRadialGradient(i * 170, 80 + i % 3 * 30, 5, i * 170, 80 + i % 3 * 30, 120);
    cloud.addColorStop(0, '#ffffffb3');
    cloud.addColorStop(1, '#ffffff00');
    reflectionContext.fillStyle = cloud;
    reflectionContext.fillRect(i * 170 - 120, 0, 240, 240);
  }
  const reflectionSource = new THREE.CanvasTexture(reflectionCanvas);
  reflectionSource.colorSpace = THREE.SRGBColorSpace;
  reflectionSource.mapping = THREE.EquirectangularReflectionMapping;
  const facadeEnvironment = environmentGenerator.fromEquirectangular(reflectionSource);
  reflectionSource.dispose();
  environmentGenerator.dispose();
  container.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c5d5, 2.7));
  const sun = new THREE.DirectionalLight(0xfbfcff, 3.5);
  sun.position.set(-22, 70, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 47, bottom: -32, near: 1, far: 150 });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0001;
  sun.shadow.radius = 4;
  sun.target.position.set(0, 24, 0);
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xe5f1f4, 1.3);
  fill.position.set(20, 20, -15);
  scene.add(fill);

  const materials = {
    stone: new THREE.MeshStandardMaterial({ color: COLORS.concrete, roughness: 0.82 }),
    trim: new THREE.MeshStandardMaterial({ color: COLORS.trim, roughness: 0.66 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x566761, roughness: 0.73 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xa8b1aa, roughness: 0.43, metalness: 0.35 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xbba889, roughness: 0.87 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x6b7a6c, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x7d9070, roughness: 1 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x797463, roughness: 1 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x354e4d, roughness: 0.35 }),
  };
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 256;
  grainCanvas.height = 256;
  const grainContext = grainCanvas.getContext('2d');
  grainContext.fillStyle = '#72503a';
  grainContext.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 180; i++) {
    grainContext.strokeStyle = `rgba(38,22,12,${0.04 + (Math.sin(i * 7.3) + 1) * 0.06})`;
    grainContext.beginPath();
    const y = i * 256 / 180;
    grainContext.moveTo(0, y);
    grainContext.bezierCurveTo(75, y + Math.sin(i) * 5, 175, y - Math.cos(i) * 4, 256, y + Math.sin(i * 0.3) * 2);
    grainContext.stroke();
  }
  const walnutTexture = new THREE.CanvasTexture(grainCanvas);
  walnutTexture.colorSpace = THREE.SRGBColorSpace;
  walnutTexture.wrapS = walnutTexture.wrapT = THREE.RepeatWrapping;
  walnutTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const walnut = new THREE.MeshStandardMaterial({ map: walnutTexture, roughness: 0.48 });
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = stoneCanvas.height = 512;
  const stoneContext = stoneCanvas.getContext('2d');
  stoneContext.fillStyle = '#d5d8db';
  stoneContext.fillRect(0, 0, 512, 512);
  let textureSeed = 173;
  const textureRandom = () => {
    textureSeed = (Math.imul(textureSeed, 1664525) + 1013904223) >>> 0;
    return textureSeed / 4294967296;
  };
  for (let i = 0; i < 18000; i++) {
    stoneContext.fillStyle = `rgba(${textureRandom() > 0.5 ? '255,255,255' : '101,113,124'},0.045)`;
    stoneContext.fillRect(textureRandom() * 512, textureRandom() * 512, 1 + textureRandom() * 2, 1);
  }
  for (let i = 0; i < 11; i++) {
    const x = textureRandom() * 512;
    stoneContext.strokeStyle = 'rgba(111,124,135,0.10)';
    stoneContext.lineWidth = 0.5 + textureRandom();
    stoneContext.beginPath();
    stoneContext.moveTo(x, 0);
    stoneContext.bezierCurveTo(x - 110, 170, x + 90, 330, x - 45, 512);
    stoneContext.stroke();
  }
  const stoneTexture = new THREE.CanvasTexture(stoneCanvas);
  stoneTexture.colorSpace = THREE.SRGBColorSpace;
  stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping;
  stoneTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const silverStone = new THREE.MeshStandardMaterial({ map: stoneTexture, bumpMap: stoneTexture, bumpScale: 0.003, roughness: 0.47, metalness: 0.03 });
  const brushedMetal = new THREE.MeshStandardMaterial({ color: 0xaab3bb, metalness: 0.72, roughness: 0.36 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x474342, roughness: 0.65 });
  const upholstery = new THREE.MeshStandardMaterial({ color: 0xded6c7, roughness: 0.94 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9e8660, metalness: 0.7, roughness: 0.32 });
  const travertine = new THREE.MeshStandardMaterial({ color: 0xdad5c9, roughness: 0.55 });
  const warmLight = new THREE.MeshStandardMaterial({ color: 0xfff3d9, emissive: 0xffdfac, emissiveIntensity: 1.8 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function box(parent, size, position, material = materials.stone, shadow = true) {
    const mesh = new THREE.Mesh(boxGeo, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, radius, height, position, material, radial = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radial), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function roundedBox(parent, size, position, material, radius = 0.035) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, radius), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function line(parent, points, color, opacity = 1) {
    const object = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(vec)), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    parent.add(object);
    return object;
  }
  function batchMovingMeshes(group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map(), meshes = [];
    group.traverse(object => {
      if (!object.isMesh) return;
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      if (!batches.has(object.material)) batches.set(object.material, []);
      batches.get(object.material).push(geometry);
      meshes.push(object);
    });
    meshes.forEach(mesh => {
      mesh.removeFromParent();
      if (mesh.geometry !== boxGeo) mesh.geometry.dispose();
    });
    batches.forEach((geometries, material) => {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      geometries.forEach(geometry => geometry.dispose());
    });
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: COLORS.paper, toneMapped: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.28;
  scene.add(ground);
  const groundShadow = new THREE.Mesh(ground.geometry, new THREE.ShadowMaterial({ color: 0x64758a, opacity: 0.16 }));
  groundShadow.rotation.copy(ground.rotation);
  groundShadow.position.y = -0.275;
  groundShadow.receiveShadow = true;
  scene.add(groundShadow);

  const district = new THREE.Group();
  district.name = 'Surrounding district';
  scene.add(district);
  const cityWhite = new THREE.MeshStandardMaterial({ color: 0xfafcfe, roughness: 0.88 });
  const cityRoof = new THREE.MeshStandardMaterial({ color: 0xe5ebf0, roughness: 0.9 });
  const pavement = new THREE.MeshStandardMaterial({ color: 0xe5e9ef, roughness: 1 });
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x7e8b98, roughness: 0.96, bumpMap: stoneTexture, bumpScale: 0.018 });
  const cityWindow = new THREE.MeshStandardMaterial({ color: 0xdce4eb, roughness: 0.5, metalness: 0.1 });
  const citySpandrel = new THREE.MeshStandardMaterial({ color: 0xd2dae1, roughness: 0.62 });
  const laneMaterial = new THREE.MeshBasicMaterial({ color: 0xf6f8fa });
  const riverMaterial = new THREE.MeshStandardMaterial({ color: 0x8eb8ce, roughness: 0.28, metalness: 0.08, transparent: true, opacity: 0.88 });
  const cityBuildings = [
    [-27, -2, 10, 13, 12], [-26, -26, 12, 18, 13], [-8, -27, 11, 14, 12],
    [9, -27, 13, 20, 12], [31, -25, 12, 28, 13], [31, -3, 12, 12, 11],
    [-62, -5, 11, 10, 12], [-62, -29, 12, 19, 14], [49, -6, 12, 22, 13],
    [49, -29, 13, 14, 14], [-24, -65, 13, 10, 10], [-3, -65, 12, 15, 9], [41, -65, 14, 12, 11],
  ];
  for (const [row, z] of [-92, -119, -146].entries()) {
    for (const [column, x] of [-108, -84, -62, -26, 0, 36, 62, 88, 112].entries()) {
      cityBuildings.push([x, z, x === -26 ? 10 : 12 + (column % 3) * 2, 12 + ((row * 5 + column * 3) % 8) * 3, 12 + (row + column) % 3]);
    }
  }
  for (const [column, x] of [-108, -84, 78, 102].entries()) {
    for (const [row, z] of [-65, -38, -1, 29].entries()) {
      cityBuildings.push([x, z, 12 + column % 3, 9 + ((column * 3 + row) % 6) * 3, 12 + row % 3]);
    }
  }
  for (const [x, height] of [[-4, 8], [20, 11], [46, 9]]) cityBuildings.push([x, 43, 13, height, 12]);
  for (const [x, z, w, h, d] of cityBuildings) {
    box(district, [w + 3, 0.22, d + 3], [x, -0.14, z], pavement, false);
    box(district, [w, h, d], [x, h / 2, z], cityWhite);
    box(district, [w - 0.35, 0.06, d - 0.35], [x, h + 0.03, z], cityRoof, false);
    if (h > 18) box(district, [w * 0.55, 1.6, d * 0.5], [x, h + 0.8, z], cityWhite);
    for (let y = 2.2; y < h - 0.8; y += 3.2) {
      for (const side of [-1, 1]) {
        box(district, [w - 0.9, 1.9, 0.035], [x, y, z + side * (d / 2 + 0.02)], cityWindow, false);
        box(district, [0.035, 1.9, d - 0.9], [x + side * (w / 2 + 0.02), y, z], cityWindow, false);
        box(district, [w, 0.12, 0.12], [x, y - 1.05, z + side * d / 2], citySpandrel, false);
      }
    }
    for (let dx = -w / 2 + 1.4; dx < w / 2; dx += 1.8) {
      for (const side of [-1, 1]) box(district, [0.075, h - 0.8, 0.07], [x + dx, h / 2, z + side * (d / 2 + 0.04)], cityWhite, false);
    }
    box(district, [2.6, 2.4, 0.06], [x, 1.2, z + d / 2 + 0.05], cityWindow, false);
    box(district, [3.2, 0.13, 1.2], [x, 2.5, z + d / 2 + 0.5], citySpandrel);
    for (const side of [-1, 1]) box(district, [w, 0.35, 0.16], [x, h + 0.18, z + side * d / 2], cityWhite);
  }
  function street(x, z, length, width, alongX) {
    box(district, alongX ? [length, 0.06, width + 1.2] : [width + 1.2, 0.06, length], [x, -0.18, z], pavement, false);
    box(district, alongX ? [length, 0.025, width] : [width, 0.025, length], [x, -0.135, z], roadMaterial, false);
    for (let offset = -length / 2 + 1; offset < length / 2; offset += 3.8) {
      const px = x + (alongX ? offset : 0), pz = z + (alongX ? 0 : offset);
      if (alongX && (Math.abs(px - 20) < 3.4 || Math.abs(px + 16) < 3.4)) continue;
      if (!alongX && (Math.abs(pz - 14) < 4 || Math.abs(pz + 15) < 3.4)) continue;
      box(district, alongX ? [1.7, 0.006, 0.1] : [0.1, 0.006, 1.7], [px, -0.117, pz], laneMaterial, false);
    }
  }
  street(0, 14, 320, 6.4, true);
  street(0, -15, 320, 5.5, true);
  for (const z of [-78, -105, -132]) street(0, z, 320, 5.5, true);
  street(-16, -65.5, 169, 5.2, false);
  street(20, -55, 190, 5.2, false);
  for (const x of [-19.8, 16.2]) {
    for (let i = 0; i < 7; i++) box(district, [0.36, 0.008, 5.3], [x + i * 0.55, -0.108, 14], laneMaterial, false);
  }
  const treeGeometry = new THREE.IcosahedronGeometry(1, 1);
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x849888, roughness: 0.94 });
  const streetTrees = new THREE.InstancedMesh(treeGeometry, treeMaterial, 28);
  const treeTransform = new THREE.Object3D();
  for (let i = 0; i < 28; i++) {
    let x = -110 + (i % 14) * 16;
    if (Math.abs(x + 44) < 10) x += 12;
    const z = i < 14 ? 19.2 : -20.1;
    box(district, [1.8, 0.25, 1.8], [x, 0, z], citySpandrel);
    box(district, [0.16, 2.6, 0.16], [x, 1.3, z], roadMaterial);
    treeTransform.position.set(x, 3.1, z);
    treeTransform.scale.set(1.1, 1.5 + (i % 3) * 0.15, 1.1);
    treeTransform.rotation.y = i * 2.4;
    treeTransform.updateMatrix();
    streetTrees.setMatrixAt(i, treeTransform.matrix);
    box(district, [0.09, 4.4, 0.09], [x + 4, 2.2, z], citySpandrel);
    box(district, [0.8, 0.09, 0.23], [x + 4, 4.4, z - 0.3], cityWhite);
  }
  streetTrees.castShadow = true;
  district.add(streetTrees);
  const riverfront = new THREE.Group();
  riverfront.rotation.y = Math.PI / 2;
  district.add(riverfront);
  const riverCenter = x => -44 + Math.sin(x / 28) * 2.5 + Math.sin(x / 13) * 0.8;
  function riverStrip(inner, outer, y, material) {
    const vertices = [];
    for (let i = 0; i < 100; i++) {
      const x0 = -160 + i * 3.2, x1 = x0 + 3.2;
      const z0 = riverCenter(x0), z1 = riverCenter(x1);
      vertices.push(x0, y, z0 + inner, x0, y, z0 + outer, x1, y, z1 + inner);
      vertices.push(x1, y, z1 + inner, x0, y, z0 + outer, x1, y, z1 + outer);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const strip = new THREE.Mesh(geometry, material);
    strip.receiveShadow = true;
    riverfront.add(strip);
    return strip;
  }
  const river = riverStrip(-6.75, 6.75, -0.20, riverMaterial);
  river.name = 'River';
  riverStrip(-8.5, -6.75, -0.08, pavement);
  riverStrip(6.75, 8.5, -0.08, pavement);
  riverStrip(-6.9, -6.75, 0, cityWhite);
  riverStrip(6.75, 6.9, 0, cityWhite);
  for (let i = 0; i < 80; i++) {
    const x = -150 + i * 3.8, z = riverCenter(x) + Math.sin(i * 1.7) * 5;
    line(riverfront, [[x, -0.18, z], [x + 1.2 + i % 3, -0.18, z + 0.1]], 0xd7e9f0, 0.5);
  }
  const bridgeDecks = [];
  function riverBridge(crossing, width) {
    const center = riverCenter(crossing);
    const deck = box(riverfront, [width + 1.2, 0.3, 22], [crossing, 2.56, center], cityWhite);
    bridgeDecks.push(deck);
    box(riverfront, [width, 0.025, 22], [crossing, 2.725, center], roadMaterial, false);
    for (const x of [crossing - width / 2 - 0.45, crossing + width / 2 + 0.45]) {
      box(riverfront, [0.1, 0.08, 22], [x, 3.28, center], cityWhite);
      for (let z = center - 10.5; z <= center + 10.5; z += 1.5) box(riverfront, [0.055, 0.58, 0.055], [x, 2.99, z], cityWhite, false);
    }
    for (let z = center - 10; z < center + 10; z += 3.8) box(riverfront, [0.1, 0.006, 1.7], [crossing, 2.744, z], laneMaterial, false);
    for (const side of [-1, 1]) {
      box(riverfront, [width - 0.6, 2.6, 0.7], [crossing, 1.1, center + side * 7.6], citySpandrel);
      const ramp = box(riverfront, [width, 0.08, Math.hypot(18, 2.86)], [crossing, 1.295, center + side * 20], roadMaterial);
      ramp.rotation.x = side * Math.atan2(2.86, 18);
    }
  }
  riverBridge(15, 5.5);
  riverBridge(-14, 6.4);
  for (const crossing of [78, 105, 132]) riverBridge(crossing, 5.5);
  const vehicles = [];
  const vehicleGlass = new THREE.MeshStandardMaterial({ color: 0x748b9b, roughness: 0.3, metalness: 0.25 });
  const vehiclePaint = new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.3, metalness: 0.3 });
  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x55636e, roughness: 0.9 });
  const trafficRoutes = [
    { kind: 'car', z: 12.4, center: 14, offset: 31, direction: 1 },
    { kind: 'bus', z: 12.4, center: 14, offset: 93, direction: 1 },
    { kind: 'truck', z: 15.6, center: 14, offset: 75, direction: -1 },
    { kind: 'car', z: 15.6, center: 14, offset: 130, direction: -1 },
    { kind: 'bus', z: -16.4, center: -15, offset: 25, direction: 1 },
    { kind: 'truck', z: -13.6, center: -15, offset: 105, direction: -1 },
  ];
  for (const route of trafficRoutes) {
    const car = new THREE.Group();
    car.userData.animated = true;
    car.name = route.kind;
    car.rotation.y = route.direction > 0 ? 0 : Math.PI;
    const length = route.kind === 'bus' ? 10.5 : route.kind === 'truck' ? 7.2 : 3.8;
    const width = route.kind === 'car' ? 1.65 : 2.35;
    const wheelRadius = route.kind === 'car' ? 0.23 : 0.43;
    if (route.kind === 'car') {
      roundedBox(car, [3.8, 0.55, width], [0, 0.48, 0], cityWhite, 0.16);
      roundedBox(car, [1.95, 0.5, 1.4], [-0.08, 0.97, 0], vehicleGlass, 0.14);
      roundedBox(car, [1.55, 0.055, 1.25], [-0.08, 1.23, 0], cityWhite, 0.025);
    } else if (route.kind === 'bus') {
      roundedBox(car, [length, 2.6, width], [0, 1.7, 0], cityWhite, 0.18);
      box(car, [length - 0.2, 0.35, width + 0.015], [0, 0.95, 0], vehiclePaint);
      for (const side of [-1, 1]) {
        for (let x = -4.2; x < 4.7; x += 1.2) box(car, [1.06, 1.03, 0.035], [x, 2.13, side * (width / 2 + 0.02)], vehicleGlass);
        for (const x of [2.8, -2.8]) box(car, [0.06, 2.2, 0.045], [x, 1.65, side * (width / 2 + 0.04)], tireMaterial);
      }
      box(car, [0.04, 1.15, 2.08], [length / 2 + 0.02, 2.03, 0], vehicleGlass);
      roundedBox(car, [2.6, 0.22, 1.4], [-1, 3.06, 0], citySpandrel, 0.08);
    } else {
      roundedBox(car, [2.2, 2.2, width], [2.45, 1.56, 0], vehiclePaint, 0.15);
      box(car, [0.035, 0.85, 2.02], [3.565, 2.03, 0], vehicleGlass);
      for (const side of [-1, 1]) box(car, [1.45, 0.85, 0.035], [2.5, 2.03, side * 1.19], vehicleGlass);
      roundedBox(car, [4.8, 2.6, width], [-1.1, 1.95, 0], cityWhite, 0.035);
      for (let x = -3.3; x < 1.2; x += 0.38) {
        for (const side of [-1, 1]) box(car, [0.028, 2.4, 0.025], [x, 1.95, side * 1.19], citySpandrel, false);
      }
      box(car, [6.8, 0.25, 1.9], [0, 0.61, 0], tireMaterial);
    }
    for (const x of [-length * 0.31, length * 0.31]) for (const z of [-width / 2, width / 2]) {
      const wheel = cylinder(car, wheelRadius, 0.18, [x, wheelRadius, z], tireMaterial, 16);
      wheel.rotation.x = Math.PI / 2;
      const hub = cylinder(car, wheelRadius * 0.55, 0.19, [x, wheelRadius, z], citySpandrel, 12);
      hub.rotation.x = Math.PI / 2;
    }
    for (const z of [-width * 0.32, width * 0.32]) box(car, [0.035, 0.14, 0.25], [length / 2 + 0.02, 0.7, z], laneMaterial, false);
    const vehicleMaterials = new Map();
    car.traverse(object => {
      if (!object.material) return;
      if (!vehicleMaterials.has(object.material)) vehicleMaterials.set(object.material, object.material.clone());
      object.material = vehicleMaterials.get(object.material);
    });
    batchMovingMeshes(car);
    district.add(car);
    const x = route.offset - 68 + Math.random() * 14 - 7;
    car.position.set(x, -0.11, route.z);
    vehicles.push({ car, ...route, speed: trafficSpeed(route.kind), x, length, wait: 0, trips: 0, materials: [...vehicleMaterials.values()] });
  }

  const boat = new THREE.Group();
  boat.name = 'River launch';
  boat.userData.animated = true;
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.8, -1);
  hullShape.lineTo(1.8, -1.05);
  hullShape.quadraticCurveTo(3, -0.7, 3.5, 0);
  hullShape.quadraticCurveTo(3, 0.7, 1.8, 1.05);
  hullShape.lineTo(-2.8, 1);
  hullShape.closePath();
  const hullGeometry = new THREE.ExtrudeGeometry(hullShape, { depth: 0.6, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.1, bevelSegments: 2, steps: 1 });
  hullGeometry.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(hullGeometry, cityWhite);
  hull.position.y = -0.36;
  hull.castShadow = true;
  boat.add(hull);
  roundedBox(boat, [2.5, 0.7, 1.65], [-0.25, 0.53, 0], vehicleGlass, 0.14);
  roundedBox(boat, [2.8, 0.1, 1.85], [-0.25, 0.93, 0], cityWhite, 0.08);
  box(boat, [1.1, 0.08, 1.6], [-1.95, 0.31, 0], citySpandrel);
  for (const side of [-1, 1]) {
    line(boat, [[-2.6, 0.38, side], [1.8, 0.38, side], [3.2, 0.38, side * 0.25]], 0xaab9c6);
    for (let i = 0; i < 3; i++) line(boat, [[-2.9 - i, -0.17, side * (0.6 + i * 0.1)], [-6 - i, -0.17, side * (1.5 + i * 0.2)]], 0xe4f3f8, 0.35 - i * 0.08);
  }
  riverfront.add(boat);
  const boatMaterials = new Map();
  boat.traverse(object => {
    if (!object.material) return;
    if (!boatMaterials.has(object.material)) boatMaterials.set(object.material, object.material.clone());
    object.material = boatMaterials.get(object.material);
  });
  batchMovingMeshes(boat);
  let boatTravel = -3;
  boat.position.set(boatTravel, 0, riverCenter(boatTravel));

  const turbineRotors = [];
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.035, 0.06);
  bladeShape.bezierCurveTo(-0.08, 0.16, -0.05, 0.47, -0.015, 0.93);
  bladeShape.quadraticCurveTo(0, 1.02, 0.024, 0.96);
  bladeShape.bezierCurveTo(0.075, 0.65, 0.12, 0.3, 0.055, 0.12);
  bladeShape.lineTo(0.035, 0.06);
  bladeShape.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2, steps: 1 });
  for (const [x, z, height, radius, speed] of [[-23, 24, 18, 5.3, 0.7], [-25, -44, 24, 6.2, 0.85]]) {
    const turbine = new THREE.Group();
    turbine.userData.animated = true;
    turbine.name = 'Wind turbine';
    turbine.position.set(x, 0, z);
    turbine.rotation.y = 0.6;
    cylinder(turbine, 1.1, 0.22, [0, 0.02, 0], pavement, 32);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.48, height, 20), cityWhite);
    mast.position.y = height / 2;
    mast.castShadow = true;
    turbine.add(mast);
    roundedBox(turbine, [0.95, 0.95, 2.25], [0, height, 0], cityWhite, 0.3);
    const rotor = new THREE.Group();
    rotor.position.set(0, height, 1.3);
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 24), cityWhite);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.22;
    rotor.add(hub);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeometry, cityWhite);
      blade.scale.setScalar(radius);
      blade.rotation.z = i * Math.PI * 2 / 3;
      blade.castShadow = true;
      rotor.add(blade);
    }
    turbine.add(rotor);
    district.add(turbine);
    turbineRotors.push({ rotor, speed, phase: turbineRotors.length * 0.8 });
  }
  // Batch the static district while keeping traffic and turbine rotors independent.
  district.updateMatrixWorld(true);
  const staticBatches = new Map();
  const staticBoxes = [];
  district.traverse(object => {
    if (object.geometry !== boxGeo) return;
    for (let parent = object.parent; parent && parent !== district; parent = parent.parent) {
      if (parent.userData.animated) return;
    }
    if (!staticBatches.has(object.material)) staticBatches.set(object.material, { geometries: [], castShadow: false });
    const batch = staticBatches.get(object.material);
    batch.geometries.push(boxGeo.clone().applyMatrix4(object.matrixWorld));
    batch.castShadow ||= object.castShadow;
    staticBoxes.push(object);
  });
  staticBatches.forEach(({ geometries, castShadow }, material) => {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    district.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  });
  staticBoxes.forEach(mesh => mesh.removeFromParent());
  const districtMaterials = new Map();
  district.traverse(object => {
    if (object.material) {
      districtMaterials.set(object.material, object.material.opacity);
      object.material.transparent = true;
    }
  });
  box(scene, [27, 0.42, 18], [2.4, 0, 0.5], materials.trim);
  box(scene, [27.5, 0.13, 18.5], [2.4, -0.19, 0.5], materials.stone);
  for (let x = -10; x <= 15; x += 2) line(scene, [[x, 0.216, -8.5], [x, 0.216, 9.5]], 0xcdd0c5, 0.55);
  for (let z = -8; z <= 9; z += 2) line(scene, [[-11.1, 0.217, z], [15.9, 0.217, z]], 0xcdd0c5, 0.55);

  function outline(level, scale = 1) {
    const points = [];
    const taper = 1 - level * 0.007;
    for (let i = 0; i < 80; i++) {
      const a = i / 80 * Math.PI * 2;
      const wave = 1 + 0.09 * Math.sin(3 * a + level * 0.12) + 0.045 * Math.cos(2 * a - level * 0.1);
      points.push(new THREE.Vector2(Math.cos(a) * 5.5 * wave * taper * scale + Math.sin(level * 0.2) * 0.28, Math.sin(a) * 4.15 * wave * taper * scale));
    }
    return points;
  }
  function slabGeometry(level, depth, scale = 1) {
    const shape = new THREE.Shape(outline(level, scale));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.055, bevelThickness: 0.045, curveSegments: 32 });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }
  const floors = [];
  let acpPanelCount = 0;
  for (let f = 0; f <= 14; f++) {
    const group = new THREE.Group();
    const slabMat = materials.trim.clone();
    slabMat.transparent = true;
    const slab = new THREE.Mesh(slabGeometry(f, f === 14 ? 0.25 : 0.18), slabMat);
    slab.position.y = 0.35 + f * LAYOUT.floorHeight;
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);
    const facadeMat = new THREE.MeshPhysicalMaterial({
      color: COLORS.glass, roughness: 0.17, metalness: 0.32, transparent: true, opacity: 0.76,
      side: THREE.DoubleSide, envMap: facadeEnvironment.texture, envMapIntensity: 0.95,
      clearcoat: 0.65, clearcoatRoughness: 0.12, vertexColors: true,
    });
    const acpMat = new THREE.MeshStandardMaterial({ color: 0xc0cdd8, metalness: 0.55, roughness: 0.32, transparent: true });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x647b8d, metalness: 0.35, roughness: 0.52, transparent: true });
    const mullionMat = materials.stone.clone();
    mullionMat.transparent = true;
    if (f < 14) {
      const facadeShape = new THREE.Shape(outline(f, 0.93));
      const hole = new THREE.Path(outline(f, 0.913).reverse());
      facadeShape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(facadeShape, { depth: LAYOUT.floorHeight - 0.22, bevelEnabled: false, steps: 1 });
      geo.rotateX(-Math.PI / 2);
      const positions = geo.getAttribute('position');
      const glassColors = [];
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const pane = Math.floor((Math.atan2(positions.getZ(vertex), positions.getX(vertex)) + Math.PI) * 20 / Math.PI);
        const tint = 0.88 + ((pane * 7 + f * 3) % 6) * 0.025;
        glassColors.push(tint, tint, Math.min(1, tint + 0.025));
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(glassColors, 3));
      const facade = new THREE.Mesh(geo, facadeMat);
      facade.position.y = 0.53 + f * LAYOUT.floorHeight;
      facade.receiveShadow = true;
      group.add(facade);
      const points = outline(f, 0.935);
      const mullions = [];
      const panels = [], joints = [];
      const panelPoints = outline(f, 0.95);
      function facadeSegment(a, b, y, height, depth, inset = 0) {
        const dx = b.x - a.x, dz = a.y - b.y;
        const geometry = new THREE.BoxGeometry(Math.max(0.02, Math.hypot(dx, dz) - inset), height, depth);
        geometry.rotateY(-Math.atan2(dz, dx));
        geometry.translate((a.x + b.x) / 2, y, -(a.y + b.y) / 2);
        return geometry;
      }
      for (let j = 0; j < 80; j += 2) {
        const p = points[j];
        const g = new THREE.BoxGeometry(0.055, LAYOUT.floorHeight - 0.21, 0.055);
        g.translate(p.x, 0.53 + (LAYOUT.floorHeight - 0.21) / 2 + f * LAYOUT.floorHeight, -p.y);
        mullions.push(g);
        const next = (j + 2) % 80;
        mullions.push(facadeSegment(points[j], points[next], 2.86 + f * LAYOUT.floorHeight, 0.035, 0.055));
        panels.push(facadeSegment(panelPoints[j], panelPoints[next], 0.75 + f * LAYOUT.floorHeight, 0.38, 0.085, 0.025));
        joints.push(facadeSegment(panelPoints[j], panelPoints[next], 0.535 + f * LAYOUT.floorHeight, 0.025, 0.07));
        acpPanelCount++;
        if (j % 10 === 0) {
          const fin = new THREE.BoxGeometry(0.12, LAYOUT.floorHeight - 0.5, 0.14);
          fin.rotateY(Math.atan2(panelPoints[j].x, panelPoints[j].y));
          fin.translate(panelPoints[j].x, 2.04 + f * LAYOUT.floorHeight, -panelPoints[j].y);
          panels.push(fin);
        }
      }
      const panelMesh = new THREE.Mesh(mergeGeometries(panels), acpMat);
      panelMesh.name = 'ACP rainscreen panels and vertical fins';
      panelMesh.receiveShadow = true;
      group.add(panelMesh, new THREE.Mesh(mergeGeometries(joints), jointMat));
      panels.forEach(geometry => geometry.dispose());
      joints.forEach(geometry => geometry.dispose());
      const mullionMesh = new THREE.Mesh(mergeGeometries(mullions), mullionMat);
      group.add(mullionMesh);
      mullions.forEach(g => g.dispose());
      const interior = box(group, [2.2, 3.15, 2.7], [-0.5, 2.1 + f * LAYOUT.floorHeight, -1], mullionMat);
      interior.castShadow = false;
    }
    scene.add(group);
    floors.push({ group, slabMat, facadeMat, mullionMat, acpMat, jointMat, slab });
  }

  const entrance = new THREE.Group();
  entrance.name = 'Main lobby entrance';
  const entryGlass = new THREE.MeshPhysicalMaterial({ color: 0x9bb7c9, metalness: 0.2, roughness: 0.12, transparent: true, opacity: 0.6, envMap: facadeEnvironment.texture, clearcoat: 0.7 });
  box(entrance, [3.5, 0.15, 1.35], [0.3, 0.30, 4.48], materials.stone);
  box(entrance, [3.15, 0.16, 0.85], [0.3, 0.45, 4.28], materials.trim);
  for (const x of [-0.35, 0.95]) {
    box(entrance, [1.24, 2.62, 0.045], [x, 1.85, 4.14], entryGlass, false);
    box(entrance, [0.035, 0.5, 0.06], [x + (x < 0 ? 0.5 : -0.5), 1.75, 4.21], brushedMetal);
  }
  for (const x of [-1.05, 0.3, 1.65]) box(entrance, [0.055, 2.8, 0.065], [x, 1.86, 4.13], brushedMetal);
  box(entrance, [3.5, 0.12, 1.8], [0.3, 3.32, 4.6], brushedMetal);
  box(entrance, [3.25, 0.025, 1.55], [0.3, 3.39, 4.6], entryGlass, false);
  scene.add(entrance);

  // A lower, sculpted annex shares the podium and architectural language.
  const annex = new THREE.Group();
  annex.position.set(-6.7, 0, -1.7);
  for (let i = 0; i < 5; i++) {
    const slab = new THREE.Mesh(slabGeometry(i, 0.19, 0.63), materials.trim);
    slab.position.y = 0.45 + i * 3.2;
    slab.castShadow = true;
    slab.receiveShadow = true;
    annex.add(slab);
    const glass = cylinder(annex, 2.5, 2.96, [0, 2.1 + i * 3.2, 0], new THREE.MeshStandardMaterial({ color: 0x9cafc1, roughness: 0.5 }), 64);
    glass.scale.set(1.23, 1, 0.83);
  }
  scene.add(annex);

  const roof = new THREE.Group();
  roof.position.y = 0.68 + 14 * LAYOUT.floorHeight;
  box(roof, [2.6, 0.75, 2.2], [-1.3, 0, -0.6], materials.stone);
  for (let i = 0; i < 8; i++) box(roof, [2.3, 0.08, 0.06], [-1.3, 0.42, -1.5 + i * 0.24], materials.metal);
  const roofFin = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.13, 8, 80, Math.PI * 1.4), materials.trim);
  roofFin.rotation.set(Math.PI / 2.8, 0.25, 0);
  roofFin.position.set(0.6, 0.1, 0);
  roof.add(roofFin);
  scene.add(roof);

  function plantPot(parent, x, y, z, scale = 1) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.19 * scale, 0.145 * scale, 0.36 * scale, 32), materials.trim);
    pot.position.set(x, y + 0.18 * scale, z);
    pot.castShadow = true;
    parent.add(pot);
    cylinder(parent, 0.17 * scale, 0.012, [x, y + 0.35 * scale, z], materials.soil, 24);
    cylinder(parent, 0.012 * scale, 0.72 * scale, [x, y + 0.7 * scale, z], walnut, 8);
    const foliage = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), materials.leaf, 26);
    const leaf = new THREE.Object3D();
    const stems = [];
    for (let i = 0; i < 26; i++) {
      const angle = i * 2.4;
      const height = 0.58 + (i / 26) * 0.64;
      const spread = 0.16 + Math.sin(i * 0.9) * 0.055;
      leaf.position.set(x + Math.cos(angle) * spread * scale, y + height * scale, z + Math.sin(angle) * spread * scale);
      leaf.scale.set(0.065 * scale, 0.17 * scale, 0.018 * scale);
      leaf.rotation.set(0.65 * Math.sin(angle), angle, 0.8 * Math.cos(angle));
      leaf.updateMatrix();
      foliage.setMatrixAt(i, leaf.matrix);
      foliage.setColorAt(i, new THREE.Color().setHSL(0.24, 0.22, 0.48 + (i % 4) * 0.07));
      stems.push(vec([x, y + (height - 0.05) * scale, z]), leaf.position.clone());
    }
    foliage.castShadow = true;
    parent.add(foliage);
    parent.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(stems), new THREE.LineBasicMaterial({ color: 0x6f7750 })));
    return pot;
  }
  for (const [x, z] of [[-9, 5], [-7, 6], [-4, 6], [0, 7], [3, 7], [13, -6], [13, -3]]) {
    box(scene, [1.2, 0.3, 1.2], [x, 0.38, z], materials.stone);
    plantPot(scene, x, 0.55, z, 1.5);
  }
  for (const x of [-8, -3, 2]) {
    box(scene, [1.8, 0.13, 0.6], [x, 0.75, 7.8], materials.wood);
    box(scene, [0.12, 0.5, 0.5], [x - 0.65, 0.5, 7.8], materials.dark);
    box(scene, [0.12, 0.5, 0.5], [x + 0.65, 0.5, 7.8], materials.dark);
  }

  const office = new THREE.Group();
  scene.add(office);
  const { officeY, ceilingY, serviceY } = LAYOUT;
  const finishedFloorY = officeY + 0.035;
  box(office, [5.9, 0.07, 3.8], [0.4, officeY, 0.65], travertine);
  for (let x = -2.55; x < 3.3; x += 0.6) {
    for (let z = -1.25; z < 2.5; z += 0.6) {
      const tileWidth = Math.min(0.595, 3.35 - x - 0.005);
      const tileDepth = Math.min(0.595, 2.55 - z - 0.005);
      box(office, [tileWidth, 0.008, tileDepth], [x + tileWidth / 2, finishedFloorY + 0.004, z + tileDepth / 2], travertine, false);
    }
  }
  const featureWall = box(office, [5.9, 2.76, 0.10], [0.4, finishedFloorY + 1.38, -1.23], silverStone);
  featureWall.name = 'Honed silver limestone feature wall';
  for (let i = 1; i < 5; i++) box(office, [0.008, 2.65, 0.009], [-2.55 + i * 1.18, finishedFloorY + 1.4, -1.175], brushedMetal, false);
  box(office, [5.9, 0.065, 0.025], [0.4, finishedFloorY + 0.035, -1.16], brushedMetal, false);
  box(office, [1.45, 1.95, 0.05], [2.1, finishedFloorY + 1.55, -1.14], materials.trim);
  for (let i = 0; i < 7; i++) {
    line(office, [[1.5 + i * 0.12, finishedFloorY + 0.6, -1.108], [1.85 + i * 0.12, finishedFloorY + 1.35, -1.108], [1.6 + i * 0.12, finishedFloorY + 2.5, -1.108]], 0xb1aa9b, 0.3);
  }
  roundedBox(office, [1.2, 0.62, 0.38], [2.12, finishedFloorY + 0.36, -0.88], silverStone, 0.025);
  box(office, [1.22, 0.035, 0.4], [2.12, finishedFloorY + 0.685, -0.88], materials.trim);
  for (let i = 0; i < 3; i++) box(office, [0.28, 0.035, 0.18], [1.85, finishedFloorY + 0.72 + i * 0.035, -0.85], i % 2 ? materials.trim : leather);
  cylinder(office, 0.09, 0.26, [2.43, finishedFloorY + 0.82, -0.88], bronze);
  const rug = roundedBox(office, [3.65, 0.014, 2.2], [-0.6, finishedFloorY + 0.018, 0.35], new THREE.MeshStandardMaterial({ color: 0xb9b8af, roughness: 1 }), 0.015);
  rug.castShadow = false;
  function desk(x, z) {
    const group = new THREE.Group();
    group.position.set(x, finishedFloorY + 0.025, z);
    roundedBox(group, [1.55, 0.045, 0.78], [0, LAYOUT.deskHeight - 0.0225, 0], walnut, 0.02);
    for (const dx of [-0.65, 0.65]) {
      box(group, [0.045, 0.7, 0.045], [dx, 0.35, 0], bronze);
      roundedBox(group, [0.08, 0.025, 0.64], [dx, 0.025, 0], bronze, 0.01);
    }
    roundedBox(group, [0.65, 0.008, 0.32], [0, 0.756, 0.09], leather, 0.015);
    roundedBox(group, [0.55, 0.33, 0.025], [0, 1.05, -0.23], materials.dark, 0.012);
    box(group, [0.515, 0.295, 0.003], [0, 1.05, -0.214], materials.screen);
    box(group, [0.035, 0.15, 0.035], [0, 0.83, -0.23], materials.metal);
    roundedBox(group, [0.22, 0.012, 0.15], [0, 0.76, -0.23], materials.metal, 0.01);
    box(group, [0.3, 0.012, 0.12], [0, 0.77, 0.12], materials.metal);
    cylinder(group, 0.035, 0.09, [0.54, 0.8, 0.12], materials.trim, 20);
    roundedBox(group, [0.24, 0.018, 0.18], [-0.5, 0.765, 0.1], materials.trim, 0.008);
    roundedBox(group, [0.5, 0.09, 0.48], [0, 0.46, 0.78], leather, 0.045);
    const back = roundedBox(group, [0.49, 0.58, 0.075], [0, 0.77, 1.0], leather, 0.035);
    back.rotation.x = -0.09;
    for (const dx of [-0.3, 0.3]) {
      box(group, [0.025, 0.2, 0.025], [dx, 0.56, 0.78], bronze);
      roundedBox(group, [0.065, 0.035, 0.3], [dx, 0.67, 0.8], leather, 0.015);
    }
    cylinder(group, 0.025, 0.35, [0, 0.24, 0.78], materials.metal, 12);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const spoke = box(group, [0.32, 0.025, 0.025], [Math.cos(a) * 0.14, 0.09, 0.78 + Math.sin(a) * 0.14], materials.metal);
      spoke.rotation.y = -a;
      const wheel = cylinder(group, 0.035, 0.04, [Math.cos(a) * 0.29, 0.04, 0.78 + Math.sin(a) * 0.29], materials.dark, 12);
      wheel.rotation.x = Math.PI / 2;
    }
    office.add(group);
  }
  desk(-1.45, -0.45);
  desk(0.35, -0.45);
  function loungeChair(x, z, rotation) {
    const chair = new THREE.Group();
    chair.position.set(x, finishedFloorY, z);
    chair.rotation.y = rotation;
    roundedBox(chair, [0.7, 0.16, 0.67], [0, 0.4, 0], upholstery, 0.075);
    roundedBox(chair, [0.7, 0.45, 0.15], [0, 0.65, -0.28], upholstery, 0.065);
    for (const dx of [-0.32, 0.32]) {
      roundedBox(chair, [0.13, 0.23, 0.61], [dx, 0.52, 0.01], upholstery, 0.05);
      for (const dz of [-0.25, 0.25]) cylinder(chair, 0.018, 0.29, [dx, 0.18, dz], bronze, 10);
    }
    office.add(chair);
  }
  loungeChair(2.55, 0.45, -Math.PI / 2);
  loungeChair(2.55, 1.95, -Math.PI / 2);
  cylinder(office, 0.32, 0.04, [2.25, finishedFloorY + 0.46, 1.2], travertine, 48);
  cylinder(office, 0.08, 0.43, [2.25, finishedFloorY + 0.23, 1.2], bronze, 24);
  cylinder(office, 0.22, 0.025, [2.25, finishedFloorY + 0.02, 1.2], bronze, 32);
  plantPot(office, -2.12, finishedFloorY, 1.95, 1.25);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf1f0ec, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const ceiling = box(office, [5.9, 0.05, 3.8], [0.4, ceilingY, 0.65], ceilingMat);
  box(office, [5.9, 0.12, 0.2], [0.4, ceilingY - 0.03, -1.13], materials.trim);
  box(office, [0.18, 0.12, 3.8], [-2.46, ceilingY - 0.03, 0.65], materials.trim);
  box(office, [5.5, 0.018, 0.025], [0.4, ceilingY - 0.095, -1.01], warmLight, false);
  box(office, [0.025, 0.018, 3.4], [-2.35, ceilingY - 0.095, 0.65], warmLight, false);
  const ceilingGrid = new THREE.Group();
  for (const x of [-1.5, 0.35, 2.15]) {
    const light = cylinder(ceilingGrid, 0.045, 0.012, [x, ceilingY - 0.03, 0.5], warmLight, 16);
    light.castShadow = false;
  }
  office.add(ceilingGrid);

  const roomDevices = [];
  const deviceTextures = [];
  const control = new THREE.Group();
  control.name = 'Smart room controller';
  control.position.set(3.04, finishedFloorY + 1.48, -1.14);
  roundedBox(control, [0.28, 0.40, 0.035], [0, 0, 0], brushedMetal, 0.012);
  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = 512;
  displayCanvas.height = 680;
  const context = displayCanvas.getContext('2d');
  const controlTexture = new THREE.CanvasTexture(displayCanvas);
  controlTexture.colorSpace = THREE.SRGBColorSpace;
  controlTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  deviceTextures.push(controlTexture);
  let roomTemperature = 26.5;
  const roomConditions = { lightsOn: true, presenceDetected: true };
  function paintRoomControl(temperature) {
    context.fillStyle = '#152832';
    context.fillRect(0, 0, 512, 680);
    context.textAlign = 'center';
    context.fillStyle = '#9bb5c1';
    context.font = '500 22px Barlow, sans-serif';
    context.fillText('ROOM TEMPERATURE', 256, 47);
    context.fillStyle = '#f0f7fa';
    context.font = '500 76px Barlow, sans-serif';
    context.fillText(`${temperature.toFixed(1)} C`, 256, 132);
    context.fillStyle = '#78939f';
    context.font = '18px Barlow, sans-serif';
    context.fillText('SIMULATED ROOM', 256, 165);
    const iconStroke = (points) => {
      context.beginPath();
      points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
      context.stroke();
    };
    const circle = (x, y, radius) => {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.stroke();
    };
    for (const [i, label] of ['HVAC', 'LIGHT', 'SOUND', 'FAN'].entries()) {
      const y = 242 + i * 108;
      context.strokeStyle = '#354c57';
      context.lineWidth = 1;
      iconStroke([[30, y - 43], [482, y - 43]]);
      context.fillStyle = '#e3f0f4';
      context.textAlign = 'left';
      context.font = '500 26px Barlow, sans-serif';
      context.fillText(label, 112, y - 4);
      context.fillStyle = '#9bb5c1';
      context.font = '21px Barlow, sans-serif';
      context.fillText(['21.5 C SET', roomConditions.lightsOn ? 'ON' : 'OFF', '40%', 'AUTO'][i], 112, y + 26);
      context.strokeStyle = '#b5d8e5';
      context.lineWidth = 3;
      context.lineCap = 'round';
      if (i === 0) {
        circle(64, y + 17, 10);
        iconStroke([[58, y + 7], [58, y - 23], [70, y - 23], [70, y + 7]]);
        iconStroke([[64, y + 12], [64, y - 12]]);
      } else if (i === 1) {
        circle(64, y, 13);
        for (let ray = 0; ray < 8; ray++) {
          const angle = ray * Math.PI / 4;
          iconStroke([[64 + Math.cos(angle) * 21, y + Math.sin(angle) * 21], [64 + Math.cos(angle) * 28, y + Math.sin(angle) * 28]]);
        }
      } else if (i === 2) {
        iconStroke([[42, y - 9], [53, y - 9], [67, y - 22], [67, y + 22], [53, y + 9], [42, y + 9], [42, y - 9]]);
        context.beginPath();
        context.arc(67, y, 19, -0.8, 0.8);
        context.stroke();
        context.beginPath();
        context.arc(67, y, 29, -0.8, 0.8);
        context.stroke();
      } else {
        circle(64, y, 5);
        for (let blade = 0; blade < 3; blade++) {
          context.save();
          context.translate(64, y);
          context.rotate(blade * Math.PI * 2 / 3);
          context.beginPath();
          context.moveTo(4, -4);
          context.bezierCurveTo(7, -33, 31, -23, 24, -8);
          context.quadraticCurveTo(18, 0, 4, -4);
          context.stroke();
          context.restore();
        }
      }
      if (i === 1) {
        context.fillStyle = '#456c7b';
        context.beginPath();
        context.roundRect(350, y - 20, 103, 40, 20);
        context.fill();
        context.fillStyle = '#e7f5fa';
        context.beginPath();
        context.arc(432, y, 14, 0, Math.PI * 2);
        context.fill();
      } else {
        for (const x of [362, 442]) {
          context.strokeStyle = '#45616f';
          context.beginPath();
          context.roundRect(x - 28, y - 28, 56, 56, 12);
          context.stroke();
          context.strokeStyle = '#d6eaf2';
          iconStroke([[x - 9, y], [x + 9, y]]);
          if (x === 442) iconStroke([[x, y - 9], [x, y + 9]]);
        }
      }
    }
    controlTexture.needsUpdate = true;
  }
  paintRoomControl(roomTemperature);
  box(control, [0.25, 0.366, 0.004], [0, 0, 0.021], new THREE.MeshStandardMaterial({ map: controlTexture, emissiveMap: controlTexture, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.25 }), false);
  office.add(control);
  roomDevices.push(control);
  const cctv = new THREE.Group();
  cctv.name = 'Ceiling CCTV camera';
  cctv.position.set(-2.18, ceilingY - 0.16, -0.85);
  cylinder(cctv, 0.11, 0.045, [0, 0.09, 0], materials.trim, 24);
  const cameraDome = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x576c7d, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.62 }));
  cameraDome.position.y = 0.07;
  cctv.add(cameraDome);
  const lens = cylinder(cctv, 0.031, 0.055, [0.015, 0.02, 0.06], materials.screen, 20);
  lens.rotation.x = Math.PI / 2.5;
  office.add(cctv);
  roomDevices.push(cctv);
  const presence = new THREE.Group();
  presence.name = 'Ceiling presence sensor';
  presence.position.set(1.45, ceilingY - 0.055, 1.85);
  cylinder(presence, 0.085, 0.032, [0, 0, 0], materials.trim, 24);
  const sensorLens = new THREE.Mesh(new THREE.SphereGeometry(0.056, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe4edf2, roughness: 0.37, flatShading: true }));
  sensorLens.position.y = -0.013;
  presence.add(sensorLens);
  cylinder(presence, 0.007, 0.004, [0.064, -0.018, 0], new THREE.MeshBasicMaterial({ color: 0x76b1c7 }), 8);
  office.add(presence);
  roomDevices.push(presence);

  const extinguisher = new THREE.Group();
  extinguisher.name = 'Wall-mounted fire extinguisher';
  extinguisher.position.set(3.07, finishedFloorY + 0.13, -1.03);
  const safetyRed = new THREE.MeshStandardMaterial({ color: 0xb82228, roughness: 0.28, metalness: 0.2 });
  cylinder(extinguisher, 0.092, 0.39, [0, 0.25, 0], safetyRed, 32);
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.092, 24, 16), safetyRed);
  shoulder.scale.y = 0.55;
  shoulder.position.y = 0.445;
  extinguisher.add(shoulder);
  cylinder(extinguisher, 0.088, 0.035, [0, 0.055, 0], materials.dark, 24);
  cylinder(extinguisher, 0.02, 0.06, [0, 0.50, 0], bronze, 16);
  roundedBox(extinguisher, [0.13, 0.018, 0.035], [0.027, 0.545, 0], materials.dark, 0.007);
  roundedBox(extinguisher, [0.105, 0.012, 0.027], [0.016, 0.573, 0], materials.dark, 0.005);
  box(extinguisher, [0.105, 0.19, 0.005], [0, 0.255, 0.092], materials.trim, false);
  for (let i = 0; i < 4; i++) box(extinguisher, [0.07 - i % 2 * 0.02, 0.009, 0.002], [0, 0.31 - i * 0.025, 0.096], materials.dark, false);
  const hose = new THREE.CatmullRomCurve3([vec([0.03, 0.52, 0]), vec([0.14, 0.46, 0.01]), vec([0.14, 0.27, 0.02]), vec([0.10, 0.13, 0.04])]);
  extinguisher.add(new THREE.Mesh(new THREE.TubeGeometry(hose, 24, 0.012, 8, false), materials.dark));
  const gauge = cylinder(extinguisher, 0.024, 0.012, [0, 0.49, 0.032], materials.trim, 20);
  gauge.rotation.x = Math.PI / 2;
  box(extinguisher, [0.07, 0.20, 0.035], [0, 0.38, -0.09], brushedMetal);
  office.add(extinguisher);

  const roomAnnotations = [
    { id: 'room-control', title: 'Smart room controller', description: 'Adjusts cooling, lights, sound and fan speed in this room.', position: control.position.toArray(), powered: true, active: true },
    { id: 'cctv', title: 'CCTV camera', description: 'Monitors the room to help keep people and spaces safe.', position: cctv.position.toArray(), powered: true, active: true },
    { id: 'presence', title: 'Presence sensor', description: 'Detects people so lighting and cooling can respond automatically.', position: presence.position.toArray(), powered: true, active: true },
    { id: 'fire-extinguisher', title: 'Fire extinguisher', description: 'Emergency fire-safety equipment, kept within easy reach.', position: [3.07, finishedFloorY + 0.42, -0.93], powered: false, active: false },
  ];

  // Furniture stays fixed; batch its repeated boxes without merging the cutaway ceiling.
  office.updateMatrixWorld(true);
  const officeBatches = new Map();
  const officeBoxes = [];
  const officeInverse = office.matrixWorld.clone().invert();
  office.traverse(object => {
    if (object.geometry !== boxGeo || object.material.transparent) return;
    if (!officeBatches.has(object.material)) officeBatches.set(object.material, new Map());
    const batches = officeBatches.get(object.material);
    const key = `${object.castShadow}-${object.receiveShadow}`;
    if (!batches.has(key)) batches.set(key, { geometries: [], castShadow: object.castShadow, receiveShadow: object.receiveShadow });
    batches.get(key).geometries.push(boxGeo.clone().applyMatrix4(officeInverse.clone().multiply(object.matrixWorld)));
    officeBoxes.push(object);
  });
  officeBatches.forEach((batches, material) => batches.forEach(({ geometries, castShadow, receiveShadow }) => {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    office.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }));
  officeBoxes.forEach(mesh => mesh.removeFromParent());

  const zoneMat = new THREE.MeshBasicMaterial({ color: COLORS.fault, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const zone = box(scene, [6.3, 3.25, 3.7], [0.4, officeY + 1.625, 0.8], zoneMat, false);
  const zoneEdgeMat = new THREE.LineBasicMaterial({ color: COLORS.fault, transparent: true, opacity: 0, toneMapped: false });
  const zoneEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.3, 3.25, 3.7)), zoneEdgeMat);
  zoneEdge.position.copy(zone.position);
  scene.add(zoneEdge);
  const facadeHighlightMat = new THREE.MeshBasicMaterial({ color: COLORS.fault, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const facadeVertices = [];
  const facadeOutline = outline(10, 0.941);
  for (let i = 54; i < 76; i++) {
    const a = facadeOutline[i], b = facadeOutline[i + 1];
    facadeVertices.push(a.x, officeY, -a.y, b.x, officeY, -b.y, a.x, LAYOUT.upperSlabY - 0.06, -a.y);
    facadeVertices.push(b.x, officeY, -b.y, b.x, LAYOUT.upperSlabY - 0.06, -b.y, a.x, LAYOUT.upperSlabY - 0.06, -a.y);
  }
  const facadeHighlightGeo = new THREE.BufferGeometry();
  facadeHighlightGeo.setAttribute('position', new THREE.Float32BufferAttribute(facadeVertices, 3));
  facadeHighlightGeo.computeVertexNormals();
  const facadeHighlight = new THREE.Mesh(facadeHighlightGeo, facadeHighlightMat);
  scene.add(facadeHighlight);

  // Every route is in world coordinates: no replacement models during close-ups.
  function roundedRoute(points, radius = 0.19) {
    const vertices = points.map(vec);
    const curve = new THREE.CurvePath();
    let last = vertices[0];
    for (let i = 1; i < vertices.length - 1; i++) {
      const p = vertices[i], prev = vertices[i - 1], next = vertices[i + 1];
      const r = Math.min(radius, p.distanceTo(prev) * 0.3, p.distanceTo(next) * 0.3);
      const before = p.clone().add(prev.clone().sub(p).normalize().multiplyScalar(r));
      const after = p.clone().add(next.clone().sub(p).normalize().multiplyScalar(r));
      curve.add(new THREE.LineCurve3(last, before));
      curve.add(new THREE.QuadraticBezierCurve3(before, p, after));
      last = after;
    }
    curve.add(new THREE.LineCurve3(last, vertices.at(-1)));
    return curve;
  }
  const supplyPoints = [[10.8, 1.0, 2.3], [10.8, 0.7, 4.2], [7.6, 0.7, 4.2], [7.6, 0.7, -1.9], [5.15, 0.7, -1.9], [5.15, serviceY, -1.9], [4.0, serviceY, -1.9], [4.0, serviceY, 1.35], [2.66, serviceY, 1.35]];
  const blockedPoints = [[2.66, serviceY, 1.35], [2.44, serviceY, 1.35]];
  const downstreamPoints = [[2.44, serviceY, 1.35], [0.9, serviceY, 1.35], [0.9, serviceY, 0.38], [0.42, serviceY - 0.08, 0.38]];
  const coilPoints = [[0.42, serviceY - 0.08, 0.38], [-0.62, serviceY - 0.08, 0.38], [-0.62, serviceY - 0.04, 0.38], [0.42, serviceY - 0.04, 0.38], [0.42, serviceY, 0.38], [-0.62, serviceY, 0.38], [-0.62, serviceY + 0.04, 0.38], [0.42, serviceY + 0.04, 0.38], [0.42, serviceY + 0.08, 0.38], [-0.62, serviceY + 0.08, 0.38]];
  const returnPoints = [[-0.62, serviceY + 0.08, 0.38], [-1.1, serviceY + 0.08, 0.38], [-1.1, serviceY, -0.95], [5.75, serviceY, -0.95], [5.75, 0.7, -0.95], [8.7, 0.7, -0.95], [8.7, 0.7, 0.3], [10.0, 0.7, 0.3], [10.0, 1.0, 0.3]];
  const plantPoints = [[10.0, 1.0, 0.3], [10.0, 1.0, 1.2], [10.8, 1.0, 1.2], [10.8, 1.0, 2.3]];
  const curves = [roundedRoute(supplyPoints, 0.12), roundedRoute(blockedPoints), roundedRoute(downstreamPoints, 0.08), roundedRoute(coilPoints, 0.015), roundedRoute(returnPoints, 0.12), roundedRoute(plantPoints)];
  const pipeMaterials = [];
  const circuitGuideMaterials = [];
  curves.forEach((curve, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: i === 4 ? COLORS.return : COLORS.supply,
      roughness: 0.35, metalness: 0.2, transparent: true,
      opacity: i === 1 ? 0.22 : 0.65, depthWrite: false,
    });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.ceil(curve.getLength() * 18)), i === 3 ? LAYOUT.coilRadius : LAYOUT.branchRadius, 12, false), mat);
    tube.renderOrder = 2;
    scene.add(tube);
    pipeMaterials.push(mat);
    const guideMaterial = new THREE.LineBasicMaterial({ color: i === 4 ? 0xad8066 : 0x458fae, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(Math.max(60, Math.ceil(curve.getLength() * 8)))), guideMaterial);
    guide.renderOrder = 5;
    scene.add(guide);
    circuitGuideMaterials.push(guideMaterial);
  });
  for (const [x, z, color] of [[5.15, -1.9, COLORS.supply], [5.75, -0.95, COLORS.return]]) {
    const riserCurve = new THREE.LineCurve3(vec([x, 0.85, z]), vec([x, serviceY - 0.15, z]));
    const jacket = new THREE.Mesh(new THREE.TubeGeometry(riserCurve, 1, 0.058, 12, false), new THREE.MeshStandardMaterial({ color, roughness: 0.55, transparent: true, opacity: 0.58, depthWrite: false }));
    scene.add(jacket);
  }
  // Supply and return are paired with explicit brackets along the tower.
  for (let y = 2; y < serviceY; y += LAYOUT.floorHeight) {
    for (const [x, z] of [[5.15, -1.9], [5.75, -0.95]]) {
      box(scene, [0.36, 0.035, 0.05], [x - 0.12, y, z], materials.metal, false);
    }
  }
  function collar(x, y, z) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.009, 8, 24), materials.metal);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, y, z);
    scene.add(ring);
    return ring;
  }
  collar(2.66, serviceY, 1.35);
  collar(2.44, serviceY, 1.35);
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0xd8e4df, transparent: true, opacity: 0.2, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.22, 24, 1, true), sleeveMat);
  sleeve.rotation.z = Math.PI / 2;
  sleeve.position.set(2.55, serviceY, 1.35);
  scene.add(sleeve);
  const obstruction = new THREE.Group();
  obstruction.position.set(2.55, serviceY, 1.35);
  const blockageMat = new THREE.MeshStandardMaterial({ color: COLORS.fault, roughness: 0.82, emissive: COLORS.fault, emissiveIntensity: 0.22 });
  for (let i = 0; i < 11; i++) {
    const piece = new THREE.Mesh(new THREE.IcosahedronGeometry(0.014 + (i % 3) * 0.002, 0), blockageMat);
    piece.position.set((i % 4 - 1.5) * 0.018, Math.sin(i * 2.4) * 0.009, Math.cos(i * 2.4) * 0.009);
    obstruction.add(piece);
  }
  scene.add(obstruction);
  const repairRingMat = new THREE.MeshBasicMaterial({ color: COLORS.fault, transparent: true, opacity: 0.6, depthTest: false, toneMapped: false });
  const repairRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.003, 6, 64), repairRingMat);
  repairRing.position.set(2.55, serviceY, 1.35);
  scene.add(repairRing);
  const valveHandles = [];
  for (const x of [2.19, 2.9]) {
    const body = cylinder(scene, 0.043, 0.09, [x, serviceY, 1.35], bronze);
    body.rotation.z = Math.PI / 2;
    cylinder(scene, 0.009, 0.065, [x, serviceY + 0.065, 1.35], materials.dark, 8);
    const handle = box(scene, [0.14, 0.018, 0.025], [x, serviceY + 0.105, 1.35], materials.dark);
    valveHandles.push(handle);
  }

  const fcu = new THREE.Group();
  scene.add(fcu);
  const unitBase = box(fcu, [LAYOUT.fcuWidth, 0.025, LAYOUT.fcuDepth], [-0.1, serviceY - 0.1475, 0.08], materials.metal);
  box(fcu, [0.025, LAYOUT.fcuHeight, LAYOUT.fcuDepth], [-0.8375, serviceY, 0.08], materials.metal);
  box(fcu, [0.025, LAYOUT.fcuHeight, LAYOUT.fcuDepth], [0.6375, serviceY, 0.08], materials.metal);
  const fcuLidMat = new THREE.MeshStandardMaterial({ color: 0xc9d1d6, transparent: true, opacity: 1, roughness: 0.43, metalness: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const unitTop = box(fcu, [LAYOUT.fcuWidth, 0.015, LAYOUT.fcuDepth], [-0.1, serviceY + 0.1525, 0.08], fcuLidMat);
  const finsMat = new THREE.MeshStandardMaterial({ color: 0xb5bfc6, metalness: 0.65, roughness: 0.35, transparent: true, opacity: 0.48, depthWrite: false });
  for (let i = 0; i < 36; i++) box(fcu, [0.003, 0.23, 0.15], [-0.66 + i * 0.032, serviceY, 0.38], finsMat, false);
  box(fcu, [1.32, 0.23, 0.025], [-0.1, serviceY, -0.31], materials.dark);
  for (const x of [-0.78, 0.58]) for (const z of [-0.3, 0.46]) {
    cylinder(fcu, 0.005, LAYOUT.upperSlabY - serviceY, [x, (LAYOUT.upperSlabY + serviceY) / 2, z], materials.metal, 8);
    box(fcu, [0.07, 0.018, 0.07], [x, serviceY + 0.13, z], materials.dark, false);
  }
  const fans = [];
  for (const x of [-0.44, 0.24]) {
    const blower = new THREE.Group();
    blower.position.set(x, serviceY, -0.1);
    for (let i = 0; i < 18; i++) {
      const angle = i * Math.PI * 2 / 18;
      const blade = box(blower, [0.27, 0.012, 0.024], [0, Math.cos(angle) * 0.098, Math.sin(angle) * 0.098], materials.dark, false);
      blade.rotation.x = angle;
    }
    for (const dx of [-0.14, 0.14]) cylinder(blower, 0.108, 0.012, [dx, 0, 0], materials.metal, 24).rotation.z = Math.PI / 2;
    fcu.add(blower);
    fans.push(blower);
  }
  const ductMat = new THREE.MeshStandardMaterial({ color: 0xb6c1c9, metalness: 0.45, roughness: 0.6, transparent: true, opacity: 0.6, depthWrite: false });
  box(fcu, [1.3, 0.2, 0.78], [-0.1, serviceY - 0.015, 0.91], ductMat);
  box(fcu, [1.3, 0.27, 0.18], [-0.1, ceilingY + 0.14, 1.3], ductMat);
  box(fcu, [1.3, 0.2, 0.38], [-0.1, serviceY - 0.015, -0.56], ductMat);
  box(fcu, [1.3, 0.27, 0.3], [-0.1, ceilingY + 0.14, -0.72], ductMat);
  const diffusers = [];
  for (const [z, depth] of [[1.3, 0.16], [-0.72, 0.3]]) {
    const diffuser = box(fcu, [1.36, 0.025, depth], [-0.1, ceilingY - 0.025, z], materials.trim);
    diffusers.push(diffuser);
    for (let i = 0; i < (z > 0 ? 2 : 5); i++) box(fcu, [1.25, 0.006, 0.018], [-0.1, ceilingY - 0.041, z - depth * 0.3 + i * depth * 0.15], materials.dark, false);
  }
  // A trapped condensate drain falls away from the drain pan, separate from the water circuit.
  const drainCurve = roundedRoute([[-0.81, serviceY - 0.14, 0.45], [-0.98, serviceY - 0.14, 0.45], [-0.98, serviceY - 0.26, 0.45], [-1.13, serviceY - 0.26, 0.45], [-1.13, serviceY - 0.18, 0.45], [-1.3, serviceY - 0.18, -1.1]], 0.025);
  const drain = new THREE.Mesh(new THREE.TubeGeometry(drainCurve, 48, 0.012, 8, false), materials.trim);
  fcu.add(drain);

  const plant = new THREE.Group();
  scene.add(plant);
  const plantShellMat = new THREE.MeshStandardMaterial({ color: 0xb0bbb1, roughness: 0.6, transparent: true, opacity: 0.86 });
  box(plant, [4.3, 0.25, 3.1], [10.6, 0.4, 1.2], materials.stone);
  box(plant, [3.3, 1.45, 2.6], [10.6, 1.25, 1.2], plantShellMat);
  for (const x of [9.8, 11.4]) {
    const fanHousing = cylinder(plant, 0.58, 0.16, [x, 2.04, 1.2], materials.dark, 40);
    for (let r = 0.15; r < 0.58; r += 0.09) {
      const grate = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 5, 40), materials.metal);
      grate.rotation.x = Math.PI / 2;
      grate.position.set(x, 2.135, 1.2);
      plant.add(grate);
    }
    for (let i = 0; i < 8; i++) {
      const spoke = box(plant, [1.08, 0.012, 0.018], [x, 2.14, 1.2], materials.metal, false);
      spoke.rotation.y = i * Math.PI / 8;
    }
    fanHousing.castShadow = false;
  }
  for (let i = 0; i < 12; i++) box(plant, [0.04, 1.05, 0.04], [9.17 + i * 0.25, 1.25, 2.52], materials.dark, false);
  box(plant, [0.58, 0.7, 0.09], [12.28, 1.3, 1.2], materials.trim);
  box(plant, [0.25, 0.17, 0.03], [12.32, 1.45, 1.2], materials.screen);
  const pump = cylinder(plant, 0.28, 0.7, [7.6, 0.8, 4.2], materials.dark);
  pump.rotation.z = Math.PI / 2;
  box(plant, [1.3, 0.15, 0.9], [7.6, 0.36, 4.2], materials.stone);
  cylinder(plant, 0.21, 0.48, [8.04, 0.8, 4.2], materials.metal).rotation.z = Math.PI / 2;

  const waterGeometry = new THREE.SphereGeometry(0.016, 8, 6);
  const waterMat = new THREE.MeshBasicMaterial({ color: 0xe7fbff, transparent: true, opacity: 0.95, depthWrite: false });
  const streams = curves.map((curve, index) => {
    const count = Math.max(4, Math.ceil(curve.getLength() / 0.7));
    const particles = new THREE.InstancedMesh(waterGeometry, waterMat, count);
    particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particles.renderOrder = 3;
    particles.frustumCulled = false;
    scene.add(particles);
    return { curve, particles, count, length: curve.getLength(), index };
  });
  const arrowGeo = new THREE.ConeGeometry(0.018, 0.075, 3);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xe8ffff, transparent: true, opacity: 0.9, depthWrite: false });
  const arrows = [];
  for (const index of [0, 4]) {
    const curve = curves[index];
    for (let i = 0; i < 9; i++) {
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      const t = (i + 0.3) / 9;
      arrow.position.copy(curve.getPointAt(t));
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(t).normalize());
      arrow.renderOrder = 4;
      scene.add(arrow);
      arrows.push(arrow);
    }
  }

  const airGroup = new THREE.Group();
  scene.add(airGroup);
  const airPaths = [];
  const coolAirColor = new THREE.Color(0x589fbf);
  const returnAirColor = new THREE.Color(0xb6a28c);
  const airArrowGeometry = new THREE.ConeGeometry(0.042, 0.14, 3);
  const airArrowMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const airRibbonMaterials = [coolAirColor, returnAirColor, coolAirColor].map(color =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  for (let i = 0; i < 3; i++) {
    const x = -0.1 + (i - 1) * 0.32;
    const roomX = -0.1 + (i - 1) * 1.15;
    const outlet = [x, ceilingY - 0.055, 1.3];
    const intake = [x, ceilingY - 0.055, -0.72];
    const occupied = [roomX, finishedFloorY + 1.4, 1.65];
    // Pass between the water tubes, through the coil fins, within the service plenum.
    const coilIn = [x, serviceY + 0.02, 0.29];
    const coilOut = [x, serviceY + 0.02, 0.47];
    const supply = new THREE.CurvePath();
    supply.add(roundedRoute([coilOut, [x, serviceY + 0.02, 1.3], outlet], 0.065));
    supply.add(new THREE.CubicBezierCurve3(
      vec(outlet), vec([x, ceilingY - 0.85, 1.3]),
      vec([roomX, finishedFloorY + 1.4, 2.4]), vec(occupied),
    ));
    const roomReturn = new THREE.CurvePath();
    roomReturn.add(new THREE.CubicBezierCurve3(
      vec(occupied), vec([roomX, finishedFloorY + 1.4, 0.55]),
      vec([x, ceilingY - 0.7, -0.72]), vec(intake),
    ));
    roomReturn.add(roundedRoute([intake, [x, serviceY + 0.02, -0.72], coilIn], 0.065));
    const throughCoil = new THREE.LineCurve3(vec(coilIn), vec(coilOut));
    const sections = [supply, roomReturn, throughCoil];
    const path = new THREE.CurvePath();
    sections.forEach((section, sectionIndex) => {
      path.add(section);
      const vertices = [], indices = [];
      const divisions = Math.max(8, Math.ceil(section.getLength() * 24));
      for (let j = 0; j <= divisions; j++) {
        const point = section.getPointAt(j / divisions);
        vertices.push(point.x - 0.045, point.y, point.z, point.x + 0.045, point.y, point.z);
        if (j < divisions) {
          const k = j * 2;
          indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      const ribbon = new THREE.Mesh(geometry, airRibbonMaterials[sectionIndex]);
      airGroup.add(ribbon);
    });
    const particles = new THREE.InstancedMesh(airArrowGeometry, airArrowMaterial, 18);
    particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particles.frustumCulled = false;
    for (let j = 0; j < particles.count; j++) particles.setColorAt(j, coolAirColor);
    particles.instanceColor.setUsage(THREE.DynamicDrawUsage);
    airGroup.add(particles);
    const lengths = sections.map(section => section.getLength());
    airPaths.push({ path, particles, sections, lengths, length: path.getLength(), phase: i * 0.19 });
  }

  const state = {
    cameraX: 24, cameraY: 73, cameraZ: 30, targetX: 0, targetY: 33, targetZ: 0,
    cutaway: 0, ceiling: 0, repair: 0, flow: 0, healthy: 0, air: 0, network: 0,
    district: 1, alarm: 0, composition: 1,
  };
  const projectionVector = new THREE.Vector3();
  let width = 1, height = 1, mobile = false;
  let lastComposition = -1;
  function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    mobile = width <= 760;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5, Math.sqrt(3000000 / Math.max(1, width * height))));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    updateFraming();
    camera.updateProjectionMatrix();
  }
  function updateFraming() {
    const horizontalOffset = mobile ? 0.025 * state.composition : 0.10 + 0.06 * state.composition;
    camera.setViewOffset(width, height, -width * horizontalOffset, mobile ? -height * 0.025 : -height * 0.005, width, height);
    lastComposition = state.composition;
  }
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const faultColor = new THREE.Color(COLORS.fault);
  const healthyColor = new THREE.Color(COLORS.healthy);
  const currentColor = new THREE.Color();
  const dummy = new THREE.Object3D();
  const airDummy = new THREE.Object3D();
  const airUp = new THREE.Vector3(0, 1, 0);
  const airAhead = new THREE.Vector3();
  const airDirection = new THREE.Vector3();
  const airColor = new THREE.Color();
  let paused = reducedMotion, motionReduced = reducedMotion, clock = 0;
  const targetVector = new THREE.Vector3();
  const cameraVector = new THREE.Vector3();
  function project(point) {
    projectionVector.set(...point).project(camera);
    return { x: (projectionVector.x * 0.5 + 0.5) * width, y: (-projectionVector.y * 0.5 + 0.5) * height, visible: projectionVector.z < 1 };
  }
  function getRoomAnnotations() {
    const inspectable = state.cutaway > 0.9 && state.ceiling > 0.9 && camera.position.distanceTo(targetVector) > 4.5;
    return roomAnnotations.map(annotation => {
      const projected = project(annotation.position);
      return {
        ...annotation, x: projected.x, y: projected.y,
        visible: inspectable && projected.visible && projected.x > 20 && projected.x < width - 20 && projected.y > 100 && projected.y < height - 35,
      };
    });
  }
  function getRoomDeviceStatus(id) {
    const annotation = roomAnnotations.find(device => device.id === id);
    if (!annotation) throw new Error(`Unknown room device: ${id}`);
    const electronicDevices = roomAnnotations.filter(device => device.powered);
    const active = electronicDevices.filter(device => device.active).length;
    const cooling = state.healthy === 1 ? 'Recovered' : state.flow > 0.5 ? 'Verifying flow' : 'Interrupted';
    const lights = roomConditions.lightsOn ? 'On' : 'Off';
    const presence = roomConditions.presenceDetected ? 'Detected' : 'Not detected';
    const fields = {
      'room-control': [
        ['Room temperature', `${roomTemperature.toFixed(1)} C`], ['Setpoint', '21.5 C'],
        ['Lights', lights], ['Presence', presence],
        ['Cooling', cooling], ['Fan', state.flow > 0.5 ? 'Auto / running' : 'Standby'],
      ],
      cctv: [
        ['Camera status', 'Monitoring'], ['Coverage', 'Office interior'],
        ['This type', '1 active / 0 inactive'], ['Room presence', presence],
      ],
      presence: [
        ['Presence', presence], ['Sensor status', 'Sensing'],
        ['This type', '1 active / 0 inactive'], ['Linked lights', lights],
      ],
      'fire-extinguisher': [
        ['Readiness', 'Ready (demo)'], ['Units in room', '1 installed'],
        ['Mounting', 'Wall-mounted'], ['Monitoring', 'Passive equipment'],
      ],
    };
    return {
      health: annotation.powered ? 'Healthy' : 'Ready',
      connection: annotation.powered ? 'Online' : 'Passive',
      room: { active, inactive: electronicDevices.length - active, total: electronicDevices.length },
      fields: fields[id],
      temperatureTrend: id === 'room-control' ? Array.from({ length: 12 }, (_, i) => Math.round((26.5 + (roomTemperature - 26.5) * i / 11) * 10) / 10) : null,
      simulated: true,
    };
  }
  function render(delta) {
    const previousClock = clock;
    if (!paused && !motionReduced) clock += THREE.MathUtils.clamp(delta, 0, 0.05);
    const motionDelta = clock - previousClock;
    if (lastComposition !== state.composition) updateFraming();
    targetVector.set(state.targetX, state.targetY, state.targetZ);
    cameraVector.set(state.cameraX, state.cameraY, state.cameraZ);
    if (mobile) {
      const distance = cameraVector.distanceTo(targetVector);
      const roomFraming = smooth(4, 9, distance) * (1 - smooth(20, 45, distance)) * state.cutaway;
      const baseZoom = THREE.MathUtils.lerp(height < 700 ? 1.25 : 1.12, height < 700 ? 1.65 : 1.47, state.cutaway);
      cameraVector.sub(targetVector).multiplyScalar(baseZoom + roomFraming * 0.8).add(targetVector);
    } else {
      const distance = cameraVector.distanceTo(targetVector);
      const roomFraming = smooth(4, 9, distance) * (1 - smooth(20, 45, distance)) * state.cutaway;
      cameraVector.sub(targetVector).multiplyScalar(1 + roomFraming * 0.15).add(targetVector);
    }
    camera.position.copy(cameraVector);
    camera.lookAt(targetVector);
    district.visible = state.district > 0.005;
    districtMaterials.forEach((opacity, material) => {
      material.opacity = opacity * state.district;
      material.depthWrite = material.opacity > 0.98;
    });
    advanceTraffic(vehicles, motionDelta);
    vehicles.forEach(({ car, x, z, center, wait, materials: bodyMaterials, direction }) => {
      const distance = x - riverCenter(-center);
      const bridgeElevation = 1 - THREE.MathUtils.clamp((Math.abs(distance) - 11) / 18, 0, 1);
      car.position.set(x, -0.11 + bridgeElevation * 2.86, z);
      car.rotation.z = Math.abs(distance) > 11 && Math.abs(distance) < 29 ? -Math.sign(distance) * direction * Math.atan2(2.86, 18) : 0;
      car.visible = wait === 0;
      const edgeFade = 1 - smooth(138, 157, Math.abs(x));
      bodyMaterials.forEach(material => {
        material.opacity = state.district * edgeFade;
        material.depthWrite = material.opacity > 0.98;
      });
    });
    boatTravel += motionDelta * 1.65;
    if (boatTravel > 158) boatTravel = -158;
    boat.position.set(boatTravel, Math.sin(clock * 1.4) * 0.025, riverCenter(boatTravel));
    boat.rotation.y = -Math.atan2(riverCenter(boatTravel + 0.1) - riverCenter(boatTravel), 0.1);
    boat.rotation.x = Math.sin(clock * 1.1) * 0.015;
    const boatFade = state.district * (1 - smooth(138, 157, Math.abs(boatTravel)));
    boatMaterials.forEach(material => {
      material.opacity = districtMaterials.get(material) * boatFade;
      material.depthWrite = material.opacity > 0.98;
    });
    turbineRotors.forEach(({ rotor, speed, phase }) => { rotor.rotation.z = phase + clock * speed; });
    for (let f = 0; f < floors.length; f++) {
      const { group, slabMat, facadeMat, mullionMat, acpMat, jointMat } = floors[f];
      const upperFade = f > 10 ? 1 - state.cutaway : 1;
      const networkFade = 1 - state.network * 0.77;
      slabMat.opacity = upperFade * (f === 10 ? 1 : 1 - state.network * 0.22);
      facadeMat.opacity = 0.76 * (f === 10 ? 1 - state.cutaway : upperFade) * networkFade;
      mullionMat.opacity = (f === 10 ? 1 - state.cutaway : upperFade) * (1 - state.network * 0.4);
      acpMat.opacity = (f === 10 ? 1 - state.cutaway : upperFade) * (1 - state.network * 0.75);
      jointMat.opacity = acpMat.opacity;
      acpMat.depthWrite = acpMat.opacity > 0.98;
      jointMat.depthWrite = acpMat.depthWrite;
      slabMat.depthWrite = slabMat.opacity > 0.98;
      facadeMat.depthWrite = facadeMat.opacity > 0.65;
      mullionMat.depthWrite = mullionMat.opacity > 0.98;
      group.visible = upperFade > 0.015;
    }
    roof.visible = state.cutaway < 0.3;
    ceilingMat.opacity = 1 - state.ceiling;
    ceiling.visible = state.cutaway > 0.01 && ceilingMat.opacity > 0.01;
    ceilingGrid.visible = state.ceiling < 0.5;
    currentColor.copy(faultColor).lerp(healthyColor, state.healthy);
    zoneMat.color.copy(currentColor);
    const pulse = paused || motionReduced ? 0.7 : 0.5 + Math.sin(clock * 4.2) * 0.5;
    zoneMat.opacity = state.alarm * (0.07 + pulse * 0.14 * (1 - state.healthy) + 0.05 * state.healthy) * (1 - state.cutaway * 0.65) * (1 - state.air * 0.7);
    zoneEdgeMat.color.copy(currentColor);
    zoneEdgeMat.opacity = state.alarm * (0.35 + 0.35 * (1 - state.cutaway)) * (1 - state.air * 0.5);
    facadeHighlightMat.color.copy(currentColor);
    facadeHighlightMat.opacity = state.alarm * (state.healthy > 0.95 ? 0.48 : 0.22 + pulse * 0.36) * (1 - state.cutaway);
    facadeHighlight.visible = state.alarm > 0 && state.cutaway < 0.99;
    const isolation = smooth(0.03, 0.18, state.repair) * (1 - smooth(0.78, 0.96, state.repair));
    valveHandles.forEach(handle => { handle.rotation.y = isolation * Math.PI / 2; });
    const opened = smooth(0.18, 0.4, state.repair) * (1 - smooth(0.65, 0.82, state.repair));
    sleeve.position.y = serviceY + opened * 0.15;
    sleeve.rotation.z = Math.PI / 2 - opened * 0.2;
    const cleared = smooth(0.36, 0.64, state.repair);
    obstruction.position.y = serviceY + cleared * 0.18;
    obstruction.scale.setScalar(Math.max(0.001, 1 - cleared));
    obstruction.visible = cleared < 0.99;
    repairRing.material.color.copy(currentColor);
    repairRingMat.opacity = state.alarm * state.cutaway * 0.85 * (1 - state.air * 0.85);
    repairRing.quaternion.copy(camera.quaternion);
    pipeMaterials[1].color.set(state.healthy > 0.5 || state.alarm === 0 ? COLORS.supply : COLORS.fault);
    fcuLidMat.opacity = 1 - state.ceiling * 0.93;
    plantShellMat.opacity = 0.86 - state.network * 0.56;
    circuitGuideMaterials.forEach(material => { material.opacity = state.network * 0.7; });
    fans.forEach(fan => { fan.rotation.x = clock * 5 * state.flow; });
    for (const stream of streams) {
      const { curve, particles, count, length, index } = stream;
      const moving = state.flow > 0.5;
      // Before recovery only the upstream feed approaches the obstruction.
      particles.visible = moving || (index <= 1 && isolation < 0.8);
      if (!particles.visible) continue;
      for (let i = 0; i < count; i++) {
        let t = (i / count + clock * 1.4 / length) % 1;
        if (!moving && index === 1) t = Math.min(t, 0.35);
        curve.getPointAt(t, dummy.position);
        dummy.scale.setScalar(index === 3 ? 0.28 : 1);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;
    }
    arrows.forEach(arrow => { arrow.visible = state.flow > 0.5 && state.network > 0.15; });
    const airStrength = state.air * state.cutaway * state.healthy * state.flow;
    const temperature = Math.round((26.5 - 4.5 * state.air * state.healthy) * 10) / 10;
    if (temperature !== roomTemperature) {
      roomTemperature = temperature;
      paintRoomControl(roomTemperature);
    }
    airGroup.visible = airStrength > 0.01;
    airRibbonMaterials.forEach(material => { material.opacity = airStrength * 0.18; });
    airArrowMaterial.opacity = airStrength * 0.8;
    airPaths.forEach(({ path, particles, lengths, length, phase }) => {
      if (!airGroup.visible) return;
      for (let i = 0; i < particles.count; i++) {
        const distance = (i / particles.count * length + clock * 0.72 + phase) % length;
        path.getPoint(distance / length, airDummy.position);
        path.getPoint(((distance + 0.012) % length) / length, airAhead);
        airDirection.subVectors(airAhead, airDummy.position).normalize();
        airDummy.quaternion.setFromUnitVectors(airUp, airDirection);
        airDummy.updateMatrix();
        particles.setMatrixAt(i, airDummy.matrix);
        if (distance < lengths[0]) airColor.copy(coolAirColor);
        else if (distance < lengths[0] + lengths[1]) airColor.copy(returnAirColor);
        else airColor.copy(returnAirColor).lerp(coolAirColor, (distance - lengths[0] - lengths[1]) / lengths[2]);
        particles.setColorAt(i, airColor);
      }
      particles.instanceMatrix.needsUpdate = true;
      particles.instanceColor.needsUpdate = true;
    });
    renderer.render(scene, camera);
  }
  return {
    state, render, project, getRoomAnnotations, getRoomDeviceStatus,
    setPaused(value) { paused = value; },
    setReducedMotion(value) { motionReduced = value; },
    getDiagnostics() {
      const values = Object.fromEntries(Object.entries(state).filter(([key]) => key !== '_gsap'));
      const baseBounds = new THREE.Box3().setFromObject(unitBase);
      const topBounds = new THREE.Box3().setFromObject(unitTop);
      const pipeConnections = curves.map((curve, index) => curve.getPoint(1).distanceTo(curves[(index + 1) % curves.length].getPoint(0)));
      const boatBounds = new THREE.Box3().setFromObject(boat);
      const extinguisherBounds = new THREE.Box3().setFromObject(extinguisher);
      return {
        ...values, obstructionVisible: obstruction.visible, downstreamFlowVisible: streams[3].particles.visible,
        airVisible: airGroup.visible, ceilingVisible: ceiling.visible, paused: paused || motionReduced, drawCalls: renderer.info.render.calls,
        viewOffsetX: camera.view.offsetX / width,
        dimensions: { ...LAYOUT, clearRoomHeight: ceilingY - 0.025 - finishedFloorY, fcuBottom: baseBounds.min.y, fcuTop: topBounds.max.y, diffuserHeight: diffusers[0].position.y },
        pipeConnectionGaps: pipeConnections,
        districtBuildingCount: cityBuildings.length, districtVisible: district.visible,
        turbineAngles: turbineRotors.map(({ rotor }) => rotor.rotation.z),
        vehiclePositions: vehicles.map(({ car }) => car.position.toArray()),
        traffic: vehicles.map(({ kind, length, x, z, speed, wait, trips }) => ({ kind, length, x, z, speed, wait, trips })),
        boat: {
          position: boat.position.toArray(), worldPosition: boat.getWorldPosition(new THREE.Vector3()).toArray(), heading: boat.rotation.y,
          bridgeClearance: Math.min(...bridgeDecks.map(deck => new THREE.Box3().setFromObject(deck).min.y)) - boatBounds.max.y,
        },
        roomDevices: roomDevices.map(device => ({ name: device.name, position: device.position.toArray() })),
        roomAnnotations: getRoomAnnotations(),
        deviceStatus: Object.fromEntries(roomAnnotations.map(device => [device.id, getRoomDeviceStatus(device.id)])),
        fireExtinguisher: { position: extinguisher.position.toArray(), height: extinguisherBounds.max.y - extinguisherBounds.min.y },
        facadeDetails: {
          acpPanels: acpPanelCount, glassRoughness: floors[0].facadeMat.roughness,
          reflectedEnvironment: Boolean(floors[0].facadeMat.envMap), clearcoat: floors[0].facadeMat.clearcoat,
          officePanelOpacity: floors[10].acpMat.opacity, upperPanelOpacity: floors[11].acpMat.opacity,
        },
        roomController: { temperature: roomTemperature, setpoint: 21.5, features: ['HVAC +/-', 'Light toggle', 'Sound +/-', 'Fan +/-'], simulated: true },
        officeWallFinish: featureWall.name,
        officeWallTextured: Boolean(silverStone.map && silverStone.bumpMap),
        alarmVisible: state.alarm > 0.05,
        alarmHighlightOpacity: facadeHighlightMat.opacity,
        highlightColor: `#${facadeHighlightMat.color.getHexString()}`,
        airflow: {
          connectionGaps: airPaths.flatMap(({ sections }) => sections.map((section, i) => section.getPoint(1).distanceTo(sections[(i + 1) % sections.length].getPoint(0)))),
          tangentDots: airPaths.flatMap(({ sections }) => sections.map((section, i) => section.getTangent(1).dot(sections[(i + 1) % sections.length].getTangent(0)))),
          coilPasses: airPaths.map(({ sections }) => [sections[2].getPoint(0).toArray(), sections[2].getPoint(1).toArray()]),
          grillePasses: airPaths.map(({ sections }) => [sections[0].curves[0].getPoint(1).toArray(), sections[1].curves[0].getPoint(1).toArray()]),
          grilles: diffusers.map(diffuser => {
            const bounds = new THREE.Box3().setFromObject(diffuser);
            return { min: bounds.min.toArray(), max: bounds.max.toArray() };
          }),
          arrowPositions: airPaths.map(({ particles }) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(particles.instanceMatrix.array)).toArray()),
          returnColor: `#${returnAirColor.getHexString()}`, supplyColor: `#${coolAirColor.getHexString()}`,
        },
      };
    },
    dispose() {
      resizeObserver.disconnect();
      const geometries = new Set(), materialSet = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materialSet.add(material));
      });
      floors.forEach(({ facadeMat, acpMat, jointMat }) => [facadeMat, acpMat, jointMat].forEach(material => materialSet.add(material)));
      geometries.forEach(geometry => geometry.dispose());
      materialSet.forEach(material => material.dispose());
      walnutTexture.dispose();
      stoneTexture.dispose();
      deviceTextures.forEach(texture => texture.dispose());
      environment.dispose();
      facadeEnvironment.dispose();
      renderer.dispose();
    },
  };
}
