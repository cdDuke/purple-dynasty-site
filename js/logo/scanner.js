/**
 * Сканер-интроскоп: вращение 3D-логотипа за курсором и линза, через которую видно содержимое.
 * Мышь — линза следует за курсором; палец — линза там, где коснулись; без действий — автоскан.
 */
import { createLogoScene } from './scene.js';
import { createScanHud } from './hud.js';
import { DEMO_PATH } from './contraband.js';
import { clamp, damp, lerp } from '../utils.js';

const INTRO_SECONDS = 2.1;
const INTRO_TURN = -1.25;
const INTRO_SCALE = 0.78;
const INTRO_ENV_TURN = -1.8;
const DEMO_DELAY_SECONDS = 0.6;
const DEMO_SECONDS_PER_STOP = 1.2;
const DEMO_REPEAT_MS = 16_000;
const DEMO_LENS_SHARE = 0.85;
const TOUCH_HOLD_MS = 1_800;
const LENS_FEATHER = 1.5;
const LENS_MIN = 86;
const LENS_MAX = 168;
const LENS_VIEWPORT_SHARE = 0.15;
const LENS_REVEAL_RADIUS = 30;
const HOVER_PADDING = 36;
const RING_BASE_RADIUS = 100;
const READOUT_EVERY_FRAMES = 4;
const TILT_Y = 0.38;
const TILT_X = 0.22;
const SPIN_TURNS = 2;
const MAX_DPR = 2;
const MAX_DPR_LOW_POWER = 1.5;
const DESKTOP_MIN_WIDTH = 900;
const MAX_FRAME_SECONDS = 0.05;
const SAFE_WIDTH_SHARE = 0.94;

const DESKTOP_LAYOUT = Object.freeze({ centerY: 0.43, heightFrac: 0.6, widthFrac: 0.46 });
const MOBILE_LAYOUT = Object.freeze({ centerY: 0.5, heightFrac: 0.62, widthFrac: 0.78 });

const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const smoothstep = (t) => t * t * (3 - 2 * t);
const pad4 = (value) => String(Math.max(0, Math.round(value))).padStart(4, '0');

function isInside(rect, point, padding) {
  return Boolean(rect)
    && point.x >= rect.x - padding && point.x <= rect.x + rect.w + padding
    && point.y >= rect.y - padding && point.y <= rect.y + rect.h + padding;
}

/**
 * @param {HTMLElement} root
 * @param {{reducedMotion: boolean, onFound?: Function, onAllFound?: Function,
 *   getSafeWidth?: () => number | null}} options getSafeWidth — свободная ширина под логотип (между колонками текста)
 */
