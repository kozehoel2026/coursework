// Черга замовлень від клієнтів (F15) — для касира й адміністратора.
// «Готується» -> кнопка «Готове» -> «Готове до видачі» -> кнопка «Видано» -> виконано.
import { OrderSource, OrderStatus } from '../config.js';
import { HttpError } from '../core/errors.js';
import { loginRequired } from '../core/guards.js';
import { advanceOrder, cancelOrder } from '../services/orders.js';
import { queueBoard, queueView } from '../views/queue.js';

export function registerQueueRoutes(router) {
  router
    .get('/queue', loginRequired(showQueue))
    .get('/queue/board', loginRequired(board))
    .post('/queue/:orderId/ready', loginRequired(step(OrderStatus.NEW, 'готове — клієнта покличуть на касу')))
    .post('/queue/:orderId/issue', loginRequired(step(OrderStatus.READY, 'видано та оплачено')))
    .post('/queue/:orderId/cancel', loginRequired(cancel));
}

/** Активні замовлення клієнтів, згруповані за статусом: Map(статус -> [замовлення з позиціями]). */
function loadQueue(db) {
  const orders = db.all(
    `SELECT * FROM orders WHERE source = ? AND status IN (?, ?) ORDER BY id`,
    OrderSource.KIOSK, OrderStatus.NEW, OrderStatus.READY);

  const itemsByOrder = Map.groupBy(
    orders.length
      ? db.all(
        `SELECT oi.order_id, oi.quantity, d.name FROM order_items oi
         JOIN desserts d ON d.id = oi.dessert_id
         WHERE oi.order_id IN (${orders.map(() => '?').join(', ')})`, ...orders.map((o) => o.id))
      : [],
    (item) => item.order_id,
  );

  const columns = new Map([[OrderStatus.NEW, []], [OrderStatus.READY, []]]);
  for (const order of orders) {
    columns.get(order.status).push({ ...order, items: itemsByOrder.get(order.id) ?? [] });
  }
  return columns;
}

function showQueue(ctx) {
  ctx.render(queueView, { title: 'Черга замовлень', columns: loadQueue(ctx.db), scripts: ['/static/js/queue.js'] });
}

/** Лише вміст дошки (HTML-фрагмент) — для автооновлення без перезавантаження сторінки. */
function board(ctx) {
  const columns = loadQueue(ctx.db);
  const count = [...columns.values()].reduce((sum, list) => sum + list.length, 0);
  ctx.res.setHeader('X-Queue-Count', String(count));
  ctx.send(String(queueBoard({ columns })));
}

function kioskOrder(ctx) {
  const order = ctx.db.get('SELECT * FROM orders WHERE id = ?', ctx.params.orderId);
  if (!order || order.source !== OrderSource.KIOSK) throw new HttpError(404);
  return order;
}

const step = (fromStatus, doneText) => (ctx) => {
  const order = kioskOrder(ctx);
  if (advanceOrder(ctx.db, order.id, fromStatus, ctx.user.id)) {
    ctx.flash(`Замовлення №${order.id}: ${doneText}.`, 'success');
  } else {
    ctx.flash(`Замовлення №${order.id} вже оброблено іншим працівником.`, 'error');
  }
  ctx.redirect('/queue');
};

function cancel(ctx) {
  const order = kioskOrder(ctx);
  // з черги можна скасувати лише ще не видане замовлення (наприклад, клієнт не прийшов)
  if (order.status !== OrderStatus.NEW && order.status !== OrderStatus.READY) {
    ctx.flash(`Замовлення №${order.id} вже не в черзі.`, 'error');
  } else if (cancelOrder(ctx.db, order.id)) {
    ctx.flash(`Замовлення №${order.id} скасовано, десерти повернено на склад.`, 'success');
  }
  ctx.redirect('/queue');
}
