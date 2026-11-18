// Дрібні повторювані фрагменти розмітки.
import { OrderSource, STATUS_INFO } from '../config.js';
import { html, imgUrl, stockBadgeClass } from '../core/html.js';

/** Мініатюра фото десерту або значок 🍰, якщо фото немає. */
export const thumb = (image, alt = '') =>
  image
    ? html`<img class="thumb" src="${imgUrl(image)}" alt="${alt}">`
    : html`<span class="thumb no-img">🍰</span>`;

/** Значок залишку: «12 шт.» зеленим / жовтим / червоним. */
export const stockBadge = (stock, lowStock) =>
  html`<span class="badge ${stockBadgeClass(stock, lowStock)}">${stock} шт.</span>`;

export const statusBadge = (status) => {
  const { label, badge } = STATUS_INFO.get(status) ?? { label: status, badge: '' };
  return html`<span class="badge ${badge}">${label}</span>`;
};

/** Хто оформив: ім'я касира або «самообслуговування». */
export const sourceLabel = (order) => {
  if (order.source !== OrderSource.KIOSK) return order.cashier ?? '—';
  const kiosk = html`<span class="badge kiosk">🛒 клієнт${order.customer_name && html` · ${order.customer_name}`}</span>`;
  return order.cashier ? html`${kiosk} <span class="muted small">видав(ла): ${order.cashier}</span>` : kiosk;
};
