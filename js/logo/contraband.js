/**
 * «Контрабанда» внутри логотипа: пачки денег, Glock, AK-47, бронежилет, боекомплект и бургер-пасхалка.
 * Модели собираются в миллиметрах, а раскладываются в координатах шрифта (как контуры букв P и D).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cylinderX, extrude, frame, part, pistolRound, polygon, rifleRound, roundedRect, spring } from './parts.js';

export const SCAN_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'cash', label: 'Наличные', detail: '$ 750 000' }),
  Object.freeze({ id: 'glock', label: 'Glock 17', detail: '9×19 мм' }),
  Object.freeze({ id: 'ak', label: 'AK-47', detail: '7.62×39 мм' }),
  Object.freeze({ id: 'vest', label: 'Бронежилет', detail: 'класс IIIA' }),
  Object.freeze({ id: 'ammo', label: 'Боекомплект', detail: '2 магазина + граната' }),
  Object.freeze({ id: 'burger', label: '№9 Large', detail: 'заказ Биг Смоука', secret: true }),
]);

// Маршрут автоматического сканирования (координаты шрифта, Y вниз).
export const DEMO_PATH = Object.freeze([
  [173, 260], [173, 1180], [705, 470], [925, 640], [925, 1060], [1539, 830], [1027, 1500],
]);

const HALF_PI = Math.PI / 2;
const AK_MAG_TOP = new THREE.Vector2(1, -26);
const AK_MAG_CONTROL = new THREE.Vector2(25, -155);
const AK_MAG_BOTTOM = new THREE.Vector2(76, -252);
const AK_MAG_ROUNDS = 9;
const AK_MAG_CENTER = Object.freeze({ x: 36, y: -146 });
const GLOCK_ROUNDS = 7;

function akMagazineShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-32, -26);
  shape.lineTo(34, -26);
  shape.quadraticCurveTo(52, -150, 104, -238);
  shape.lineTo(48, -266);
  shape.quadraticCurveTo(-2, -160, -32, -26);
  return shape;
}

function akMagazine(m, kit) {
  const group = new THREE.Group();
  group.add(part(kit.akMagBody, m.body));
  const curve = new THREE.QuadraticBezierCurve(AK_MAG_TOP, AK_MAG_CONTROL, AK_MAG_BOTTOM);

  for (let i = 0; i < AK_MAG_ROUNDS; i += 1) {
    const t = 0.1 + (i / (AK_MAG_ROUNDS - 1)) * 0.78;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const stagger = i % 2 === 0 ? 4 : -4;
    // Патрон лежит поперёк магазина пулей вперёд — к дулу.
    group.add(part(kit.rifleRound, m.dense, {
      x: point.x + tangent.x * stagger,
      y: point.y + tangent.y * stagger,
      rz: Math.atan2(tangent.x, -tangent.y) - HALF_PI,
    }));
  }
  return group;
}

function createAk(m, kit) {
  const group = new THREE.Group();
  const add = (mesh) => group.add(mesh);

  add(part(extrude(polygon([[-446, 22], [-215, 30], [-205, 8], [-212, -18], [-446, -76]]), 36, 3), m.body));
  add(part(extrude(roundedRect(-215, -28, 292, 64, 8), 42, 2), m.body));
  add(part(extrude(polygon([[70, 36], [118, 34], [118, 46], [76, 46]]), 26, 1), m.body));
  add(part(extrude(polygon([[77, -24], [250, -20], [256, 8], [77, 12]]), 46, 3), m.body));
  add(part(extrude(roundedRect(80, 14, 196, 22, 8), 34, 2), m.body));
  add(part(extrude(polygon([[-122, -26], [-80, -26], [-90, -126], [-128, -134], [-140, -122]]), 30, 3), m.body));
  add(part(extrude(frame([-80, -64, 76, 42, 14], [-73, -57, 62, 30, 10]), 10, 1), m.dense));
  add(part(extrude(polygon([[-52, -26], [-44, -26], [-48, -50], [-56, -52]]), 8, 0), m.dense));
  add(part(extrude(polygon([[352, -8], [388, -8], [384, 56], [366, 56], [360, 22]]), 18, 1), m.dense));
  // Ствол, патронник, дульный тормоз и шомпол.
  add(cylinderX(8, 370, m.dense, { x: 262 }));
  add(cylinderX(10, 80, m.dense, { x: 40 }));
  add(cylinderX(11, 30, m.dense, { x: 446 }));
  add(cylinderX(2.6, 320, m.dense, { x: 262, y: -15 }));
  // Затворная рама и возвратная пружина — видно только на рентгене.
  add(part(extrude(roundedRect(-150, 4, 190, 22, 4), 22, 0), m.dense));
  add(spring({ length: 170, radius: 6, turns: 14, wire: 1.3 }, m.dense, { x: -205, y: 26 }));
  group.add(akMagazine(m, kit));
  return group;
}

function createGlock(m, kit) {
  const group = new THREE.Group();
  const add = (mesh) => group.add(mesh);

  add(part(extrude(frame([-93, 22, 186, 34, 5], [-8, 42, 44, 10, 2]), 25, 1.5), m.body));
  add(part(extrude(polygon([[-82, 22], [80, 22], [80, 8], [34, 6], [14, -2], [-44, -2], [-82, 6]]), 22, 1.5), m.body));
  add(part(extrude(polygon([[-86, 14], [-44, 14], [-58, -66], [-62, -92], [-106, -94], [-102, -66]]), 28, 3), m.body));
  add(part(extrude(frame([-46, -30, 46, 30, 10], [-40, -24, 34, 20, 7]), 9, 1), m.dense));
  add(part(extrude(polygon([[-26, -2], [-20, -2], [-24, -20], [-30, -22]]), 6, 0), m.dense));
  add(part(extrude(roundedRect(74, 56, 8, 6, 1), 6, 0), m.dense));
  add(part(extrude(roundedRect(-88, 56, 10, 6, 1), 10, 0), m.dense));
  add(cylinderX(7, 118, m.dense, { x: 30, y: 40 }));
  add(spring({ length: 96, radius: 4.5, turns: 11, wire: 1 }, m.dense, { x: -12, y: 29 }));
  add(part(extrude(polygon([[-82, 8], [-52, 8], [-64, -86], [-96, -88]]), 18, 0), m.body));

  for (let i = 0; i < GLOCK_ROUNDS; i += 1) {
    const t = i / (GLOCK_ROUNDS - 1);
    add(part(kit.pistolRound, m.dense, { x: -66 - t * 14, y: 0 - t * 76, z: i % 2 ? 3 : -3, rz: -HALF_PI }));
  }
  return group;
}

function createCashBundle(m, kit) {
  const group = new THREE.Group();
  group.add(part(kit.cashBlock, m.paper));
  group.add(part(kit.cashBand, m.body));
  return group;
}

function vestShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-150, 160);
  shape.lineTo(-120, 230);
  shape.lineTo(-70, 230);
  shape.quadraticCurveTo(-55, 140, 0, 130);
  shape.quadraticCurveTo(55, 140, 70, 230);
  shape.lineTo(120, 230);
  shape.lineTo(150, 160);
  shape.quadraticCurveTo(128, 70, 150, 20);
  shape.lineTo(150, -210);
  shape.quadraticCurveTo(150, -225, 135, -225);
  shape.lineTo(-135, -225);
  shape.quadraticCurveTo(-150, -225, -150, -210);
  shape.lineTo(-150, 20);
  shape.quadraticCurveTo(-128, 70, -150, 160);
  return shape;
}

function createVest(m) {
  const group = new THREE.Group();
  group.add(part(extrude(vestShape(), 34, 4), m.body));
  group.add(part(extrude(roundedRect(-100, -150, 200, 250, 26), 12, 2), m.dense));
  [-205, -180, -155, -130].forEach((y) => {
    group.add(part(extrude(roundedRect(-122, y, 244, 13, 3), 4, 0), m.body, { z: 22 }));
  });
  [-1, 1].forEach((side) => {
    group.add(part(extrude(roundedRect(-12, -14, 24, 28, 4), 10, 0), m.dense, { x: side * 138, y: -60 }));
    group.add(part(extrude(roundedRect(-14, -9, 28, 18, 3), 8, 0), m.dense, { x: side * 95, y: 214 }));
  });
  return group;
}

function createGrenade(m) {
  const group = new THREE.Group();
  group.add(part(new THREE.SphereGeometry(30, 18, 12), m.body, { sy: 1.25 }));
  group.add(part(new THREE.SphereGeometry(15, 12, 8), m.dense, { sy: 1.3 }));
  group.add(part(new THREE.CylinderGeometry(8, 9, 24, 12), m.dense, { y: 46 }));
  group.add(part(extrude(polygon([[4, 50], [13, 54], [39, 12], [37, -14], [30, -14], [32, 10]]), 10, 0), m.dense));
  group.add(part(new THREE.TorusGeometry(10, 1.7, 6, 20), m.dense, { x: -13, y: 56, ry: 0.6 }));
  return group;
}

function createBurger(m) {
  const group = new THREE.Group();
  const bun = new THREE.SphereGeometry(56, 22, 10, 0, Math.PI * 2, 0, HALF_PI);
  group.add(part(bun, m.paper, { y: 14, sy: 0.62 }));
  group.add(part(new THREE.BoxGeometry(114, 4, 114), m.body, { y: 9, ry: Math.PI / 4 }));
  group.add(part(new THREE.CylinderGeometry(57, 57, 16, 24), m.body, { y: 0 }));
  group.add(part(new THREE.CylinderGeometry(59, 59, 3, 24), m.paper, { y: -10 }));
  group.add(part(new THREE.CylinderGeometry(54, 50, 18, 24), m.paper, { y: -20 }));
  // Кунжут тоже «просвечивается» — мелочь, а приятно.
  [[-28, 40], [-8, 46], [14, 44], [32, 36], [0, 34], [-40, 28]].forEach(([x, y], i) => {
    group.add(part(new THREE.SphereGeometry(2.6, 6, 4), m.dense, { x, y, z: i % 2 ? 20 : -14, sx: 1.6 }));
  });
  return group;
}

function createSpareMagazine(m, kit) {
  const holder = new THREE.Group();
  const magazine = akMagazine(m, kit);
  magazine.position.set(-AK_MAG_CENTER.x, -AK_MAG_CENTER.y, 0);
  holder.add(magazine);
  return holder;
}

function createLooseRound(m, kit) {
  const group = new THREE.Group();
  group.add(part(kit.pistolRound, m.dense));
  return group;
}

// Раскладка: x, y — координаты шрифта (Y вниз), rot — поворот против часовой, scale — мм → единицы шрифта.
const CASH_STACK = [
  [120, 0.06, -60], [290, -0.04, 40], [460, 0.03, -20], [630, -0.07, 70], [800, 0.02, -50],
  [970, 0.05, 20], [1140, -0.03, -70], [1310, 0.04, 50], [1480, -0.06, -30], [1650, 0.02, 60],
].map(([y, rot, z]) => ({ build: 'cash', category: 'cash', x: 173, y, z, rot, scale: 1.75 }));

const LOOSE_ROUNDS = [
  [420, 150, 0.4], [505, 215, -1.1], [615, 135, 1.9], [700, 225, 0.2], [575, 262, 2.6],
].map(([x, y, rot], i) => ({ build: 'round', category: null, x, y, z: i * 18 - 36, rot, scale: 1.75 }));

const LAYOUT = Object.freeze([
  ...CASH_STACK,
  { build: 'cash', category: 'cash', x: 540, y: 905, z: 0, rot: -0.25, scale: 1.6 },
  ...LOOSE_ROUNDS,
  { build: 'glock', category: 'glock', x: 705, y: 480, z: 0, rot: -HALF_PI + 0.08, scale: 1.75 },
  { build: 'ak', category: 'ak', x: 925, y: 800, z: 0, rot: HALF_PI + 0.03, scale: 1 },
  { build: 'mag', category: 'ammo', x: 1027, y: 185, z: 30, rot: HALF_PI + 0.15, scale: 1.1 },
  { build: 'mag', category: 'ammo', x: 1400, y: 165, z: -30, rot: HALF_PI - 0.2, scale: 1.05 },
  { build: 'grenade', category: 'ammo', x: 1400, y: 1600, z: 0, rot: 1.3, scale: 1.5 },
  { build: 'vest', category: 'vest', x: 1539, y: 830, z: 0, rot: 0.03, scale: 1 },
  { build: 'burger', category: 'burger', x: 1027, y: 1500, z: 0, rot: 0.08, scale: 2.3 },
]);

const BUILDERS = Object.freeze({
  cash: createCashBundle,
  round: createLooseRound,
  glock: createGlock,
  ak: createAk,
  mag: createSpareMagazine,
  grenade: createGrenade,
  vest: createVest,
  burger: createBurger,
});

function createKit() {
  return {
    rifleRound: rifleRound(),
    pistolRound: pistolRound(),
    akMagBody: extrude(akMagazineShape(), 30, 2),
    cashBlock: new RoundedBoxGeometry(156, 66, 18, 2, 2),
    cashBand: new THREE.BoxGeometry(30, 67.5, 19.4),
  };
}

/**
 * @typedef {{category: string | null, object: THREE.Object3D, box: THREE.Box3}} ScanItem
 */

/**
 * Собирает всю контрабанду в координатах шрифта.
 * @param {{paper: THREE.Material, body: THREE.Material, dense: THREE.Material}} materials
 * @returns {{group: THREE.Group, items: ReadonlyArray<ScanItem>}}
 */
export function buildContraband(materials) {
  const kit = createKit();
  const group = new THREE.Group();

  const items = LAYOUT.map((spec) => {
    const object = BUILDERS[spec.build](materials, kit);
    // Рамку считаем до поворота — это рамка в собственных координатах предмета.
    const box = new THREE.Box3().setFromObject(object);
    object.rotation.z = spec.rot;
    object.scale.setScalar(spec.scale);

    // В пространстве логотипа ось Y смотрит вниз — разворачиваем её обратно для модели.
    const holder = new THREE.Group();
    holder.position.set(spec.x, spec.y, spec.z);
    holder.scale.set(1, -1, 1);
    holder.add(object);
    group.add(holder);
    return Object.freeze({ category: spec.category, object, box });
  });

  return { group, items: Object.freeze(items) };
}
