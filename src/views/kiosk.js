// Сторінки для клієнта: кошик (підтвердження замовлення) і відстеження статусу.
import { OrderStatus } from '../config.js';
import { html, money } from '../core/html.js';
import { orderRow } from './orders.js';

/** quantities — Map «id десерту -> кількість» */
export const cartView = ({ desserts, quantities, name, note, lowStock }) => html`
<div class="head-row">
  <h1>Ваше замовлення</h1>
  <a class="btn ghost" href="/">← Змінити вибір</a>
</div>
<form method="post" action="/cart" id="order-form" class="order-layout">
  <div class="order-list">
    ${desserts.map((d) => orderRow(d, quantities.get(d.id) ?? 0, lowStock))}
  </div>

  <aside class="panel receipt">
    <h2>Чек</h2>
    <ul id="receipt-lines" class="receipt-lines"><li class="muted">Порожньо</li></ul>
    <div class="total">Разом: <span id="total">0.00</span> грн</div>
    <label>Ваше ім'я (щоб ми вас покликали)
      <input name="customer_name" maxlength="40" value="${name}" placeholder="напр., Олена" autocomplete="given-name">
    </label>
    <label>Побажання (необов'язково)
      <input name="note" maxlength="200" value="${note}" placeholder="напр., на виніс">
    </label>
    <p class="muted small pay-note">💳 Оплата — на касі, коли забираєте замовлення.</p>
    <button class="btn wide big">Підтвердити замовлення</button>
  </aside>
</form>`;

// Кроки, які бачить клієнт: [статус, значок, підпис]
const STEPS = [
  [OrderStatus.NEW, '👩‍🍳', 'Готуємо'],
  [OrderStatus.READY, '🔔', 'Готове'],
  [OrderStatus.DONE, '✅', 'Видано'],
];
const STEP_INDEX = new Map(STEPS.map(([status], i) => [status, i]));

const MESSAGES = new Map([
  [OrderStatus.NEW, 'Замовлення прийнято! Ми вже готуємо його — зачекайте, будь ласка, поруч із касою.'],
  [OrderStatus.READY, 'Ваше замовлення готове! Підійдіть на касу, назвіть номер і оплатіть.'],
  [OrderStatus.DONE, 'Замовлення видано. Смачного! 🍰'],
  [OrderStatus.CANCELLED, 'Замовлення скасовано. Якщо це помилка — зверніться до касира.'],
]);

export const trackView = ({ order, items }) => {
  const current = STEP_INDEX.get(order.status) ?? -1;
  return html`
<div class="narrow panel track" data-status="${order.status}"
     data-status-url="/my-order/${order.id}/status?t=${order.token}">
  <p class="muted center">Номер вашого замовлення</p>
  <div class="order-number">${order.id}</div>
  ${order.customer_name && html`<p class="center"><b>${order.customer_name}</b></p>`}

  <ol class="steps ${order.status === OrderStatus.CANCELLED && 'cancelled'}">
    ${STEPS.map(([status, icon, label], i) => html`
      <li class="${i < current && 'passed'} ${i === current && 'current'}" data-step="${status}">
        <span class="step-icon">${icon}</span>${label}
      </li>`)}
  </ol>

  <p class="track-message" id="track-message">${MESSAGES.get(order.status)}</p>

  <ul class="receipt-lines">
    ${items.map((it) => html`
      <li><span>${it.name} × ${it.quantity}</span><span>${money(it.price * it.quantity)}</span></li>`)}
  </ul>
  <div class="total">До сплати: ${money(order.total)} грн</div>
  ${order.customer_note && html`<p class="muted small">Побажання: ${order.customer_note}</p>`}

  <p class="muted small center">Сторінка оновлюється сама. Збережіть номер або залиште сторінку відкритою.</p>
  <div class="actions center-actions"><a class="btn ghost" href="/">← До меню</a></div>
  <template id="messages">${[...MESSAGES].map(([status, text]) => html`<p data-for="${status}">${text}</p>`)}</template>
</div>`;
};
