/**
 * Интерфейс: навигация, мобильное меню, копирование IP, онлайн, ссылки на лаунчер и соцсети.
 */
import { formatNumber, isConfiguredUrl, isServerAddress, parseOnline } from './utils.js';
import { showMission, showToast } from './toast.js';

const NAV_SOLID_AFTER_PX = 40;
// Совпадает с брейкпоинтом бургер-меню в css/base.css.
const DESKTOP_NAV_QUERY = '(min-width: 901px)';
// Локальные и частные адреса open.mp не знает — не стучимся зря.
const PRIVATE_HOST_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost)/i;
const ONLINE_TIMEOUT_MS = 6000;
const CLIPBOARD_TIMEOUT_MS = 1500;
const FRAME_TICK_MS = 1000;

function initNav() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  let ticking = false;
  const update = () => {
    nav.classList.toggle('is-solid', window.scrollY > NAV_SOLID_AFTER_PX);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
}

function initMobileMenu() {
  const burger = document.querySelector('[data-burger]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (!burger || !menu) return;

  const setOpen = (isOpen) => {
    burger.setAttribute('aria-expanded', String(isOpen));
    menu.hidden = !isOpen;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (isOpen) menu.querySelector('a')?.focus();
  };
  burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menu.hidden) return;
    setOpen(false);
    burger.focus();
  });
  // Экран повернули или растянули до десктопа — меню больше не нужно.
  matchMedia(DESKTOP_NAV_QUERY).addEventListener('change', (event) => {
    if (event.matches && !menu.hidden) setOpen(false);
  });
}

/** Старый способ копирования — работает и на сайтах без https. */
function copyWithSelection(text) {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.append(field);
  field.select();
  const isCopied = document.execCommand('copy');
  field.remove();
  if (!isCopied) throw new Error('execCommand("copy") не сработал');
}

async function copyText(text) {
  if (!navigator.clipboard?.writeText || !window.isSecureContext) {
    copyWithSelection(text);
    return;
  }
  try {
    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error('Буфер обмена не ответил')), CLIPBOARD_TIMEOUT_MS);
    });
    await Promise.race([navigator.clipboard.writeText(text), timeout]);
  } catch (error) {
    console.warn('[ip] Clipboard API не сработал, пробуем запасной способ', error);
    copyWithSelection(text);
  }
}

function initServerAddress(address) {
  document.querySelectorAll('[data-ip]').forEach((node) => {
    node.textContent = address;
  });
  document.querySelectorAll('[data-copy-ip]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await copyText(address);
        showMission({ title: 'Миссия пройдена!', sub: 'IP скопирован · Respect +' });
      } catch (error) {
        console.warn('[ip] Не удалось скопировать адрес', error);
        showToast({ title: 'Скопируй вручную', text: address });
      }
    });
  });
}

async function loadOnline(apiBase, address) {
  const label = document.querySelector('[data-online-text]');
  if (!label || !apiBase || !isServerAddress(address) || PRIVATE_HOST_RE.test(address)) return;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ONLINE_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase}${encodeURIComponent(address)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const online = parseOnline(await response.json());
    if (online) label.textContent = `${formatNumber(online.players)} / ${formatNumber(online.max)} онлайн`;
  } catch (error) {
    console.warn('[online] Онлайн не получен, оставляем «Сервер 24/7»', error);
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Ссылка работает, если адрес настроен в config.js, иначе показывает подсказку.
 * @param {HTMLAnchorElement} link
 * @param {string} url
 * @param {{text: string, download?: boolean, external?: boolean}} fallback
 */
function bindLink(link, url, { text, download = false, external = true }) {
  if (isConfiguredUrl(url)) {
    link.href = url;
    if (download) link.setAttribute('download', '');
    if (external && /^https?:/i.test(url)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    return;
  }
  link.addEventListener('click', (event) => {
    event.preventDefault();
    showToast({ title: 'Скоро', text });
  });
}

function initLinks(site) {
  document.querySelectorAll('[data-launcher]').forEach((link) => {
    bindLink(link, site.launcherUrl, { text: 'Лаунчер вот-вот появится — следи за соцсетями.', download: true, external: false });
  });
  document.querySelectorAll('[data-launcher-note]').forEach((node) => {
    node.textContent = site.launcherNote;
  });
  document.querySelectorAll('[data-client]').forEach((link) => {
    bindLink(link, site.clientUrl, { text: 'Ссылка на клиент скоро появится.' });
  });
  document.querySelectorAll('[data-social]').forEach((link) => {
    bindLink(link, site.socials[link.dataset.social] ?? '', { text: 'Эта соцсеть скоро появится.' });
  });
}

function initFrameCounter() {
  const node = document.querySelector('[data-frame]');
  if (!node) return;
  let frame = 1;
  window.setInterval(() => {
    frame += 1;
    node.textContent = String(frame).padStart(4, '0');
  }, FRAME_TICK_MS);
}

/** @param {{serverAddress: string, onlineApi: string | null, launcherUrl: string, launcherNote: string,
 *   clientUrl: string, socials: Record<string, string>}} site */
export function initUi(site) {
  initNav();
  initMobileMenu();
  initServerAddress(site.serverAddress);
  initLinks(site);
  initFrameCounter();
  loadOnline(site.onlineApi, site.serverAddress);
}
