import test from 'node:test';
import assert from 'node:assert/strict';
import * as U from '../js/utils.js';

const NBSP = ' ';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

test('clamp keeps a value inside the range', () => {
  assert.equal(U.clamp(5, 0, 10), 5);
  assert.equal(U.clamp(-3, 0, 10), 0);
  assert.equal(U.clamp(42, 0, 10), 10);
});

test('damp moves towards the target and never overshoots', () => {
  const step = U.damp(0, 10, 8, 1 / 60);
  assert.ok(step > 0 && step < 10);
  assert.equal(U.damp(3, 3, 8, 0.5), 3);
  assert.ok(Math.abs(U.damp(0, 10, 8, 10) - 10) < 1e-6);
});

test('progressBetween maps a value into 0..1 and clamps outside', () => {
  assert.equal(U.progressBetween(50, 0, 100), 0.5);
  assert.equal(U.progressBetween(-10, 0, 100), 0);
  assert.equal(U.progressBetween(500, 0, 100), 1);
  assert.equal(U.progressBetween(5, 5, 5), 1);
});

test('wrapIndex loops negative and overflowing indexes', () => {
  assert.equal(U.wrapIndex(-1, 6), 5);
  assert.equal(U.wrapIndex(6, 6), 0);
  assert.equal(U.wrapIndex(13, 6), 1);
  assert.equal(U.wrapIndex(3, 0), 0);
});

test('wrapOffset returns the shortest signed distance on a ring', () => {
  assert.equal(U.wrapOffset(5, 6), -1);
  assert.equal(U.wrapOffset(-5, 6), 1);
  assert.equal(U.wrapOffset(2, 6), 2);
  assert.equal(U.wrapOffset(0.5, 6), 0.5);
});

test('snapTarget rounds to the nearest slide and follows a flick', () => {
  assert.equal(U.snapTarget(2.4, 0), 2);
  assert.equal(U.snapTarget(2.4, 3), 3);
  assert.equal(U.snapTarget(2.6, -3), 2);
});

test('snapTarget never skips more than two slides on a hard flick', () => {
  assert.equal(U.snapTarget(1, 400), 3);
  assert.equal(U.snapTarget(1, -400), -1);
});

test('formatNumber groups thousands with non-breaking spaces', () => {
  assert.equal(U.formatNumber(1234567), `1${NBSP}234${NBSP}567`);
  assert.equal(U.formatNumber(999), '999');
  assert.equal(U.formatNumber('x'), '0');
});

test('pluralRu picks the Russian plural form', () => {
  const forms = ['день', 'дня', 'дней'];
  assert.equal(U.pluralRu(1, forms), 'день');
  assert.equal(U.pluralRu(3, forms), 'дня');
  assert.equal(U.pluralRu(5, forms), 'дней');
  assert.equal(U.pluralRu(11, forms), 'дней');
  assert.equal(U.pluralRu(21, forms), 'день');
  assert.equal(U.pluralRu(112, forms), 'дней');
});

test('formatCountdown shows days only when there are any', () => {
  assert.equal(U.formatCountdown(2 * DAY + 3 * HOUR + 4 * 60_000 + 5_000), '2д 03:04:05');
  assert.equal(U.formatCountdown(59_000), '00:00:59');
});

test('formatCountdown returns an empty string for past or invalid time', () => {
  assert.equal(U.formatCountdown(0), '');
  assert.equal(U.formatCountdown(-500), '');
  assert.equal(U.formatCountdown(Number.NaN), '');
});

test('eventStatus finds the next yearly date in the same year', () => {
  const now = new Date(2026, 9, 16, 12, 0);
  const status = U.eventStatus({ type: 'yearly', month: 10, day: 31, hour: 20, durationHours: 6 }, now);
  assert.equal(status.state, 'upcoming');
  assert.deepEqual(status.start, new Date(2026, 9, 31, 20, 0));
});

test('eventStatus rolls a passed yearly event over to next year', () => {
  const now = new Date(2026, 10, 2, 12, 0);
  const status = U.eventStatus({ type: 'yearly', month: 10, day: 31, hour: 20, durationHours: 6 }, now);
  assert.deepEqual(status.start, new Date(2027, 9, 31, 20, 0));
});

test('eventStatus reports a yearly event that crosses midnight as live', () => {
  const now = new Date(2027, 0, 1, 1, 30);
  const status = U.eventStatus({ type: 'yearly', month: 12, day: 31, hour: 22, durationHours: 6 }, now);
  assert.equal(status.state, 'live');
  assert.equal(status.msLeft, 2.5 * HOUR);
});

test('eventStatus finds the next weekly slot later the same day', () => {
  const friday = new Date(2026, 9, 16, 12, 0);
  const status = U.eventStatus({ type: 'weekly', weekday: 5, hour: 22, durationHours: 3 }, friday);
  assert.equal(status.state, 'upcoming');
  assert.equal(status.msLeft, 10 * HOUR);
});

test('eventStatus keeps a weekly event live after midnight', () => {
  const saturdayNight = new Date(2026, 9, 17, 0, 30);
  const status = U.eventStatus({ type: 'weekly', weekday: 5, hour: 22, durationHours: 3 }, saturdayNight);
  assert.equal(status.state, 'live');
  assert.deepEqual(status.start, new Date(2026, 9, 16, 22, 0));
});

