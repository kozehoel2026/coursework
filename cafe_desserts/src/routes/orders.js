// Замовлення персоналу: оформлення на касі (F3, F4, F12), список і деталі (F5), скасування (F6).
import { OrderSource, OrderStatus, Role } from '../config.js';
import { HttpError } from '../core/errors.js';
import { adminRequired, loginRequired } from '../core/guards.js';
import {
  ACTIVE_DESSERTS_SQL, OutOfStockError, cancelOrder as cancelOrderInDb, collectItems, placeOrder,
} from '../services/orders.js';
import { newOrderView, orderDetailView, ordersView } from '../views/orders.js';

const ORDER_SCRIPTS = ['/static/js/order.js'];

// Замовлення разом з ім'ям працівника (LEFT JOIN — у замовлення клієнта до видачі його немає)
const ORDER_WITH_STAFF_SQL = `
  SELECT o.*, u.full_name AS cashier,
         (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS items_count
  FROM orders o LEFT JOIN users u ON u.id = o.user_id`;

export function registerOrderRoutes(router) {
  router.get('/order/new', loginRequired(showNewOrder));
  router.post('/order/new', loginRequired(createOrder));
  router.get('/orders', loginRequired(listOrders));
  router.get('/orders/:orderId', loginRequired(orderDetail));
  router.post('/orders/:orderId/cancel', adminRequired(cancelOrder));
}

function showNewOrder(ctx) {
  const desserts = ctx.db.all(ACTIVE_DESSERTS_SQL);
  ctx.render(newOrderView, { title: 'Нове замовлення', desserts, scripts: ORDER_SCRIPTS });
}

async function createOrder(ctx) {
  const { db } = ctx;
  const form = await ctx.form();
  const desserts = db.all(ACTIVE_DESSERTS_SQL);
  const { quantities, items, errors } = collectItems(desserts, form);
  const note = String(form.get('note') ?? '').trim().slice(0, 200);

  if (errors.length) {
    errors.forEach((message) => ctx.flash(message, 'error'));
    return ctx.render(newOrderView,
      { title: 'Нове замовлення', desserts, quantities, note, scripts: ORDER_SCRIPTS });
  }

  try {
    const { id, total } = placeOrder(db, { items, note, userId: ctx.user.id });
    ctx.flash(`Замовлення №${id} оформлено на суму ${total.toFixed(2)} грн.`, 'success');
    ctx.redirect(`/orders/${id}`);
  } catch (err) {
    if (!(err instanceof OutOfStockError)) throw err;
    ctx.flash(`«${err.message}» щойно закінчився. Оновіть замовлення.`, 'error');
    ctx.redirect('/order/new');
  }
}

function listOrders(ctx) {
  const { user } = ctx;
  let sql = ORDER_WITH_STAFF_SQL;
  const params = [];
  if (user.role === Role.CASHIER) {   // касир бачить лише свої (зокрема видані ним замовлення клієнтів)
    sql += ' WHERE o.user_id = ?';
    params.push(user.id);
  }
  const orders = ctx.db.all(`${sql} ORDER BY o.id DESC LIMIT 200`, ...params);
  ctx.render(ordersView, { title: 'Замовлення', orders });
}

function orderDetail(ctx) {
  const { db, user } = ctx;
  const { orderId } = ctx.params;
  const order = db.get(`${ORDER_WITH_STAFF_SQL} WHERE o.id = ?`, orderId);
  if (!order) throw new HttpError(404);
  // касир бачить свої замовлення та будь-які замовлення клієнтів
  const allowed = user.role === Role.ADMIN || order.user_id === user.id || order.source === OrderSource.KIOSK;
  if (!allowed) throw new HttpError(403);

  const items = db.all(
    `SELECT oi.*, d.name FROM order_items oi
     JOIN desserts d ON d.id = oi.dessert_id WHERE oi.order_id = ?`, orderId);
  ctx.render(orderDetailView, {
    title: `Замовлення №${order.id}`, order, items, canCancel: order.status !== OrderStatus.CANCELLED,
  });
}

function cancelOrder(ctx) {
  const { db } = ctx;
  const { orderId } = ctx.params;
  if (!db.get('SELECT 1 FROM orders WHERE id = ?', orderId)) throw new HttpError(404);

  if (cancelOrderInDb(db, orderId)) {
    ctx.flash(`Замовлення №${orderId} скасовано, залишки повернено.`, 'success');
  } else {
    ctx.flash('Замовлення вже скасоване.', 'error');
  }
  ctx.redirect(`/orders/${orderId}`);
}
