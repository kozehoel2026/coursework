// Меню для гостей (F1) і самообслуговування (F13).
// Натискання на картку десерту виділяє її і додає в замовлення; знизу — панель «Оформити замовлення».
import { OrderStatus } from '../config.js';
import { html, imgUrl, money } from '../core/html.js';

const chip = (href, label, active) => html`<a class="chip ${active && 'active'}" href="${href}">${label}</a>`;

const availability = (stock, lowStock) => {
  if (stock === 0) return html`<span class="badge out">Немає</span>`;
  if (stock < lowStock) return html`<span class="badge low">Залишилось ${stock}</span>`;
  return html`<span class="badge ok">В наявності</span>`;
};

const cardImage = (d) => html`
    <div class="card-img">
      ${d.image
        ? html`<img src="${imgUrl(d.image)}" alt="${d.name}" loading="lazy">`
        : html`<span class="no-img">🍰</span>`}
    </div>`;

const cardBody = (d, lowStock) => html`
    <span class="tag">${d.category}</span>
    <h3>${d.name}</h3>
    <p class="desc">${d.description}</p>
    <div class="card-foot">
      <span class="price">${money(d.price)} грн</span>
      ${availability(d.stock, lowStock)}
    </div>`;

const card = (d, lowStock) => {
  // закінчений десерт не можна вибрати
  if (d.stock === 0) {
    return html`<article class="card soldout">${cardImage(d)}${cardBody(d, lowStock)}</article>`;
  }
  return html`
  <article class="card selectable" data-id="${d.id}" data-name="${d.name}" data-price="${d.price}"
           data-stock="${d.stock}" tabindex="0" role="button" aria-pressed="false" aria-label="${d.name}">
    ${cardImage(d)}
    ${cardBody(d, lowStock)}
    <div class="card-qty" aria-label="Кількість">
      <button type="button" class="qbtn" data-step="-1" aria-label="Менше">−</button>
      <span class="card-qty-value">1</span>
      <button type="button" class="qbtn" data-step="1" aria-label="Більше">+</button>
    </div>
  </article>`;
};

const STATUS_TEXT = new Map([
  [OrderStatus.NEW, 'готується'],
  [OrderStatus.READY, 'готове — підійдіть на касу!'],
]);

const activeOrdersBanner = (orders) =>
  orders.length > 0 && html`
<div class="my-orders">
  ${orders.map((o) => html`
    <a class="my-order ${o.status}" href="/my-order/${o.id}?t=${o.token}">
      <span>Ваше замовлення <b>№${o.id}</b> — ${STATUS_TEXT.get(o.status)}</span>
      <span>Переглянути →</span>
    </a>`)}
</div>`;

export const menuView = ({ desserts, categories, catId, lowStock, activeOrders = [] }) => html`
${activeOrdersBanner(activeOrders)}
<h1>Наші десерти</h1>

<div class="chips">
  ${chip('/', 'Усі', !catId)}
  ${categories.map((c) => chip(`/?category=${c.id}`, c.name, catId === c.id))}
</div>

<p class="muted small hint">Натисніть на десерт, щоб додати його до замовлення. Оформіть замовлення
  самостійно — ми покличемо вас на касу, коли все буде готово.</p>

<div class="cards">
  ${desserts.length
    ? desserts.map((d) => card(d, lowStock))
    : html`<p class="muted">У цій категорії поки немає десертів.</p>`}
</div>

<div class="cart-bar" id="cart-bar" hidden>
  <div class="cart-info">
    <span class="cart-icon">🛒</span>
    <span><b id="cart-count">0</b> шт. · <b id="cart-total">0.00</b> грн</span>
  </div>
  <div class="cart-actions">
    <button type="button" class="btn ghost small" id="cart-clear">Очистити</button>
    <a class="btn" id="cart-checkout" href="/cart">Оформити замовлення →</a>
  </div>
</div>`;
