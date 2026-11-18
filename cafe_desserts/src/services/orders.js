// Спільна логіка замовлень — нею користуються і касир (/order/new), і клієнт (кошик).
import { randomBytes } from 'node:crypto';

import { OrderSource, OrderStatus, QUEUE_STATUSES } from '../config.js';
import { toInt } from '../core/context.js';

export const ACTIVE_DESSERTS_SQL = `
  SELECT d.*, c.name AS category FROM desserts d
  JOIN categories c ON c.id = d.category_id
  WHERE d.is_active = 1 ORDER BY c.name, d.name`;

/** Помилка «десерт щойно закінчився» — скасовує всю транзакцію. */
export class OutOfStockError extends Error {
  constructor(dessertName) {
    super(dessertName);
    this.name = 'OutOfStockError';
  }
}

// округлення грошей до копійок (щоб 0.1 + 0.2 не давало 0.30000000000000004)
export const roundMoney = (value) => Math.round(value * 100) / 100;

/**
 * Зчитує кількості з форми (поля qty_<id>) і перевіряє їх.
 * Повертає { quantities: Map(id -> к-сть), items: [{ dessert, qty }], errors: [] }.
 */
export function collectItems(desserts, form) {
  const quantities = new Map();
  const items = [];
  const errors = [];
  for (const dessert of desserts) {
    const qty = toInt(form.get(`qty_${dessert.id}`)) ?? 0;
    quantities.set(dessert.id, qty);
    if (qty < 0) {
      errors.push(`Некоректна кількість для «${dessert.name}».`);
    } else if (qty > 0) {
      if (qty > dessert.stock) errors.push(`«${dessert.name}»: у наявності лише ${dessert.stock} шт.`);
      items.push({ dessert, qty });
    }
  }
  if (items.length === 0 && errors.length === 0) errors.push('Додайте хоча б один десерт.');
  return { quantities, items, errors };
}

/**
 * Створює замовлення і списує залишки в одній транзакції.
 * Сума рахується тут, на сервері — значенням із браузера не довіряємо.
 * Повертає { id, total, token }. Кидає OutOfStockError, якщо десерт закінчився.
 */
export function placeOrder(db, {
  items, note = '', userId = null, source = OrderSource.STAFF, customerName = '',
}) {
  const total = roundMoney(items.reduce((sum, { dessert, qty }) => sum + dessert.price * qty, 0));
  const isKiosk = source === OrderSource.KIOSK;
  const status = isKiosk ? OrderStatus.NEW : OrderStatus.DONE;
  const token = isKiosk ? randomBytes(16).toString('hex') : '';

  const id = db.transaction(() => {
    const { lastInsertRowid } = db.run(
      `INSERT INTO orders (user_id, total, customer_note, status, source, customer_name, token)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      userId, total, note, status, source, customerName, token);
    const orderId = Number(lastInsertRowid);
    for (const { dessert, qty } of items) {
      db.run('INSERT INTO order_items (order_id, dessert_id, quantity, price) VALUES (?, ?, ?, ?)',
        orderId, dessert.id, qty, dessert.price);
      // списання залишку; умова stock >= ? захищає від продажу «в мінус»
      const { changes } = db.run(
        'UPDATE desserts SET stock = stock - ? WHERE id = ? AND stock >= ?', qty, dessert.id, qty);
      if (changes === 0) throw new OutOfStockError(dessert.name);
    }
    return orderId;
  });
  return { id, total, token };
}

/** Скасування: повертає десерти на склад. Повертає false, якщо вже скасоване. */
export function cancelOrder(db, orderId) {
  return db.transaction(() => {
    const order = db.get('SELECT status FROM orders WHERE id = ?', orderId);
    if (!order || order.status === OrderStatus.CANCELLED) return false;
    for (const { quantity, dessert_id: dessertId } of db.all('SELECT * FROM order_items WHERE order_id = ?', orderId)) {
      db.run('UPDATE desserts SET stock = stock + ? WHERE id = ?', quantity, dessertId);
    }
    db.run("UPDATE orders SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
      OrderStatus.CANCELLED, orderId);
    return true;
  });
}

// Дозволені переходи статусів у черзі: зі статусу -> у статус
const TRANSITIONS = new Map([
  [OrderStatus.NEW, OrderStatus.READY],     // «Готове»
  [OrderStatus.READY, OrderStatus.DONE],    // «Видано й оплачено»
]);

/**
 * Переводить замовлення клієнта на наступний крок черги.
 * Під час видачі запам'ятовуємо працівника, який видав (для звітів і «Моїх замовлень»).
 */
export function advanceOrder(db, orderId, expectedStatus, staffId) {
  const next = TRANSITIONS.get(expectedStatus);
  if (!next) return false;
  const { changes } = db.run(
    `UPDATE orders SET status = ?, updated_at = datetime('now', 'localtime'),
            user_id = CASE WHEN ? = 'done' THEN ? ELSE user_id END
     WHERE id = ? AND status = ?`,
    next, next, staffId, orderId, expectedStatus);
  return changes > 0;
}

/** Кількість замовлень у черзі — для лічильника в меню персоналу. */
export const queueCount = (db) =>
  db.get(`SELECT COUNT(*) AS cnt FROM orders WHERE status IN (${[...QUEUE_STATUSES].map(() => '?').join(', ')})`,
    ...QUEUE_STATUSES).cnt;
