/**
 * Точка входа сайта Purple Dynasty.
 * Сначала оживляем лёгкий интерфейс, параллельно грузим three.js для 3D-логотипа.
 */
import { EVENTS, SITE } from './config.js';
import { initCursor } from './cursor.js';
import { initEvents } from './events.js';
import { initFun } from './fun.js';
import { initSections } from './sections.js';
import { initStart } from './start.js';
import { showMission, showToast } from './toast.js';
import { initUi } from './ui.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PRELOADER_MIN_MS = reducedMotion ? 200 : 1100;
const PRELOADER_MAX_MS = 6000;
const FONTS_MAX_MS = 1500;
const PRELOADER_EXIT_MS = 260;
const LOGO_SIDE_GAP_PX = 24;

let scanner = null;

function createPreloader() {
  const root = document.getElementById('preloader');
  const count = root?.querySelector('[data-preloader-count]');
  const startedAt = performance.now();
  let shown = 0;
  let target = 0.15;
  let frame = 0;

  function tick() {
    shown += (target - shown) * 0.12;
    if (target - shown < 0.002) shown = target;
    root?.style.setProperty('--level', shown.toFixed(3));
    if (count) count.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  return Object.freeze({
    /** @param {number} value 0..1 */
    progress(value) {
      target = Math.max(target, value);
    },
    async finish() {
      target = 1;
      const wait = Math.max(0, PRELOADER_MIN_MS - (performance.now() - startedAt));
      await new Promise((resolve) => window.setTimeout(resolve, wait + PRELOADER_EXIT_MS));
      cancelAnimationFrame(frame);
      if (count) count.textContent = '100';
      root?.style.setProperty('--level', '1');
      root?.classList.add('is-done');
      document.body.classList.remove('is-loading');
    },
  });
}

/** Ширина между текстом слева и карточкой сервера справа — чтобы логотип их не перекрывал. */
function heroSafeWidth() {
  const copy = document.querySelector('.hero__copy')?.getBoundingClientRect();
  const side = document.querySelector('.hero__side')?.getBoundingClientRect();
  if (!copy || !side || side.left <= copy.right) return null;
  return side.left - copy.right - LOGO_SIDE_GAP_PX * 2;
}

async function loadScanner() {
  const root = document.getElementById('scanner');
  if (!root) return null;
  try {
    const { initScanner } = await import('./logo/scanner.js');
    return initScanner(root, {
      reducedMotion,
      getSafeWidth: heroSafeWidth,
      onFound: (category) => showToast({ title: 'Обнаружено', text: category.label }),
      onAllFound: () => showMission({ title: 'Контрабанда найдена', sub: 'Вся династия под рентгеном · Respect +' }),
    });
  } catch (error) {
    console.error('[scanner] 3D-логотип не запустился — показываем статичную картинку.', error);
    root.classList.add('is-fallback');
    return null;
  }
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => window.setTimeout(resolve, ms))]);
}

function initLightParts() {
  initUi(SITE);
  initSections({ reducedMotion });
  initStart();
  initCursor();
  initFun({ reducedMotion, getScanner: () => scanner });
  const carousel = document.querySelector('[data-carousel]');
  if (carousel) initEvents(carousel, EVENTS, { reducedMotion });
  document.querySelector('[data-scan-auto]')?.addEventListener('click', () => scanner?.autoScan());
}

async function boot() {
  const preloader = createPreloader();
  try {
    initLightParts();
  } catch (error) {
    console.error('[ui] Ошибка при запуске интерфейса', error);
  }
  await withTimeout(document.fonts?.ready ?? Promise.resolve(), FONTS_MAX_MS);
  preloader.progress(0.45);
  const scannerReady = loadScanner();
  scanner = (await withTimeout(scannerReady, PRELOADER_MAX_MS)) ?? null;
  preloader.progress(0.9);
  await preloader.finish();
  if (scanner) {
    scanner.start();
    return;
  }
  // Медленный интернет: three.js догрузится уже после прелоадера.
  const lateScanner = await scannerReady;
  scanner = lateScanner;
  lateScanner?.start();
}

boot();
