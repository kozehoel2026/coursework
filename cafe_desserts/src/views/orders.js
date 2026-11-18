// Сторінки замовлень: нове замовлення (F3), список (F5), деталі та скасування (F6).
import { Role } from '../config.js';
import { html, money } from '../core/html.js';
import { sourceLabel, statusBadge, thumb } from './partials.js';

const stockText = (stock, lowStock) => {
  if (stock === 0) return html`<span class="text-out">немає</span>`;
  if (stock < lowStock) return html`<span class="text-low">залишилось ${stock}</span>`;
  return `є ${stock} шт.`;
};

export const orderRow = (d, qty, lowStock) => {
  const disabled = d.stock === 0;
  return html`
    <div class="order-row selectable ${disabled && 'soldout'} ${qty > 0 && 'is-selected'}" data-id="${d.id}">
      <button type="button" class="pick" data-step="1" ${disabled && 'disabled'}
              aria-label="Додати «${d.name}»">${thumb(d.image)}</button>
      <div class="order-info">
        <b>${d.name}</b>
        <span class="muted small">${d.category} · ${money(d.price)} грн · ${stockText(d.stock, lowStock)}</span>
      </div>
      <div class="qty">
        <button type="button" class="qbtn" data-step="-1" ${disabled && 'disabled'} aria-label="Менше">−</button>
        <input type="number" name="qty_${d.id}" min="0" max="${d.stock}" value="${qty}"
               data-price="${d.price}" data-name="${d.name}" ${disabled && 'disabled'}>
        <button type="button" class="qbtn" data-step="1" ${disabled && 'disabled'} aria-label="Більше">+</button>
      </div>
    </div>`;
};

/** quantities — Map «id десерту -> кількість» (щоб після помилки форма не очищалась). */
export const newOrderView = ({ desserts, quantities = new Map(), note = '', lowStock }) => html`
<h1>Нове замовлення</h1>
<form method="post" id="order-form" class="order-layout">
  <div class="order-list">
    ${desserts.map((d) => orderRow(d, quantities.get(d.id) ?? 0, lowStock))}
  </div>

  <aside class="panel receipt">
    <h2>Чек</h2>
    <ul id="receipt-lines" class="receipt-lines"><li class="muted">Порожньо</li></ul>
    <div class="total">Разом: <span id="total">0.00</span> грн</div>
    <label>Примітка (необов'язково)
      <input name="note" maxlength="200" value="${note}" placeholder="напр., на виніс">
    </label>
    <button class="btn wide">Оформити замовлення</button>
  </aside>
</form>`;

export const ordersView = ({ orders, user }) => html`
<div class="head-row">
  <h1>${user.role === Role.ADMIN ? 'Усі замовлення' : 'Мої замовлення'}</h1>
  <a class="btn" href="/order/new">+ Нове</a>
</div>
<div class="table-wrap">
<table class="table">
  <thead><tr><th>№</th><th>Дата і час</th><th>Оформив</th><th>Позицій</th><th>Сума, грн</th><th>Статус</th></tr></thead>
  <tbody>
  ${orders.length
    ? orders.map((o) => html`
    <tr class="clickable" data-href="/orders/${o.id}">
      <td data-label="№"><a href="/orders/${o.id}">${o.id}</a></td>
      <td data-label="Дата">${o.created_at}</td>
      <td data-label="Оформив">${sourceLabel(o)}</td>
      <td data-label="Позицій">${o.items_count ?? 0}</td>
      <td data-label="Сума">${money(o.total)}</td>
      <td data-label="Статус">${statusBadge(o.status)}</td>
    </tr>`)
    : html`<tr><td colspan="6" class="muted">Замовлень ще немає.</td></tr>`}
  </tbody>
</table>
</div>`;

export const orderDetailView = ({ order, items, user, canCancel }) => html`
<div class="narrow panel">
  <h1>Замовлення №${order.id}</h1>
  <p class="muted">${order.created_at} · ${sourceLabel(order)} · ${statusBadge(order.status)}</p>
  ${order.customer_note && html`<p>Примітка: ${order.customer_note}</p>`}
  <ul class="receipt-lines">
    ${items.map((it) => html`
      <li><span>${it.name} × ${it.quantity} <span class="muted small">(${money(it.price)})</span></span>
          <span>${money(it.price * it.quantity)}</span></li>`)}
  </ul>
  <div class="total">Разом: ${money(order.total)} грн</div>

  <div class="actions">
    <a class="btn ghost" href="/orders">← До списку</a>
    ${user.role === Role.ADMIN && canCancel && html`
    <form method="post" action="/orders/${order.id}/cancel" data-confirm="Скасувати замовлення і повернути залишки?">
      <button class="btn danger">Скасувати замовлення</button>
    </form>`}
  </div>
</div>`;
