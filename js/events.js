/**
 * Карусель ивентов в духе референса: тянешь мышью/пальцем, слайды разворачиваются в 3D,
 * огромная дата на фоне едет медленнее (параллакс), текст слева меняется с анимацией.
 */
import { clamp, damp, eventStatus, formatCountdown, snapTarget, wrapIndex, wrapOffset } from './utils.js';

const DESKTOP_SPACING = 0.5;
const MOBILE_SPACING = 0.84;
// Совпадает с @media (max-width: 1000px) в css/events.css.
const STACKED_LAYOUT_QUERY = '(max-width: 1000px)';
const BIG_PARALLAX = 0.42;
const SCALE_DROP = 0.2;
const ROTATE_PER_SLIDE = 24;
const ROTATE_PER_VELOCITY = 5;
const MAX_ROTATE = 38;
const HIDE_AFTER_OFFSET = 2.4;
const DRAG_THRESHOLD_PX = 6;
const SETTLE_LAMBDA = 7;
const VELOCITY_LAMBDA = 10;
const WHEEL_IDLE_MS = 140;
const META_SWAP_MS = 260;
const COUNTDOWN_TICK_MS = 1000;
const EAGER_IMAGES = 2;

function createSlide(event, index) {
  const figure = document.createElement('figure');
  figure.className = 'slide';
  figure.dataset.index = String(index);
  const image = document.createElement('img');
  image.src = event.image;
  image.alt = `${event.tag}: ${event.title}`;
  image.width = 1024;
  image.height = 640;
  image.decoding = 'async';
  image.loading = index < EAGER_IMAGES ? 'eager' : 'lazy';
  image.draggable = false;
  const caption = document.createElement('figcaption');
  caption.className = 'slide__caption';
  const number = document.createElement('span');
  number.textContent = String(index + 1).padStart(2, '0');
  const credit = document.createElement('span');
  credit.className = 'slide__credit';
  credit.textContent = `Фото: ${event.credit}`;
  caption.append(number, credit);
  figure.append(image, caption);
  return figure;
}

function createBig(event) {
  const span = document.createElement('span');
  span.className = 'carousel__big';
  span.textContent = event.big;
  return span;
}

function createDash(event, index, onSelect) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'carousel__dash';
  button.setAttribute('aria-label', `Ивент ${index + 1}: ${event.title}`);
  button.addEventListener('click', () => onSelect(index));
  return button;
}

function describeStatus(event) {
  const status = eventStatus(event.schedule, new Date());
  if (!status) return { label: '', countdown: '' };
  const countdown = formatCountdown(status.msLeft);
  return status.state === 'live'
    ? { label: 'Идёт сейчас · ещё', countdown }
    : { label: 'Старт через', countdown };
}

/**
 * @param {HTMLElement} root
 * @param {ReadonlyArray<object>} events данные из config.js
 * @param {{reducedMotion: boolean}} options
 */
