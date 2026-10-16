/**
 * Разделы страницы: появление при прокрутке, манифест «по словам», карточки ролей с линзой цвета.
 */
import { clamp, progressBetween } from './utils.js';

const REVEAL_SELECTORS = [
  '.manifesto .section-label', '.fact', '.roles__head > *', '.role', '.events__head > *',
  '.start__head > *', '.step', '.start__aside', '.footer__col',
].join(', ');
const REVEAL_STAGGER_MS = 90;
const MAX_STAGGER_STEPS = 4;
const WORDS_START = 0.85;
const WORDS_END = 0.35;
const TILT_DEGREES = 5;

function initReveal(reducedMotion) {
  if (reducedMotion || !('IntersectionObserver' in window)) return;
  const targets = [...document.querySelectorAll(REVEAL_SELECTORS)];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });

  targets.forEach((element) => {
    const siblings = [...element.parentElement.children];
    const step = Math.min(siblings.indexOf(element), MAX_STAGGER_STEPS);
    element.dataset.reveal = '';
    element.style.setProperty('--reveal-delay', `${step * REVEAL_STAGGER_MS}ms`);
    observer.observe(element);
  });
}

/** Оборачивает каждое слово в span, сохраняя <em> как акцент. */
function splitWords(container) {
  const words = [];
  const wrap = (text, isAccent) => text.split(/(\s+)/).map((part) => {
    if (!part.trim()) return document.createTextNode(part);
    const span = document.createElement('span');
    span.className = isAccent ? 'word is-accent' : 'word';
    span.textContent = part;
    words.push(span);
    return span;
  });

  [...container.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.replaceWith(...wrap(node.textContent, false));
    } else if (node.nodeName === 'EM') {
      node.replaceWith(...wrap(node.textContent, true));
    }
  });
  return words;
}

function initManifesto() {
  const container = document.querySelector('[data-words]');
  if (!container) return;
  const words = splitWords(container);
  let ticking = false;

  const update = () => {
    ticking = false;
    const rect = container.getBoundingClientRect();
    const viewport = window.innerHeight;
    const progress = progressBetween(
      viewport * WORDS_START - rect.top,
      0,
      rect.height + viewport * (WORDS_START - WORDS_END),
    );
    const lit = Math.round(progress * words.length);
    words.forEach((word, index) => word.classList.toggle('is-lit', index < lit));
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
}

function initRoles(reducedMotion) {
  document.querySelectorAll('[data-role]').forEach((card) => {
    const setPoint = (event) => {
      const rect = card.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      const y = clamp(event.clientY - rect.top, 0, rect.height);
      card.style.setProperty('--x', `${x}px`);
      card.style.setProperty('--y', `${y}px`);
      if (reducedMotion) return;
      const tiltX = ((y / rect.height) - 0.5) * -TILT_DEGREES;
      const tiltY = ((x / rect.width) - 0.5) * TILT_DEGREES;
      card.style.setProperty('--tilt', `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`);
    };

    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      setPoint(event);
      card.classList.add('is-lit');
    });
    card.addEventListener('pointermove', setPoint, { passive: true });
    card.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'touch') return;
      card.classList.remove('is-lit');
      card.style.removeProperty('--tilt');
    });
    // На телефоне — проявляем цвет по тапу и гасим по повторному.
    card.addEventListener('click', (event) => {
      if (event.pointerType !== 'touch') return;
      setPoint(event);
      card.classList.toggle('is-lit');
    });
  });
}

/** @param {{reducedMotion: boolean}} options */
export function initSections({ reducedMotion }) {
  initReveal(reducedMotion);
  initManifesto();
  initRoles(reducedMotion);
}
