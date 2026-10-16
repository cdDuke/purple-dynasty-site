/**
 * Пасхалки: чит-коды GTA SA, «уровень розыска» за бешеные клики, денежный дождь, заголовок вкладки.
 */
import { createBurstCounter, createCheatDetector, latinKey } from './utils.js';
import { showToast } from './toast.js';

const CHEATS = Object.freeze(['HESOYAM', 'AEZAKMI', 'DYNASTY']);
const MAX_WANTED = 6;
const CLICK_BURST = Object.freeze({ count: 6, windowMs: 1600 });
const BILLS = 36;
const BILL_MIN_MS = 2200;
const BILL_SPREAD_MS = 1600;
const BILL_DELAY_MS = 900;
const AWAY_TITLE = 'Вернись, город ждёт… — PD';

const WANTED_LINES = Object.freeze([
  'Эй, полегче с кликами.',
  'Копы уже выехали.',
  'Над районом кружит вертолёт.',
  'ФБР на хвосте.',
  'Это уже военное положение.',
  'Армия на подходе. Набери AEZAKMI.',
]);

function isTyping(target) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function moneyRain(reducedMotion) {
  if (reducedMotion) return;
  for (let i = 0; i < BILLS; i += 1) {
    const bill = document.createElement('div');
    bill.className = 'bill';
    bill.textContent = '$100';
    bill.style.left = `${Math.random() * 100}vw`;
    document.body.append(bill);

    const spin = (Math.random() - 0.5) * 720;
    const drift = (Math.random() - 0.5) * 30;
    const animation = bill.animate([
      { transform: `translate3d(0, 0, 0) rotate(${Math.random() * 90}deg)` },
      { transform: `translate3d(${drift}vw, 115vh, 0) rotate(${spin}deg)` },
    ], {
      duration: BILL_MIN_MS + Math.random() * BILL_SPREAD_MS,
      delay: Math.random() * BILL_DELAY_MS,
      easing: 'cubic-bezier(.3,.1,.6,1)',
      fill: 'backwards',
    });
    animation.onfinish = () => bill.remove();
  }
}

function createWanted() {
  const host = document.querySelector('[data-wanted]');
  const siren = document.querySelector('[data-siren]');
  const stars = host ? [...host.querySelectorAll('svg')] : [];
  let level = 0;

  const render = () => {
    host?.classList.toggle('is-active', level > 0);
    host?.setAttribute('aria-label', `Уровень розыска: ${level}`);
    stars.forEach((star, index) => star.classList.toggle('is-lit', index < level));
  };

  return Object.freeze({
    raise() {
      level = Math.min(MAX_WANTED, level + 1);
      render();
      showToast({ title: `Розыск ${'★'.repeat(level)}`, text: WANTED_LINES[level - 1] });
      if (siren) {
        siren.classList.remove('is-on');
        void siren.offsetWidth;
        siren.classList.add('is-on');
      }
    },
    clear() {
      const hadWanted = level > 0;
      level = 0;
      render();
      return hadWanted;
    },
  });
}

/**
 * @param {{reducedMotion: boolean, getScanner: () => ({spin: () => void} | null)}} options
 */
export function initFun({ reducedMotion, getScanner }) {
  const detect = createCheatDetector(CHEATS);
  const burst = createBurstCounter(CLICK_BURST);
  const wanted = createWanted();

  const actions = {
    HESOYAM: () => {
      moneyRain(reducedMotion);
      showToast({ title: 'Чит активирован', text: 'Здоровье, броня и $250 000.' });
    },
    AEZAKMI: () => {
      const hadWanted = wanted.clear();
      showToast({ title: 'Чит активирован', text: hadWanted ? 'Розыск снят. Копы потеряли след.' : 'Розыска и так нет — ты чист.' });
    },
    DYNASTY: () => {
      getScanner()?.spin();
      showToast({ title: 'Династия', text: 'Логотип сделал два оборота в твою честь.' });
    },
  };

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    const code = detect(latinKey(event));
    if (code) actions[code]();
  });

  document.addEventListener('pointerdown', (event) => {
    if (burst(event.timeStamp)) wanted.raise();
  }, { passive: true });

  const title = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? AWAY_TITLE : title;
  });
}