export function initEvents(root, events, { reducedMotion }) {
  const track = root.querySelector('[data-carousel-track]');
  const bigsHost = root.querySelector('[data-carousel-bigs]');
  const dashesHost = root.querySelector('[data-carousel-dashes]');
  const meta = root.querySelector('[data-carousel-meta]');
  const field = (name) => root.querySelector(`[data-meta-${name}]`);
  const count = events.length;
  if (!track || count === 0) return;

  const state = { progress: 0, target: 0, velocity: 0, spacing: 1, active: -1, frame: 0, lastMs: 0 };
  const drag = { id: null, startX: 0, startProgress: 0, lastX: 0, lastMs: 0, moved: false };

  const goTo = (index) => {
    state.target = state.progress + wrapOffset(index - state.progress, count);
    state.target = Math.round(state.target);
    wake();
  };

  const slides = events.map((event, index) => createSlide(event, index));
  const bigs = events.map(createBig);
  const dashes = events.map((event, index) => createDash(event, index, goTo));
  track.append(...slides);
  bigsHost.append(...bigs);
  dashesHost.append(...dashes);

  function renderMeta(index, isFirst) {
    const event = events[index];
    const fill = () => {
      field('tag').textContent = `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')} · ${event.tag}`;
      field('title').textContent = event.title;
      field('text').textContent = event.text;
      renderCountdown();
      meta.classList.remove('is-changing');
    };
    if (reducedMotion || isFirst) {
      fill();
      return;
    }
    meta.classList.add('is-changing');
    window.setTimeout(fill, META_SWAP_MS);
  }

  function renderCountdown() {
    if (state.active < 0) return;
    const { label, countdown } = describeStatus(events[state.active]);
    field('state').textContent = label;
    field('countdown').textContent = countdown;
  }

  function layout() {
    const { progress, spacing, velocity } = state;
    slides.forEach((slide, index) => {
      const offset = wrapOffset(index - progress, count);
      const distance = Math.abs(offset);
      const rotate = clamp(-offset * ROTATE_PER_SLIDE - velocity * ROTATE_PER_VELOCITY, -MAX_ROTATE, MAX_ROTATE);
      const scale = 1 - Math.min(distance, 1.5) * SCALE_DROP;
      slide.style.transform =
        `translate3d(${(offset * spacing).toFixed(1)}px, 0, 0) perspective(1400px) rotateY(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      slide.style.zIndex = String(100 - Math.round(distance * 10));
      slide.style.opacity = distance > HIDE_AFTER_OFFSET ? '0' : '1';
      slide.classList.toggle('is-active', distance < 0.5);
    });
    bigs.forEach((big, index) => {
      const offset = wrapOffset(index - progress, count);
      big.style.transform = `translate3d(${(offset * spacing * BIG_PARALLAX).toFixed(1)}px, 0, 0)`;
      big.style.opacity = clamp(1 - Math.abs(offset) * 1.3, 0, 1).toFixed(3);
    });

    const active = wrapIndex(Math.round(progress), count);
    if (active !== state.active) {
      const isFirst = state.active === -1;
      state.active = active;
      dashes.forEach((dash, index) => dash.classList.toggle('is-active', index === active));
      renderMeta(active, isFirst);
    }
  }

  function tick(nowMs) {
    const dt = Math.min(0.05, Math.max(0, (nowMs - state.lastMs) / 1000) || 0);
    state.lastMs = nowMs;
    if (drag.id === null) {
      const before = state.progress;
      state.progress = damp(state.progress, state.target, SETTLE_LAMBDA, dt);
      state.velocity = dt > 0 ? (state.progress - before) / dt : 0;
    }
    layout();
    const isSettled = drag.id === null && Math.abs(state.target - state.progress) < 0.0005;
    if (isSettled) {
      state.progress = state.target;
      state.velocity = 0;
      layout();
      state.frame = 0;
      return;
    }
    state.frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (state.frame) return;
    state.lastMs = performance.now();
    state.frame = requestAnimationFrame(tick);
  }

  function measure() {
    const width = root.getBoundingClientRect().width;
    state.spacing = width * (matchMedia(STACKED_LAYOUT_QUERY).matches ? MOBILE_SPACING : DESKTOP_SPACING);
    layout();
  }

  root.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    drag.id = event.pointerId;
    drag.startX = event.clientX;
    drag.lastX = event.clientX;
    drag.lastMs = event.timeStamp;
    drag.startProgress = state.progress;
    drag.moved = false;
    state.velocity = 0;
    wake();
  });

  root.addEventListener('pointermove', (event) => {
    if (event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
      root.setPointerCapture(event.pointerId);
      root.classList.add('is-dragging');
    }
    if (!drag.moved) return;
    const dt = Math.max(1, event.timeStamp - drag.lastMs) / 1000;
    const instant = -(event.clientX - drag.lastX) / state.spacing / dt;
    state.velocity = damp(state.velocity, instant, VELOCITY_LAMBDA, dt);
    state.progress = drag.startProgress - dx / state.spacing;
    state.target = state.progress;
    drag.lastX = event.clientX;
    drag.lastMs = event.timeStamp;
  });

  const release = (event) => {
    if (event.pointerId !== drag.id) return;
    drag.id = null;
    root.classList.remove('is-dragging');
    if (drag.moved) {
      state.target = snapTarget(state.progress, state.velocity);
    } else if (event.type === 'pointerup') {
      const slide = event.target.closest('.slide');
      if (slide) goTo(Number(slide.dataset.index));
    }
    wake();
  };
  // Отпускание слушаем на окне: палец или мышь могли уйти за пределы карусели.
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  let wheelTimer = 0;
  root.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    state.target += event.deltaX / state.spacing;
    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => {
      state.target = Math.round(state.target);
      wake();
    }, WHEEL_IDLE_MS);
    wake();
  }, { passive: false });

  root.addEventListener('keydown', (event) => {
    const shift = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!shift) return;
    event.preventDefault();
    state.target = Math.round(state.target) + shift;
    wake();
  });
  root.querySelector('[data-carousel-prev]')?.addEventListener('click', () => {
    state.target = Math.round(state.target) - 1;
    wake();
  });
  root.querySelector('[data-carousel-next]')?.addEventListener('click', () => {
    state.target = Math.round(state.target) + 1;
    wake();
  });

  new ResizeObserver(measure).observe(root);
  window.setInterval(renderCountdown, COUNTDOWN_TICK_MS);
  measure();
}