export function initScanner(root, { reducedMotion, onFound, onAllFound, getSafeWidth }) {
  const canvas = root.querySelector('[data-scan-canvas]');
  const plate = root.querySelector('[data-scan-plate]');
  const ring = root.querySelector('[data-scan-ring]');
  const readout = root.querySelector('[data-scan-readout]');
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const lowPower = isTouch || (navigator.hardwareConcurrency ?? 8) <= 4;

  const scene = createLogoScene(canvas, { lowPower });
  const hud = createScanHud(root, scene, { onFound, onAllFound });

  const view = { width: 1, height: 1 };
  const pointer = { x: 0, y: 0, nx: 0, ny: 0, present: false };
  const touch = { x: 0, y: 0, until: 0 };
  const lens = { x: 0, y: 0, r: 0, byUser: false };
  const pose = { rx: 0, ry: 0, spin: 0, spinTarget: 0 };
  const demo = { active: false, t: 0, nextAt: 0 };
  const flags = { started: false, visible: true, running: false, interacted: false, scanning: false };
  let introTime = reducedMotion ? INTRO_SECONDS : 0;
  let time = 0;
  let lastMs = 0;
  let frameCount = 0;
  let rafId = 0;

  const lensRadius = () => clamp(Math.min(view.width, view.height) * LENS_VIEWPORT_SHARE, LENS_MIN, LENS_MAX);

  function startDemo() {
    demo.active = true;
    demo.t = 0;
  }

  function demoTarget(dt) {
    demo.t += dt / DEMO_SECONDS_PER_STOP;
    const segment = Math.floor(demo.t);
    if (segment >= DEMO_PATH.length - 1) {
      demo.active = false;
      demo.nextAt = isTouch ? performance.now() + DEMO_REPEAT_MS : Infinity;
      return null;
    }
    const from = scene.logoPoint(...DEMO_PATH[segment]);
    const to = scene.logoPoint(...DEMO_PATH[segment + 1]);
    const t = smoothstep(demo.t - segment);
    return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), r: lensRadius() * DEMO_LENS_SHARE, byUser: false };
  }

  function lensTarget(nowMs, dt) {
    const hovering = pointer.present && isInside(scene.logoRect(), pointer, HOVER_PADDING);
    setScanning(hovering);
    if (hovering) {
      flags.interacted = true;
      demo.active = false;
      return { x: pointer.x, y: pointer.y, r: lensRadius(), byUser: true };
    }
    if (nowMs < touch.until) return { x: touch.x, y: touch.y, r: lensRadius(), byUser: true };
    const canAutoDemo = !reducedMotion && !flags.interacted && introTime >= INTRO_SECONDS + DEMO_DELAY_SECONDS;
    if (!demo.active && canAutoDemo && nowMs >= demo.nextAt) {
      startDemo();
    }
    const idle = { x: lens.x, y: lens.y, r: 0, byUser: false };
    if (demo.active) return demoTarget(dt) ?? idle;
    return idle;
  }

  function setScanning(isScanning) {
    if (flags.scanning === isScanning) return;
    flags.scanning = isScanning;
    document.body.classList.toggle('is-scanning', isScanning);
  }

  function updateLens(nowMs, dt) {
    const target = lensTarget(nowMs, dt);
    // Пока линза закрыта, переносим её сразу в точку — чтобы не «прилетала» издалека.
    const follow = lens.r < 2 ? 1 : 1 - Math.exp(-22 * dt);
    lens.x = lerp(lens.x, target.x, follow);
    lens.y = lerp(lens.y, target.y, follow);
    lens.r = damp(lens.r, target.r, target.r > lens.r ? 10 : 7, dt);
    lens.byUser = target.byUser;
    if (lens.r < 0.5) lens.r = 0;
  }

  function drawLens() {
    const scale = (lens.r / RING_BASE_RADIUS).toFixed(4);
    const transform = `translate3d(${lens.x.toFixed(1)}px, ${lens.y.toFixed(1)}px, 0) scale(${scale})`;
    plate.style.transform = transform;
    ring.style.transform = transform;
    ring.style.opacity = clamp(lens.r / LENS_REVEAL_RADIUS, 0, 1).toFixed(3);
    // Подписи кольца не должны расти вместе с линзой.
    ring.style.setProperty('--inv', lens.r > 1 ? (RING_BASE_RADIUS / lens.r).toFixed(4) : '1');
    frameCount += 1;
    if (readout && lens.r > 0 && frameCount % READOUT_EVERY_FRAMES === 0) {
      readout.textContent = `X-RAY · X ${pad4(lens.x)} · Y ${pad4(lens.y)}`;
    }
  }

  function computePose(dt) {
    introTime += dt;
    const intro = easeOutCubic(clamp(introTime / INTRO_SECONDS, 0, 1));
    const tilt = reducedMotion ? 0.4 : 1;
    const sway = reducedMotion ? 0 : Math.sin(time * 0.42) * 0.07;
    pose.ry = damp(pose.ry, pointer.nx * TILT_Y * tilt + sway, 3.2, dt);
    pose.rx = damp(pose.rx, pointer.ny * TILT_X * tilt, 3.2, dt);
    pose.spin = damp(pose.spin, pose.spinTarget, 2.2, dt);
    return {
      rx: pose.rx,
      ry: pose.ry + pose.spin + (1 - intro) * INTRO_TURN,
      scale: lerp(INTRO_SCALE, 1, intro),
      floatY: reducedMotion ? 0 : Math.sin(time * 0.9) * 0.05,
      envAngle: (1 - intro) * INTRO_ENV_TURN + (reducedMotion ? 0 : Math.sin(time * 0.23) * 0.55),
      time,
    };
  }

  function renderFrame(nowMs, dt) {
    time += dt;
    scene.setPose(computePose(dt));
    updateLens(nowMs, dt);
    scene.setLens({
      x: lens.x,
      y: lens.y,
      radius: lens.r,
      feather: LENS_FEATHER,
      reveal: clamp(lens.r / LENS_REVEAL_RADIUS, 0, 1),
    });
    drawLens();
    hud.update(lens, dt, { countsAsFind: lens.byUser });
    scene.render();
  }

  function loop(nowMs) {
    if (!flags.running) return;
    const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, (nowMs - lastMs) / 1000));
    lastMs = nowMs;
    renderFrame(nowMs, dt);
    rafId = requestAnimationFrame(loop);
  }

  function syncRunning() {
    const shouldRun = flags.started && flags.visible && !document.hidden;
    if (shouldRun === flags.running) return;
    flags.running = shouldRun;
    // Ровно один цикл: при скрытии вкладки отменяем запланированный кадр.
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (shouldRun) {
      lastMs = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  }

  function resize() {
    const rect = root.getBoundingClientRect();
    view.width = Math.max(1, rect.width);
    view.height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? MAX_DPR_LOW_POWER : MAX_DPR);
    scene.resize(view.width, view.height, dpr, layoutFor(view.width));
    if (!flags.running) renderFrame(performance.now(), 0);
  }

  function layoutFor(width) {
    if (width < DESKTOP_MIN_WIDTH) return MOBILE_LAYOUT;
    const safeWidth = getSafeWidth?.();
    if (!safeWidth || safeWidth <= 0) return DESKTOP_LAYOUT;
    const widthFrac = Math.min(DESKTOP_LAYOUT.widthFrac, (safeWidth * SAFE_WIDTH_SHARE) / width);
    return { ...DESKTOP_LAYOUT, widthFrac };
  }

  function localPoint(event) {
    const rect = root.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const point = localPoint(event);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.nx = clamp((point.x / view.width) * 2 - 1, -1, 1);
    pointer.ny = clamp((point.y / view.height) * 2 - 1, -1, 1);
    pointer.present = point.y >= 0 && point.y <= view.height;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.present = false; });

  const holdTouch = (event) => {
    if (event.pointerType !== 'touch') return;
    const point = localPoint(event);
    touch.x = point.x;
    touch.y = point.y;
    touch.until = performance.now() + TOUCH_HOLD_MS;
    flags.interacted = true;
    demo.active = false;
  };
  root.addEventListener('pointerdown', holdTouch, { passive: true });
  root.addEventListener('pointermove', holdTouch, { passive: true });

  new ResizeObserver(resize).observe(root);
  new IntersectionObserver(([entry]) => {
    flags.visible = entry.isIntersecting;
    syncRunning();
  }).observe(root);
  document.addEventListener('visibilitychange', syncRunning);
  resize();

  return Object.freeze({
    start() {
      flags.started = true;
      syncRunning();
    },
    spin() {
      pose.spinTarget += Math.PI * 2 * SPIN_TURNS;
    },
    autoScan() {
      flags.interacted = false;
      demo.nextAt = 0;
      startDemo();
    },
  });
}
