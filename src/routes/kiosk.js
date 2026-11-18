// Самообслуговування (F13, F14): клієнт сам оформлює замовлення з меню,
// отримує номер і стежить за статусом, поки замовлення готують.
import { timingSafeEqual } from 'node:crypto';

import { STATUS_INFO, OrderSource, QUEUE_STATUSES, kioskLimits } from '../config.js';
import { toInt } from '../core/context.js';
import { HttpError } from '../core/errors.js';
import { RateLimiter } from '../core/rate-limit.js';
import { ACTIVE_DESSERTS_SQL, OutOfStockError, collectItems, placeOrder } from '../services/orders.js';
import { cartView, trackView } from '../views/kiosk.js';

const CART_SCRIPTS = ['/static/js/order.js'];
const limiter = new RateLimiter(kioskLimits.maxOrdersPerWindow, kioskLimits.windowMs);

export function registerKioskRoutes(router) {
  router
    .get('/cart', showCart)
    .post('/cart', submitCart)
    .get('/my-order/:orderId', trackOrder)
    .get('/my-order/:orderId/status', orderStatus);
}

/** "3:2,5:1" -> Map { 3 => 2, 5 => 1 }  (так меню передає вибрані десерти) */
const parseItems = (text = '') =>
  new Map(
    text.split(',')
      .map((pair) => pair.split(':').map(toInt))
      .filter(([id, qty]) => id > 0 && qty > 0),
  );

function renderCart(ctx, { desserts, quantities, name = '', note = '' }) {
  ctx.render(cartView, {
    title: 'Ваше замовлення', desserts, quantities, name, note, scripts: CART_SCRIPTS,
  });
}

function showCart(ctx) {
  const quantities = parseItems(ctx.query.get('items') ?? '');
  const desserts = ctx.db.all(ACTIVE_DESSERTS_SQL).filter((d) => quantities.has(d.id) && d.stock > 0);
  if (desserts.length === 0) {
    ctx.flash('Спершу виберіть десерти в меню.', 'error');
    return ctx.redirect('/');
  }
  // кількість не більша за залишок
  for (const d of desserts) quantities.set(d.id, Math.min(quantities.get(d.id), d.stock));
  renderCart(ctx, { desserts, quantities });
}

async function submitCart(ctx) {
  const { db } = ctx;
  const form = await ctx.form();
  const allDesserts = db.all(ACTIVE_DESSERTS_SQL);
  const { quantities, items, errors } = collectItems(allDesserts, form);
  const name = String(form.get('customer_name') ?? '').trim().slice(0, 40);
  const note = String(form.get('note') ?? '').trim().slice(0, 200);

  const totalQty = items.reduce((sum, { qty }) => sum + qty, 0);
  if (totalQty > kioskLimits.maxItems) {
    errors.push(`В одному замовленні — не більше ${kioskLimits.maxItems} шт. Для великих замовлень зверніться до касира.`);
  }

  // на сторінці кошика показуємо лише ті десерти, що були в ньому
  const shown = allDesserts.filter((d) => form.has(`qty_${d.id}`));
  if (errors.length) {
    if (shown.length === 0) return ctx.redirect('/');
    errors.forEach((message) => ctx.flash(message, 'error'));
    return renderCart(ctx, { desserts: shown, quantities, name, note });
  }

  if (!limiter.try(ctx.ip)) {
    ctx.flash('Забагато замовлень за короткий час. Зверніться, будь ласка, до касира.', 'error');
    return renderCart(ctx, { desserts: shown, quantities, name, note });
  }

  try {
    const { id, token } = placeOrder(db, { items, note, source: OrderSource.KIOSK, customerName: name });
    // запам'ятовуємо замовлення в сесії гостя — меню покаже його статус
    const session = ctx.guestSession();
    session.myOrders = [...(session.myOrders ?? []), { id, token }].slice(-5);
    ctx.redirect(`/my-order/${id}?t=${token}`);
  } catch (err) {
    if (!(err instanceof OutOfStockError)) throw err;
    ctx.flash(`«${err.message}» щойно закінчився. Змініть, будь ласка, замовлення.`, 'error');
    renderCart(ctx, { desserts: shown, quantities, name, note });
  }
}

const sameToken = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
};

/** Замовлення клієнта за номером і секретним ключем із посилання. */
function findOwnOrder(ctx) {
  const order = ctx.db.get(
    'SELECT * FROM orders WHERE id = ? AND source = ?', ctx.params.orderId, OrderSource.KIOSK);
  if (!order || !sameToken(order.token, ctx.query.get('t') ?? '')) throw new HttpError(404);
  return order;
}

function trackOrder(ctx) {
  const order = findOwnOrder(ctx);
  const items = ctx.db.all(
    `SELECT oi.*, d.name FROM order_items oi
     JOIN desserts d ON d.id = oi.dessert_id WHERE oi.order_id = ?`, order.id);
  ctx.render(trackView, {
    title: `Замовлення №${order.id}`, order, items, scripts: ['/static/js/track.js'],
  });
}

function orderStatus(ctx) {
  const { status } = findOwnOrder(ctx);
  ctx.json({ status, label: STATUS_INFO.get(status)?.label ?? status });
}

/** Активні замовлення гостя (для плашки над меню). */
export function guestActiveOrders(ctx) {
  const mine = ctx.session?.myOrders ?? [];
  return mine
    .map(({ id, token }) => {
      const order = ctx.db.get('SELECT id, status, token FROM orders WHERE id = ?', id);
      return order && order.token === token && QUEUE_STATUSES.has(order.status) ? order : null;
    })
    .filter(Boolean);
}
