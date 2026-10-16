/**
 * Уведомления: маленький тост снизу слева и большое «MISSION PASSED» по центру.
 */

const TOAST_MS = 3200;
const MISSION_MS = 2600;
const LEAVE_MS = 600;

let missionTimer = 0;

/**
 * @param {{title?: string, text: string}} message
 */
export function showToast({ title, text }) {
  const host = document.querySelector('[data-toasts]');
  if (!host) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (title) {
    const label = document.createElement('b');
    label.textContent = title;
    toast.append(label);
  }
  toast.append(document.createTextNode(text));
  host.append(toast);

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), LEAVE_MS);
  }, TOAST_MS);
}

/**
 * Крупная надпись в духе GTA SA: «Миссия пройдена! Respect +».
 * @param {{title: string, sub?: string}} message
 */
export function showMission({ title, sub = '' }) {
  const host = document.querySelector('[data-mission]');
  if (!host) return;

  window.clearTimeout(missionTimer);
  host.querySelector('[data-mission-title]').textContent = title;
  host.querySelector('[data-mission-sub]').textContent = sub;
  host.classList.remove('is-leaving');
  host.hidden = true;
  // Перезапускаем CSS-анимацию появления.
  void host.offsetWidth;
  host.hidden = false;

  missionTimer = window.setTimeout(() => {
    host.classList.add('is-leaving');
    missionTimer = window.setTimeout(() => {
      host.hidden = true;
      host.classList.remove('is-leaving');
    }, LEAVE_MS);
  }, MISSION_MS);
}
