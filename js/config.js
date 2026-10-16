/**
 * Настройки сайта Purple Dynasty RP.
 * Меняй значения только здесь — остальной код трогать не нужно.
 */

export const SITE = Object.freeze({
  // IP и порт сервера: показываются на сайте и копируются по клику.
  serverAddress: '127.0.0.1:7777',

  // Лаунчер: https://... или путь к файлу на сайте, например 'files/PurpleDynasty.exe'.
  // Пока пусто — кнопка покажет подсказку «скоро».
  launcherUrl: '',
  launcherNote: 'Windows 10 / 11 · около 30 МБ',

  // Официальный клиент open.mp (совместим с SA-MP 0.3.7) — для ручной установки.
  clientUrl: 'https://www.open.mp/',

  // Онлайн берётся из публичного API open.mp (сервер должен быть в его списке).
  // null — не показывать цифры онлайна.
  onlineApi: 'https://api.open.mp/servers/',

  // Соцсети. Пустая строка — кнопка покажет «скоро появится».
  socials: Object.freeze({
    vk: '',
    telegram: '',
    discord: '',
    youtube: '',
  }),
});

// Время сервера: ивенты стартуют по Москве (UTC+3) у всех — и в Калининграде, и в Новосибирске.
const SERVER_UTC_OFFSET_MINUTES = 180;

/**
 * Ивенты для карусели. Время в расписании — серверное (см. SERVER_UTC_OFFSET_MINUTES). schedule:
 *   { type: 'yearly', month, day, hour, durationHours } — раз в год;
 *   { type: 'weekly', weekday (0 — вс, 5 — пт), hour, durationHours } — раз в неделю.
 * Сайт сам считает, сколько осталось до старта, и пишет «Идёт сейчас», когда ивент начался.
 * Фото — свободная лицензия CC0 / Public Domain (каталог Openverse).
 */
export const EVENTS = Object.freeze([
  Object.freeze({
    id: 'halloween',
    tag: 'Хэллоуин',
    title: 'Ночь тыкв',
    text: 'Город гаснет, на улицы выходят те, кого не ждали. Квест по заброшкам Лас-Вентураса, костюмы и приз за самую жуткую тыкву.',
    big: '31.10',
    schedule: Object.freeze({ type: 'yearly', month: 10, day: 31, hour: 20, durationHours: 6, utcOffsetMinutes: SERVER_UTC_OFFSET_MINUTES }),
    image: 'https://live.staticflickr.com/65535/52475161753_0fd00bca2b_b.jpg',
    credit: 'Alabama Extension · CC0',
  }),
  Object.freeze({
    id: 'races',
    tag: 'Каждую пятницу',
    title: 'Король ночи',
    text: 'Трасса от Сан-Фиерро до Лас-Вентураса, сотня тюнингованных тачек и одно правило: последний платит за всех.',
    big: '22:00',
    schedule: Object.freeze({ type: 'weekly', weekday: 5, hour: 22, durationHours: 3, utcOffsetMinutes: SERVER_UTC_OFFSET_MINUTES }),
    image: 'https://live.staticflickr.com/5589/14411447439_1e570148f1_b.jpg',
    credit: 'Flickr · CC0',
  }),
  Object.freeze({
    id: 'casino',
    tag: 'Каждую субботу',
    title: "Caligula's Royale",
    text: 'Покерный турнир, рулетка без лимитов и дресс-код «только чёрное». Фишки выдаём — совесть оставь на входе.',
    big: '777',
    schedule: Object.freeze({ type: 'weekly', weekday: 6, hour: 21, durationHours: 4, utcOffsetMinutes: SERVER_UTC_OFFSET_MINUTES }),
    image:
      'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvaXMxNDk0NC1pbWFnZS1rd3Z5Z2p1dS5qcGc.jpg',
    credit: 'rawpixel · CC0',
  }),
  Object.freeze({
    id: 'new-year',
    tag: 'Новый год',
    title: 'Бал династий',
    text: 'Салют над Лос-Сантосом, ёлка у мэрии и подарки каждому, кто отыграет праздник до полуночи.',
    big: '31.12',
    schedule: Object.freeze({ type: 'yearly', month: 12, day: 31, hour: 22, durationHours: 6, utcOffsetMinutes: SERVER_UTC_OFFSET_MINUTES }),
    image:
      'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJmaXJld29ya3NfZXhwbG9zaW9uX25pZ2h0X3NreS1pbWFnZS1reWJkcjA0YS5qcGc.jpg',
    credit: 'rawpixel · CC0',
  }),
  Object.freeze({
    id: 'valentine',
    tag: 'День влюблённых',
    title: 'Свидание в Vinewood',
    text: 'Парные квесты, ужин на крыше небоскрёба и розыгрыш кабриолета на двоих.',
    big: '14.02',
    schedule: Object.freeze({ type: 'yearly', month: 2, day: 14, hour: 19, durationHours: 5, utcOffsetMinutes: SERVER_UTC_OFFSET_MINUTES }),
    image:
      'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4NzE5ODAwLWltYWdlLWt3dnY0NG1sLmpwZw.jpg',
    credit: 'rawpixel · CC0',
  }),
  Object.freeze({
    id: 'beach',
    tag: 'Летний фестиваль',
    title: 'Santa Maria Fest',
    text: 'Пляж, музыка до рассвета, гонки на гидроциклах и бар, где всегда наливают.',
    big: '01.07',
    schedule: Object.freeze({ type: 'yearly', month: 7, day: 1, hour: 18, durationHours: 8, utcOffsetMinutes: SERVER_UTC_OFFSET_MINUTES }),
    image:
      'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4Mjg0OTYtaW1hZ2Uta3d2dmdiNWEuanBn.jpg',
    credit: 'rawpixel · CC0',
  }),
]);
