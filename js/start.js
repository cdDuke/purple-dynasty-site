/**
 * Раздел «Как начать»: вкладки «лаунчер / вручную» и чек-лист шагов с кольцом готовности.
 */
import { showMission } from './toast.js';

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function initTabs(onChange) {
  const tabs = [...document.querySelectorAll('[role="tab"][data-tab]')];
  if (tabs.length === 0) return;

  const select = (tab, focus = false) => {
    tabs.forEach((item) => {
      const isActive = item === tab;
      item.setAttribute('aria-selected', String(isActive));
      item.tabIndex = isActive ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !isActive;
    });
    if (focus) tab.focus();
    onChange();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const shift = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!shift) return;
      event.preventDefault();
      select(tabs[(index + shift + tabs.length) % tabs.length], true);
    });
  });
}

function activePanel() {
  return [...document.querySelectorAll('[data-steps]')].find((panel) => !panel.hidden) ?? null;
}

export function initStart() {
  const bar = document.querySelector('[data-progress-bar]');
  const value = document.querySelector('[data-progress-value]');
  if (bar) {
    bar.style.strokeDasharray = `${RING_LENGTH}`;
    bar.style.strokeDashoffset = `${RING_LENGTH}`;
  }
  const celebrated = new Set();

  // Каждой галочке — понятное имя для скринридера: «Готово: Скачай лаунчер».
  document.querySelectorAll('[data-step-check]').forEach((check) => {
    const title = check.closest('.step')?.querySelector('.step__title')?.textContent.trim();
    if (title) check.setAttribute('aria-label', `Готово: ${title}`);
  });

  const update = ({ fromCheck = false } = {}) => {
    const panel = activePanel();
    if (!panel) return;
    const checks = [...panel.querySelectorAll('[data-step-check]')];
    const done = checks.filter((check) => check.checked).length;
    const share = checks.length ? done / checks.length : 0;
    checks.forEach((check) => check.closest('.step')?.classList.toggle('is-done', check.checked));
    if (bar) bar.style.strokeDashoffset = `${RING_LENGTH * (1 - share)}`;
    if (value) value.textContent = `${Math.round(share * 100)}%`;

    // Поздравляем только за свежую галочку, а не при переключении вкладок.
    if (share === 1 && fromCheck && !celebrated.has(panel.id)) {
      celebrated.add(panel.id);
      showMission({ title: 'Ah shit, here we go again.', sub: 'Добро пожаловать в Лос-Сантос' });
    }
    if (share < 1) celebrated.delete(panel.id);
  };

  document.querySelectorAll('[data-step-check]').forEach((check) => {
    check.addEventListener('change', () => update({ fromCheck: true }));
  });
  initTabs(() => update());
  update();
}
