/**
 * Кирпичики для моделей «контрабанды»: контуры, выдавливание, цилиндры, пружины, патроны.
 * Все размеры — в миллиметрах, ось Y вверх.
 */
import * as THREE from 'three';

const CURVE_SEGMENTS = 8;
const HELIX_SEGMENTS_PER_TURN = 10;

/**
 * @param {ReadonlyArray<readonly [number, number]>} points
 * @returns {THREE.Shape}
 */
export function polygon(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  return shape;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 * @param {THREE.Path} [target] куда рисовать (по умолчанию — новый Shape)
 * @returns {THREE.Shape | THREE.Path}
 */
export function roundedRect(x, y, w, h, r, target = new THREE.Shape()) {
  target.moveTo(x + r, y);
  target.lineTo(x + w - r, y);
  target.quadraticCurveTo(x + w, y, x + w, y + r);
  target.lineTo(x + w, y + h - r);
  target.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  target.lineTo(x + r, y + h);
  target.quadraticCurveTo(x, y + h, x, y + h - r);
  target.lineTo(x, y + r);
  target.quadraticCurveTo(x, y, x + r, y);
  return target;
}

/**
 * Рамка со сквозной дырой (спусковая скоба, окно затвора и т. п.).
 * @param {[number, number, number, number, number]} outer x, y, w, h, r
 * @param {[number, number, number, number, number]} inner x, y, w, h, r
 * @returns {THREE.Shape}
 */
export function frame(outer, inner) {
  const shape = roundedRect(...outer);
  shape.holes.push(roundedRect(...inner, new THREE.Path()));
  return shape;
}

/**
 * Выдавливает контур на depth и центрирует по толщине.
 * @param {THREE.Shape} shape
 * @param {number} depth
 * @param {number} [bevel]
 * @returns {THREE.ExtrudeGeometry}
 */
export function extrude(shape, depth, bevel = 1.5) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: CURVE_SEGMENTS,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {{x?: number, y?: number, z?: number, rx?: number, ry?: number, rz?: number,
 *   sx?: number, sy?: number, sz?: number}} [at]
 * @returns {THREE.Mesh}
 */
export function part(geometry, material, at = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
  mesh.rotation.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
  mesh.scale.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
  return mesh;
}

/**
 * Цилиндр вдоль оси X с центром в (x, y).
 * @param {number} radius
 * @param {number} length
 * @param {THREE.Material} material
 * @param {{x?: number, y?: number, z?: number}} [at]
 * @returns {THREE.Mesh}
 */
export function cylinderX(radius, length, material, at = {}) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 14, 1);
  return part(geometry, material, { ...at, rz: Math.PI / 2 });
}

class HelixCurve extends THREE.Curve {
  /**
   * @param {number} length
   * @param {number} radius
   * @param {number} turns
   */
  constructor(length, radius, turns) {
    super();
    this.length = length;
    this.radius = radius;
    this.turns = turns;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2;
    return target.set(t * this.length, Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
  }
}

/**
 * Пружина вдоль оси X, начинается в (x, y).
 * @param {{length: number, radius: number, turns: number, wire: number}} spec
 * @param {THREE.Material} material
 * @param {{x?: number, y?: number, z?: number}} [at]
 * @returns {THREE.Mesh}
 */
export function spring({ length, radius, turns, wire }, material, at = {}) {
  const curve = new HelixCurve(length, radius, turns);
  const geometry = new THREE.TubeGeometry(curve, Math.ceil(turns * HELIX_SEGMENTS_PER_TURN), wire, 5, false);
  return part(geometry, material, at);
}

// Профили патронов для LatheGeometry: [радиус, высота], пуля смотрит вверх по оси Y.
const RIFLE_ROUND_PROFILE = [
  [0, 0], [5.6, 0], [5.6, 30], [4.2, 35], [3.9, 39], [3.9, 45], [2.6, 52], [0, 57],
];
const PISTOL_ROUND_PROFILE = [
  [0, 0], [4.9, 0], [4.9, 18.5], [4.5, 19], [4.5, 23], [3.2, 27.5], [0, 29.5],
];

/**
 * @param {ReadonlyArray<readonly [number, number]>} profile
 * @returns {THREE.LatheGeometry}
 */
function roundGeometry(profile) {
  const height = profile.at(-1)[1];
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y - height / 2));
  return new THREE.LatheGeometry(points, 12);
}

/** @returns {THREE.LatheGeometry} патрон 7.62×39, центр в середине, носик вдоль +Y */
export function rifleRound() {
  return roundGeometry(RIFLE_ROUND_PROFILE);
}

/** @returns {THREE.LatheGeometry} патрон 9×19, центр в середине, носик вдоль +Y */
export function pistolRound() {
  return roundGeometry(PISTOL_ROUND_PROFILE);
}
