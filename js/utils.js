/**
 * Чистые вспомогательные функции сайта Purple Dynasty.
 * Без DOM — поэтому их проверяют тесты в Node (npm test).
 */

const NBSP = ' ';
const LETTER_RE = /^[a-z]$/i;
const URL_BASE = 'https://placeholder.invalid/';
const HOST_PORT_RE =
  /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*):(\d{1,5})$/i;
const MAX_PORT = 65535;
const MS_IN_HOUR = 3_600_000;
const DAYS_IN_WEEK = 7;
const DEFAULT_FLICK_SECONDS = 0.2;
const MAX_SLIDES_PER_FLICK = 2;

/** @typedef {{x: number, y: number, w: number, h: number}} Rect */
/**
 * @typedef {{type: 'yearly', month: number, day: number, hour?: number, minute?: number, durationHours?: number, utcOffsetMinutes?: number}
 *   | {type: 'weekly', weekday: number, hour?: number, minute?: number, durationHours?: number, utcOffsetMinutes?: number}} Schedule
 */
/** @typedef {{state: 'live' | 'upcoming', start: Date, msLeft: number}} EventStatus */

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {number} from
 * @param {number} to
 * @param {number} t
 * @returns {number}
 */
export function lerp(from, to, t) {
  return from + (to - from) * t;
}

/**
 * Плавное приближение к цели, не зависящее от частоты кадров.
 * @param {number} current
 * @param {number} target
 * @param {number} lambda скорость (чем больше, тем резче)
 * @param {number} dt секунды с прошлого кадра
 * @returns {number}
 */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * @param {number} value
 * @param {number} start
 * @param {number} end
 * @returns {number} 0..1
 */
export function progressBetween(value, start, end) {
  if (end === start) return value >= end ? 1 : 0;
  return clamp((value - start) / (end - start), 0, 1);
}

/**
 * @param {number} index
 * @param {number} count
 * @returns {number} индекс в диапазоне 0..count-1
 */
export function wrapIndex(index, count) {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/**
 * Кратчайшее расстояние по кольцу из count элементов: результат в [-count/2, count/2).
 * @param {number} offset
 * @param {number} count
 * @returns {number}
 */
export function wrapOffset(offset, count) {
  if (count <= 0) return 0;
  const half = count / 2;
  return wrapIndex(offset + half, count) - half;
}

/**
 * Куда «доехать» карусели после отпускания: ближайший слайд с учётом броска.
 * @param {number} progress текущая позиция (в слайдах)
 * @param {number} velocity скорость, слайдов в секунду
 * @param {number} [flickSeconds]
 * @returns {number}
 */
export function snapTarget(progress, velocity, flickSeconds = DEFAULT_FLICK_SECONDS) {
  const base = Math.round(progress);
  const projected = Math.round(progress + velocity * flickSeconds);
  return clamp(projected, base - MAX_SLIDES_PER_FLICK, base + MAX_SLIDES_PER_FLICK);
}

/**
 * Число с разделителями разрядов: 1 234 567 (неразрывные пробелы).
 * @param {unknown} value
 * @returns {string}
 */
export function formatNumber(value) {
  const amount = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
  const sign = amount < 0 ? '-' : '';
  return sign + String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/**
 * @param {number} count
 * @param {readonly [string, string, string]} forms «1 день», «2 дня», «5 дней»
 * @returns {string}
 */
export function pluralRu(count, [one, few, many]) {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * Обратный отсчёт: «2д 03:04:05» или «03:04:05». Пустая строка, если время вышло.
 * @param {number} ms
 * @returns {string}
 */
export function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const pad = (part) => String(part).padStart(2, '0');
  const clock = [
    Math.floor((totalSeconds % 86_400) / 3600),
    Math.floor((totalSeconds % 3600) / 60),
    totalSeconds % 60,
  ].map(pad).join(':');
  return days > 0 ? `${days}д ${clock}` : clock;
}

/**
 * «Настенные часы» сервера: в какой зоне считать даты расписания.
 * Без utcOffsetMinutes — часовой пояс посетителя (как в Date), иначе — фиксированное смещение от UTC.
 * @param {number | undefined} offsetMinutes
 */
function wallClock(offsetMinutes) {
  if (typeof offsetMinutes !== 'number') {
    return {
      parts: (ms) => {
        const date = new Date(ms);
        return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate(), weekday: date.getDay() };
      },
      toMs: (year, month, day, hour, minute) => new Date(year, month, day, hour, minute).getTime(),
    };
  }
  const shift = offsetMinutes * 60_000;
  return {
    parts: (ms) => {
      const date = new Date(ms + shift);
      return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate(), weekday: date.getUTCDay() };
    },
    toMs: (year, month, day, hour, minute) => Date.UTC(year, month, day, hour, minute) - shift,
  };
}

/**
 * Первый старт события, который ещё не закончился к моменту now (в мс).
 * @param {Schedule} schedule
 * @param {number} nowMs
 * @returns {number | null}
 */
