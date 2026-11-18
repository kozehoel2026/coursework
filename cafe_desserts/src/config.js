// Налаштування застосунку та довідкові константи.
import path from 'node:path';

export const BASE_DIR = path.dirname(import.meta.dirname);

export const config = Object.freeze({
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT) || 5000,
  dbPath: path.join(BASE_DIR, 'cafe.db'),
  schemaPath: path.join(BASE_DIR, 'schema.sql'),
  staticDir: path.join(BASE_DIR, 'static'),
  imgDir: path.join(BASE_DIR, 'static', 'img', 'desserts'),
  maxUploadBytes: 5 * 1024 * 1024,      // фото не більше 5 МБ
  lowStock: 3,                          // поріг попередження «закінчується»
  sessionTtlMs: 8 * 60 * 60 * 1000,     // сесія живе 8 годин без активності
});

// Ролі користувачів (аналог enum)
export const Role = Object.freeze({ ADMIN: 'admin', CASHIER: 'cashier' });

export const ROLE_LABELS = new Map([
  [Role.ADMIN, 'адмін'],
  [Role.CASHIER, 'касир'],
]);

// Статуси замовлення
export const OrderStatus = Object.freeze({
  NEW: 'new',             // клієнт оформив, готується
  READY: 'ready',         // готове, клієнта кличуть на касу
  DONE: 'done',           // видано (оплачено)
  CANCELLED: 'cancelled',
});

/** Статус -> { label: підпис, badge: CSS-клас значка } */
export const STATUS_INFO = new Map([
  [OrderStatus.NEW, { label: 'готується', badge: 'new' }],
  [OrderStatus.READY, { label: 'готове до видачі', badge: 'ready' }],
  [OrderStatus.DONE, { label: 'виконано', badge: 'ok' }],
  [OrderStatus.CANCELLED, { label: 'скасовано', badge: 'out' }],
]);

/** Активні замовлення клієнтів — ті, що стоять у черзі. */
export const QUEUE_STATUSES = new Set([OrderStatus.NEW, OrderStatus.READY]);

// Звідки надійшло замовлення
export const OrderSource = Object.freeze({ STAFF: 'staff', KIOSK: 'kiosk' });

// Обмеження для самообслуговування (захист від «жартівливих» замовлень)
export const kioskLimits = Object.freeze({
  maxItems: 30,                     // не більше 30 шт. в одному замовленні
  maxOrdersPerWindow: 5,            // не більше 5 замовлень...
  windowMs: 10 * 60 * 1000,         // ...за 10 хвилин з одного пристрою (IP)
});

// Дозволені розширення фото — множина: перевірка «чи входить» за O(1)
export const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
