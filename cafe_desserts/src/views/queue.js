// Черга замовлень від клієнтів (для персоналу).
import { OrderStatus } from '../config.js';
import { html, money } from '../core/html.js';

const timeOf = (dateTime) => String(dateTime).slice(11, 16);   // "2026-11-09 14:05:33" -> "14:05"

const actionButton = (order) =>
  order.status === OrderStatus.NEW
    ? html`<form method="post" action="/queue/${order.id}/ready">
        <button class="btn">🔔 Готове</button></form>`
    : html`<form method="post" action="/queue/${order.id}/issue">
        <button class="btn success">✅ Видано й оплачено</button></form>`;

const ticket = (order) => html`
  <article class="ticket ${order.status}" data-id="${order.id}">
    <header>
      <span class="ticket-number">№${order.id}</span>
      <span class="muted small">${timeOf(order.created_at)}</span>
    </header>
    ${order.customer_name && html`<p class="ticket-name">👤 ${order.customer_name}</p>`}
    <ul class="ticket-items">
      ${order.items.map((it) => html`<li><b>${it.quantity}×</b> ${it.name}</li>`)}
    </ul>
    ${order.customer_note && html`<p class="ticket-note">💬 ${order.customer_note}</p>`}
    <div class="ticket-total">До сплати: <b>${money(order.total)} грн</b></div>
    <div class="ticket-actions">
      ${actionButton(order)}
      <form method="post" action="/queue/${order.id}/cancel" data-confirm="Скасувати замовлення №${order.id}?">
        <button class="btn small ghost">Скасувати</button>
      </form>
      <a class="small" href="/orders/${order.id}">деталі</a>
    </div>
  </article>`;

const column = (title, hint, orders) => html`
  <section class="queue-col">
    <h2>${title} <span class="count">${orders.length}</span></h2>
    <p class="muted small">${hint}</p>
    ${orders.length ? orders.map(ticket) : html`<p class="muted empty">Порожньо</p>`}
  </section>`;

/** Дошка з двома колонками; columns — Map(статус -> замовлення). */
export const queueBoard = ({ columns }) => html`
  ${column('👩‍🍳 Готуються', 'Нові замовлення від клієнтів', columns.get(OrderStatus.NEW))}
  ${column('🔔 Готові до видачі', 'Клієнт підходить на касу, називає номер і оплачує', columns.get(OrderStatus.READY))}`;

export const queueView = ({ columns }) => html`
<div class="head-row">
  <h1>Черга замовлень</h1>
  <span class="muted small live">● оновлюється автоматично</span>
</div>
<div class="queue-board" id="queue-board">${queueBoard({ columns })}</div>`;
