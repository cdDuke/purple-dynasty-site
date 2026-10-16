/**
 * Материалы 3D-логотипа: хром снаружи и «рентген» внутри линзы сканера.
 * Линза задаётся в пикселях буфера (gl_FragCoord): uLens = (x, y, радиус, мягкость края).
 */
import * as THREE from 'three';

const STUDIO_BLUR = 0.02;
const HORIZON_POWER = 1.7;
const HORIZON_STOPS = Object.freeze([
  [0, '#ffffff'],
  [0.3, '#d7d9e1'],
  [0.47, '#3a3448'],
  [0.495, '#ffffff'],
  [0.515, '#a47bff'],
  [0.56, '#160f22'],
  [1, '#050409'],
]);

// Студия для отражений: «горизонт» перед логотипом, софтбокс сверху, фиолетовые полосы по бокам.
const STUDIO_PANELS = Object.freeze([
  { color: 0xffffff, power: 5, position: [0, 6, 3], scale: [12, 2.6] },
  { color: 0x8b5cf6, power: 9, position: [-7, 0.5, 1.5], scale: [1.6, 11] },
  { color: 0xc9b6ff, power: 4, position: [7, 1.5, -1], scale: [1.2, 9] },
  { color: 0x5b21b6, power: 5, position: [0, -6, 1], scale: [12, 2] },
  { color: 0xffffff, power: 3, position: [-3.5, 3, -7], scale: [1, 6] },
]);

/**
 * Вертикальный градиент «небо — яркий горизонт — тёмная земля»: классическое отражение хрома.
 * @returns {THREE.CanvasTexture}
 */
function createHorizonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  HORIZON_STOPS.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const XRAY_VERTEX = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const XRAY_FRAGMENT = /* glsl */ `
  uniform vec4 uLens;
  uniform vec3 uInk;
  uniform float uBase;
  uniform float uEdge;
  uniform float uTime;
  uniform float uReveal;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float dist = distance(gl_FragCoord.xy, uLens.xy);
    float inside = 1.0 - smoothstep(uLens.z - uLens.w, uLens.z, dist);
    if (inside <= 0.0) discard;

    // Чем более косо луч проходит сквозь поверхность, тем она «плотнее» — как на настоящем рентгене.
    float facing = abs(dot(normalize(vNormalView), normalize(vViewPosition)));
    float density = uBase + uEdge * pow(1.0 - facing, 1.6);
    float grain = (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.07;
    float scanline = 0.03 * sin(gl_FragCoord.y * 1.6);
    float alpha = clamp(density + grain + scanline, 0.0, 0.95) * inside * uReveal;
    gl_FragColor = vec4(uInk, alpha);
  }
`;

/**
 * @param {number} hex
 * @returns {THREE.Vector3} цвет «как есть», без перевода в линейное пространство
 */
function rawColor(hex) {
  return new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}

/**
 * Карта окружения для хрома: строим маленькую «фотостудию» и запекаем её в PMREM.
 * @param {THREE.WebGLRenderer} renderer
 * @returns {THREE.Texture}
 */
export function createStudioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x07050c);
  const plane = new THREE.PlaneGeometry(1, 1);

  for (const panel of STUDIO_PANELS) {
    const color = new THREE.Color(panel.color).multiplyScalar(panel.power);
    const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mesh.position.set(...panel.position);
    mesh.scale.set(panel.scale[0], panel.scale[1], 1);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
  }

  const horizonTexture = createHorizonTexture();
  const horizon = new THREE.Mesh(
    plane,
    new THREE.MeshBasicMaterial({ map: horizonTexture, color: new THREE.Color().setScalar(HORIZON_POWER), side: THREE.DoubleSide }),
  );
  horizon.position.set(0, 0, 9);
  horizon.scale.set(26, 16, 1);
  horizon.lookAt(0, 0, 0);
  studio.add(horizon);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(studio, STUDIO_BLUR);
  pmrem.dispose();
  studio.traverse((object) => object.material?.dispose());
  horizonTexture.dispose();
  plane.dispose();
  return target.texture;
}

/**
 * Хром, который вырезается внутри линзы — там видно рентген.
 * @param {{lens: {value: THREE.Vector4}, color: number, roughness: number, clearcoat?: number}} options
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createChromeMaterial({ lens, color, roughness, clearcoat = 0.7 }) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 1,
    roughness,
    clearcoat,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.25,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLens = lens;
    shader.fragmentShader = `uniform vec4 uLens;\n${shader.fragmentShader}`.replace(
      'void main() {',
      'void main() {\n  if (distance(gl_FragCoord.xy, uLens.xy) < uLens.z) discard;',
    );
  };
  return material;
}

/**
 * Полупрозрачный «рентгеновский» материал, видимый только внутри линзы.
 * @param {{lens: {value: THREE.Vector4}, time: {value: number}, reveal: {value: number},
 *   ink: number, base: number, edge: number}} options
 * @returns {THREE.ShaderMaterial}
 */
export function createXrayMaterial({ lens, time, reveal, ink, base, edge }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLens: lens,
      uTime: time,
      uReveal: reveal,
      uInk: { value: rawColor(ink) },
      uBase: { value: base },
      uEdge: { value: edge },
    },
    vertexShader: XRAY_VERTEX,
    fragmentShader: XRAY_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Набор рентген-материалов разной «плотности»: бумага, корпус, металл.
 * @param {{lens: {value: THREE.Vector4}, time: {value: number}, reveal: {value: number}}} uniforms
 */
export function createXrayPalette(uniforms) {
  const ink = 0x160d27;
  return Object.freeze({
    shell: createXrayMaterial({ ...uniforms, ink: 0x2b1f45, base: 0.03, edge: 0.42 }),
    paper: createXrayMaterial({ ...uniforms, ink, base: 0.1, edge: 0.3 }),
    body: createXrayMaterial({ ...uniforms, ink, base: 0.17, edge: 0.5 }),
    dense: createXrayMaterial({ ...uniforms, ink: 0x0b0614, base: 0.42, edge: 0.4 }),
  });
}