test('eventStatus moves a finished weekly event to next week', () => {
  const lateFriday = new Date(2026, 9, 17, 2, 0);
  const status = U.eventStatus({ type: 'weekly', weekday: 5, hour: 22, durationHours: 3 }, lateFriday);
  assert.equal(status.state, 'upcoming');
  assert.deepEqual(status.start, new Date(2026, 9, 23, 22, 0));
});

test('eventStatus counts down to server time regardless of the visitor timezone', () => {
  // 09:00 UTC = 12:00 по Москве, пятница; старт в 22:00 МСК = 19:00 UTC.
  const now = new Date(Date.UTC(2026, 9, 16, 9, 0));
  const schedule = { type: 'weekly', weekday: 5, hour: 22, durationHours: 3, utcOffsetMinutes: 180 };
  const status = U.eventStatus(schedule, now);
  assert.equal(status.state, 'upcoming');
  assert.equal(status.start.getTime(), Date.UTC(2026, 9, 16, 19, 0));
  assert.equal(status.msLeft, 10 * HOUR);
});

test('eventStatus uses the server date when it differs from the UTC date', () => {
  // 22:30 UTC 30 октября = 01:30 МСК 31 октября: ивент 31.10 в 20:00 МСК ещё впереди в тот же день.
  const now = new Date(Date.UTC(2026, 9, 30, 22, 30));
  const schedule = { type: 'yearly', month: 10, day: 31, hour: 20, durationHours: 6, utcOffsetMinutes: 180 };
  const status = U.eventStatus(schedule, now);
  assert.equal(status.start.getTime(), Date.UTC(2026, 9, 31, 17, 0));
  assert.equal(status.msLeft, 18.5 * HOUR);
});

test('eventStatus returns null for an unknown schedule', () => {
  assert.equal(U.eventStatus({ type: 'monthly' }, new Date()), null);
  assert.equal(U.eventStatus(null, new Date()), null);
});

test('circleIntersectsRect detects overlap, touching and misses', () => {
  const rect = { x: 100, y: 100, w: 50, h: 20 };
  assert.equal(U.circleIntersectsRect(125, 110, 5, rect), true);
  assert.equal(U.circleIntersectsRect(90, 110, 10, rect), true);
  assert.equal(U.circleIntersectsRect(80, 80, 10, rect), false);
});

test('boundsOfPoints wraps points into a rectangle', () => {
  assert.deepEqual(U.boundsOfPoints([{ x: 4, y: 9 }, { x: -2, y: 3 }, { x: 1, y: 12 }]), { x: -2, y: 3, w: 6, h: 9 });
  assert.equal(U.boundsOfPoints([]), null);
});

test('createCheatDetector detects a code typed among other keys', () => {
  const detect = U.createCheatDetector(['HESOYAM', 'AEZAKMI']);
  const results = 'xxhesoyam'.split('').map(detect);
  assert.equal(results.at(-1), 'HESOYAM');
  assert.ok(results.slice(0, -1).every((result) => result === null));
});

test('createCheatDetector ignores non-letters and resets after a hit', () => {
  const detect = U.createCheatDetector(['AEZAKMI']);
  assert.equal(detect('1'), null);
  assert.equal(detect('Shift'), null);
  'AEZAKM'.split('').forEach(detect);
  assert.equal(detect('i'), 'AEZAKMI');
  assert.equal(detect('i'), null);
});

test('latinKey reads the physical key so cheats work on a Russian layout', () => {
  assert.equal(U.latinKey({ code: 'KeyH', key: 'р' }), 'H');
  assert.equal(U.latinKey({ code: 'KeyA', key: 'a' }), 'A');
  assert.equal(U.latinKey({ code: 'Digit1', key: '1' }), '1');
  assert.equal(U.latinKey({ key: 'h' }), 'h');
});

test('createBurstCounter fires only when clicks are fast enough', () => {
  const burst = U.createBurstCounter({ count: 3, windowMs: 1000 });
  assert.equal(burst(0), false);
  assert.equal(burst(400), false);
  assert.equal(burst(2000), false);
  assert.equal(burst(2300), false);
  assert.equal(burst(2600), true);
  assert.equal(burst(2700), false);
});

test('isConfiguredUrl accepts http(s) and relative files, rejects placeholders', () => {
  assert.equal(U.isConfiguredUrl('https://example.com/launcher.exe'), true);
  assert.equal(U.isConfiguredUrl('files/launcher.exe'), true);
  assert.equal(U.isConfiguredUrl(''), false);
  assert.equal(U.isConfiguredUrl('#'), false);
  assert.equal(U.isConfiguredUrl('javascript:alert(1)'), false);
  assert.equal(U.isConfiguredUrl(42), false);
});

test('isServerAddress validates host:port pairs', () => {
  assert.equal(U.isServerAddress('51.195.126.182:7777'), true);
  assert.equal(U.isServerAddress('play.purple-dynasty.ru:7777'), true);
  assert.equal(U.isServerAddress('51.195.126.182'), false);
  assert.equal(U.isServerAddress('host:99999'), false);
  assert.equal(U.isServerAddress(null), false);
});

test('parseOnline reads players from the open.mp API answer', () => {
  assert.deepEqual(U.parseOnline({ active: true, core: { pc: 312, pm: 1000 } }), { players: 312, max: 1000 });
  assert.equal(U.parseOnline({ active: false, core: { pc: 1, pm: 10 } }), null);
  assert.equal(U.parseOnline({ core: { pc: -1, pm: 10 } }), null);
  assert.equal(U.parseOnline('nope'), null);
});
