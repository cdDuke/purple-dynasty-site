/**
 * Кастомный курсор (только мышь): точка + кольцо с задержкой.
 * Над ссылками кольцо растёт, над каруселью превращается в чёрный круг «Тяни».
 */

const RING_FOLLOW = 0.2;
const SETTLE_DISTANCE = 0.1;
const INTERACTIVE = 'a, button, label, [role="tab"]';

export function initCursor() {
  if (!matchMedia('(pointer: fine)').matches) return;
  const root = document.querySelector('.cursor');
  if (!root) return;

  const dot = root.querySelector('.cursor__dot');
  const ring = root.querySelector('.cursor__ring');
  const label = root.querySelector('[data-cursor-label]');
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let frame = 0;

  function follow() {
    current.x += (target.x - current.x) * RING_FOLLOW;
    current.y += (target.y - current.y) * RING_FOLLOW;
    ring.style.transform = `translate3d(${current.x.toFixed(1)}px, ${current.y.toFixed(1)}px, 0)`;
    const isSettled = Math.abs(target.x - current.x) < SETTLE_DISTANCE && Math.abs(target.y - current.y) < SETTLE_DISTANCE;
    frame = isSettled ? 0 : requestAnimationFrame(follow);
  }

  function setMode(element) {
    const dragZone = element?.closest?.('[data-cursor="drag"]');
    const isLink = Boolean(element?.closest?.(INTERACTIVE));
    root.classList.toggle('is-drag', Boolean(dragZone) && !isLink);
    root.classList.toggle('is-link', isLink);
    label.textContent = dragZone && !isLink ? 'Тяни' : '';
  }

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    target.x = event.clientX;
    target.y = event.clientY;
    if (!root.classList.contains('is-ready')) {
      current.x = target.x;
      current.y = target.y;
      root.classList.add('is-ready');
      document.body.classList.add('has-cursor');
    }
    dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
    if (!frame) frame = requestAnimationFrame(follow);
  }, { passive: true });

  document.addEventListener('pointerover', (event) => setMode(event.target), { passive: true });
  document.addEventListener('pointerdown', () => root.classList.add('is-dragging'), { passive: true });
  const stopDragging = () => root.classList.remove('is-dragging');
  document.addEventListener('pointerup', stopDragging, { passive: true });
  document.addEventListener('pointercancel', stopDragging, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => root.classList.add('is-hidden'));
  document.documentElement.addEventListener('pointerenter', () => root.classList.remove('is-hidden'));
}