function firstUnfinishedStart(schedule, nowMs) {
  const hour = schedule.hour ?? 0;
  const minute = schedule.minute ?? 0;
  const durationMs = (schedule.durationHours ?? 0) * MS_IN_HOUR;
  const clock = wallClock(schedule.utcOffsetMinutes);
  const today = clock.parts(nowMs);
  const isFinished = (startMs) => startMs + durationMs <= nowMs;

  if (schedule.type === 'yearly') {
    let year = today.year - 1;
    while (isFinished(clock.toMs(year, schedule.month - 1, schedule.day, hour, minute))) year += 1;
    return clock.toMs(year, schedule.month - 1, schedule.day, hour, minute);
  }

  if (schedule.type === 'weekly') {
    let day = today.day - (wrapIndex(today.weekday - schedule.weekday, DAYS_IN_WEEK) + DAYS_IN_WEEK);
    while (isFinished(clock.toMs(today.year, today.month, day, hour, minute))) day += DAYS_IN_WEEK;
    return clock.toMs(today.year, today.month, day, hour, minute);
  }

  return null;
}

/**
 * Состояние повторяющегося события: идёт сейчас или когда начнётся.
 * @param {Schedule | null | undefined} schedule
 * @param {Date} now
 * @returns {EventStatus | null}
 */
export function eventStatus(schedule, now) {
  if (!schedule || typeof schedule !== 'object') return null;
  const nowMs = now.getTime();
  const startMs = firstUnfinishedStart(schedule, nowMs);
  if (startMs === null) return null;

  const isLive = startMs <= nowMs;
  const endMs = startMs + (schedule.durationHours ?? 0) * MS_IN_HOUR;
  return Object.freeze({
    state: isLive ? 'live' : 'upcoming',
    start: new Date(startMs),
    msLeft: isLive ? endMs - nowMs : startMs - nowMs,
  });
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {Rect} rect
 * @returns {boolean}
 */
export function circleIntersectsRect(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  return (cx - nearestX) ** 2 + (cy - nearestY) ** 2 <= radius * radius;
}

/**
 * @param {ReadonlyArray<{x: number, y: number}>} points
 * @returns {Rect | null}
 */
export function boundsOfPoints(points) {
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * Детектор чит-кодов GTA SA: принимает клавиши по одной, возвращает код или null.
 * @param {ReadonlyArray<string>} codes
 * @returns {(key: string) => string | null}
 */
export function createCheatDetector(codes) {
  const normalized = codes.map((code) => String(code).toUpperCase()).filter(Boolean);
  const maxLength = normalized.reduce((max, code) => Math.max(max, code.length), 0);
  let buffer = '';

  return function detect(key) {
    if (typeof key !== 'string' || !LETTER_RE.test(key)) return null;
    buffer = (buffer + key.toUpperCase()).slice(-maxLength);
    const found = normalized.find((code) => buffer.endsWith(code));
    if (!found) return null;
    buffer = '';
    return found;
  };
}

/**
 * Латинская буква физической клавиши: на русской раскладке «р» → «H».
 * @param {{code?: string, key: string}} event
 * @returns {string}
 */
export function latinKey({ code, key }) {
  return typeof code === 'string' && /^Key[A-Z]$/.test(code) ? code.slice(3) : key;
}

/**
 * Срабатывает, когда за windowMs набралось count событий подряд (для «уровня розыска»).
 * @param {{count: number, windowMs: number}} options
 * @returns {(timeMs: number) => boolean}
 */
export function createBurstCounter({ count, windowMs }) {
  let stamps = [];
  return function hit(timeMs) {
    stamps = [...stamps, timeMs].filter((stamp) => timeMs - stamp <= windowMs);
    if (stamps.length < count) return false;
    stamps = [];
    return true;
  };
}

/**
 * true, если ссылка настроена: http(s) или относительный путь к файлу.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isConfiguredUrl(url) {
  if (typeof url !== 'string') return false;
  const value = url.trim();
  if (value === '' || value.startsWith('#')) return false;
  try {
    const { protocol } = new URL(value, URL_BASE);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Адрес сервера в формате host:port (IPv4 или домен).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isServerAddress(value) {
  if (typeof value !== 'string') return false;
  const match = HOST_PORT_RE.exec(value.trim());
  if (!match) return false;
  const port = Number(match[2]);
  return port >= 1 && port <= MAX_PORT;
}

/**
 * Онлайн из ответа https://api.open.mp/servers/{ip:port}.
 * @param {unknown} data
 * @returns {{players: number, max: number} | null}
 */
export function parseOnline(data) {
  if (!data || typeof data !== 'object' || data.active === false) return null;
  const core = data.core;
  if (!core || typeof core !== 'object') return null;
  const { pc, pm } = core;
  const isValid = Number.isInteger(pc) && Number.isInteger(pm) && pc >= 0 && pm > 0;
  return isValid ? Object.freeze({ players: pc, max: pm }) : null;
}
