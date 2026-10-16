/**
 * 3D-сцена логотипа PD: хромовые буквы Anton, внутри — контрабанда, видимая только в линзе.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { boundsOfPoints } from '../utils.js';
import { PD_GLYPHS } from './glyphs.js';
import { createChromeMaterial, createStudioEnvironment, createXrayPalette } from './materials.js';
import { buildContraband } from './contraband.js';

const LOGO_WORLD_HEIGHT = 3;
const EXTRUDE_DEPTH = 380;
const FOV_DEGREES = 28;
const OFFSCREEN = -99_999;

/**
 * @typedef {{centerY: number, heightFrac: number, widthFrac: number}} LogoLayout
 * доля высоты холста для центра логотипа и максимальные доли высоты/ширины под логотип
 */

function createLetterGeometry(lowPower) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${PD_GLYPHS.p}"/><path d="${PD_GLYPHS.d}"/></svg>`;
  const shapes = new SVGLoader().parse(svg).paths.flatMap((path) => SVGLoader.createShapes(path));
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: EXTRUDE_DEPTH,
    bevelEnabled: true,
    bevelThickness: 34,
    bevelSize: 20,
    bevelSegments: lowPower ? 3 : 6,
    curveSegments: lowPower ? 8 : 16,
  });
  geometry.translate(0, 0, -EXTRUDE_DEPTH / 2);
  geometry.computeBoundingBox();
  return geometry;
}

function addLights(scene) {
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 4, 6);
  const rim = new THREE.DirectionalLight(0x9a6bff, 4);
  rim.position.set(-5, 1.5, -3);
  const under = new THREE.DirectionalLight(0xc9b6ff, 1.2);
  under.position.set(1, -5, 2);
  scene.add(key, rim, under);
}

function boxCorners(box) {
  const { min, max } = box;
  return [
    [min.x, min.y, min.z], [max.x, min.y, min.z], [min.x, max.y, min.z], [max.x, max.y, min.z],
    [min.x, min.y, max.z], [max.x, min.y, max.z], [min.x, max.y, max.z], [max.x, max.y, max.z],
  ];
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{lowPower: boolean}} options
 */
export function createLogoScene(canvas, { lowPower }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: lowPower ? 'low-power' : 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = createStudioEnvironment(renderer);
  addLights(scene);
  const camera = new THREE.PerspectiveCamera(FOV_DEGREES, 1, 0.1, 100);

  const uniforms = {
    lens: { value: new THREE.Vector4(OFFSCREEN, OFFSCREEN, 0, 1) },
    time: { value: 0 },
    reveal: { value: 0 },
  };
  const xray = createXrayPalette(uniforms);
  const caps = createChromeMaterial({ lens: uniforms.lens, color: 0xeef0f5, roughness: 0.07 });
  const sides = createChromeMaterial({ lens: uniforms.lens, color: 0xb09ef0, roughness: 0.18, clearcoat: 1 });

  const unitScale = LOGO_WORLD_HEIGHT / PD_GLYPHS.height;
  const logoWidth = PD_GLYPHS.width * unitScale;
  const pivot = new THREE.Group();
  const logoSpace = new THREE.Group();
  // Координаты шрифта: Y вниз — переворачиваем и центрируем.
  logoSpace.scale.set(unitScale, -unitScale, unitScale);
  logoSpace.position.set(-logoWidth / 2, LOGO_WORLD_HEIGHT / 2, 0);
  pivot.add(logoSpace);
  scene.add(pivot);

  const letters = createLetterGeometry(lowPower);
  logoSpace.add(new THREE.Mesh(letters, [caps, sides]));
  const shell = new THREE.Mesh(letters, xray.shell);
  shell.renderOrder = 1;
  logoSpace.add(shell);

  const { group: contraband, items } = buildContraband(xray);
  contraband.traverse((object) => {
    if (object.isMesh) object.renderOrder = 2;
  });
  logoSpace.add(contraband);

  const view = { width: 1, height: 1, dpr: 1, baseY: 0 };
  const scratch = new THREE.Vector3();

  function toScreen(vector) {
    vector.project(camera);
    return { x: ((vector.x + 1) / 2) * view.width, y: ((1 - vector.y) / 2) * view.height };
  }

  function projectCorners(box, matrix) {
    return boxCorners(box).map(([x, y, z]) => toScreen(scratch.set(x, y, z).applyMatrix4(matrix)));
  }

  return Object.freeze({
    items,

    /**
     * @param {number} width CSS-пиксели
     * @param {number} height
     * @param {number} dpr
     * @param {LogoLayout} layout
     */
    resize(width, height, dpr, layout) {
      view.width = width;
      view.height = height;
      view.dpr = dpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const tan = Math.tan(THREE.MathUtils.degToRad(FOV_DEGREES / 2));
      const visibleHeight = Math.max(
        LOGO_WORLD_HEIGHT / layout.heightFrac,
        logoWidth / layout.widthFrac / camera.aspect,
      );
      camera.position.set(0, 0, visibleHeight / (2 * tan));
      camera.updateProjectionMatrix();
      view.baseY = (0.5 - layout.centerY) * visibleHeight;
    },

    /** @param {{rx: number, ry: number, scale: number, floatY: number, envAngle: number, time: number}} pose */
    setPose({ rx, ry, scale, floatY, envAngle, time }) {
      pivot.rotation.set(rx, ry, 0);
      pivot.scale.setScalar(scale);
      pivot.position.y = view.baseY + floatY;
      scene.environmentRotation.set(0, envAngle, 0);
      uniforms.time.value = time;
      scene.updateMatrixWorld();
    },

    /** @param {{x: number, y: number, radius: number, feather: number, reveal: number}} lens CSS-пиксели */
    setLens({ x, y, radius, feather, reveal }) {
      const { dpr, height } = view;
      uniforms.lens.value.set(x * dpr, (height - y) * dpr, radius * dpr, feather * dpr);
      uniforms.reveal.value = reveal;
      // Линза закрыта — рентген-слои всё равно бы всё отбросили, не тратим на них отрисовку.
      shell.visible = radius > 0;
      contraband.visible = radius > 0;
    },

    /** @returns {{x: number, y: number, w: number, h: number}} рамка логотипа на экране */
    logoRect() {
      return boundsOfPoints(projectCorners(letters.boundingBox, logoSpace.matrixWorld));
    },

    /** @param {number} index */
    itemRect(index) {
      const item = items[index];
      return boundsOfPoints(projectCorners(item.box, item.object.matrixWorld));
    },

    /** Точка в координатах шрифта → экран. */
    logoPoint(x, y) {
      return toScreen(scratch.set(x, y, 0).applyMatrix4(logoSpace.matrixWorld));
    },

    render() {
      renderer.render(scene, camera);
    },
  });
}
