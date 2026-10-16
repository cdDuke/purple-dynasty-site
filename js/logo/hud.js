/**
 * HUD сканера: рамки «обнаружено» вокруг предметов, линии между ними и чек-лист находок.
 */
import { SCAN_CATEGORIES } from './contraband.js';
import { circleIntersectsRect, damp } from '../utils.js';

const MIN_ACTIVE_RADIUS = 24;
const CENTER_RADIUS_SHARE = 0.8;
const CORE_RADIUS_SHARE = 0.25;
const FOUND_AFTER_SECONDS = 0.35;
const BOX_PADDING = 6;
const VISIBLE_ALPHA = 0.02;
const LINK_ALPHA = 0.45;
const MAX_LINKS = 6;
const MIN_CONFIDENCE = 91;
const CONFIDENCE_SPREAD = 9;

function createBox(layer, category, confidence) {
  const box = document.createElement('div');
  box.className = 'scan-box';
  box.hidden = true;
  const tag = document.createElement('span');
  tag.className = 'scan-box__tag';
  const name = document.createElement('b');
  name.textContent = category.label;
  tag.append(name, ` ${confidence}%`);
  box.append(tag);
  layer.append(box);
  return box;
}

function placeBox(box, rect, alpha, showTag) {
  if (!rect || alpha < VISIBLE_ALPHA) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.style.transform = `translate3d(${rect.x - BOX_PADDING}px, ${rect.y - BOX_PADDING}px, 0)`;
  box.style.width = `${rect.w + BOX_PADDING * 2}px`;
  box.style.height = `${rect.h + BOX_PADDING * 2}px`;
  box.style.opacity = alpha.toFixed(3);
  box.classList.toggle('has-tag', showTag);
}

/**
 * Предмет «под линзой»: его центр внутри линзы или сердцевина линзы задевает его рамку
 * (второе нужно для длинных предметов вроде AK-47).
 */
function isUnderLens(lens, rect) {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  const centerInside = (centerX - lens.x) ** 2 + (centerY - lens.y) ** 2 <= (lens.r * CENTER_RADIUS_SHARE) ** 2;
  return centerInside || circleIntersectsRect(lens.x, lens.y, lens.r * CORE_RADIUS_SHARE, rect);
}

function markListItem(list, category) {
  const item = list?.querySelector(`[data-category="${category.id}"]`);
  if (!item) return;
  item.classList.add('is-found');
  const label = item.querySelector('[data-label]');
  if (label) label.textContent = category.label;
}

/**
 * @param {HTMLElement} root
 * @param {{items: ReadonlyArray<{category: string | null}>, itemRect: (index: number) => object}} scene
 * @param {{onFound?: (category: object) => void, onAllFound?: () => void}} callbacks
 */
export function createScanHud(root, scene, { onFound, onAllFound }) {
  const layer = root.querySelector('[data-scan-boxes]');
  const link = root.querySelector('[data-scan-links] path');
  const list = document.querySelector('[data-scan-list]');
  const counter = document.querySelector('[data-scan-count]');
  const byId = new Map(SCAN_CATEGORIES.map((category) => [category.id, category]));

  const tracked = scene.items
    .map((item, index) => ({ index, category: byId.get(item.category) }))
    .filter((entry) => entry.category);
  const boxes = tracked.map(({ category }) =>
    createBox(layer, category, MIN_CONFIDENCE + Math.floor(Math.random() * CONFIDENCE_SPREAD)),
  );

  let alphas = tracked.map(() => 0);
  let dwell = new Map();
  let found = new Set();

  function registerFound(category) {
    if (found.has(category.id)) return;
    found = new Set([...found, category.id]);
    markListItem(list, category);
    if (counter) counter.textContent = `${found.size}/${SCAN_CATEGORIES.length}`;
    onFound?.(category);
    if (found.size === SCAN_CATEGORIES.length) onAllFound?.();
  }

  function trackDwell(hits, dt) {
    dwell = new Map(
      [...byId.keys()].map((id) => [id, hits.has(id) ? (dwell.get(id) ?? 0) + dt : 0]),
    );
    dwell.forEach((seconds, id) => {
      if (seconds >= FOUND_AFTER_SECONDS) registerFound(byId.get(id));
    });
  }

  function drawLinks(centers) {
    if (!link) return;
    const points = centers.slice(0, MAX_LINKS);
    link.setAttribute('d', points.length > 1
      ? points.map(({ x, y }, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
      : '');
  }

  return Object.freeze({
    /**
     * @param {{x: number, y: number, r: number}} lens
     * @param {number} dt
     * @param {{countsAsFind: boolean}} options автоскан показывает предметы, но не засчитывает находки
     */
    update(lens, dt, { countsAsFind }) {
      const isActive = lens.r > MIN_ACTIVE_RADIUS;
      const hits = new Set();
      const tagged = new Set();
      const centers = [];

      alphas = tracked.map(({ index, category }, i) => {
        const needsRect = isActive || alphas[i] > VISIBLE_ALPHA;
        const rect = needsRect ? scene.itemRect(index) : null;
        const isHit = isActive && rect !== null && isUnderLens(lens, rect);
        if (isHit && countsAsFind) hits.add(category.id);

        const alpha = damp(alphas[i], isHit ? 1 : 0, isHit ? 14 : 5, dt);
        const showTag = alpha > LINK_ALPHA && !tagged.has(category.id);
        if (showTag) tagged.add(category.id);
        if (alpha > LINK_ALPHA && rect) centers.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
        placeBox(boxes[i], rect, alpha, showTag);
        return alpha;
      });

      trackDwell(hits, dt);
      drawLinks(centers);
    },
  });
}
