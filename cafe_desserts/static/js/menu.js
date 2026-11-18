// Меню + кошик самообслуговування.
//  - натискання на картку виділяє десерт і додає 1 шт. (повторне — прибирає);
//  - кнопки −/+ на виділеній картці змінюють кількість;
//  - панель знизу показує кількість і суму та веде на оформлення замовлення.
// Кошик — Map «id десерту -> кількість»; між сторінками (фільтр категорій) — у sessionStorage.
const STORAGE_KEY = 'cart';

const loadCart = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Map(saved.filter(([, qty]) => Number.isInteger(qty) && qty > 0));
  } catch {
    return new Map();
  }
};

const saveCart = () => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...cart]));
  } catch {
    /* сховище недоступне — кошик просто не запам'ятається між сторінками */
  }
};

const cart = loadCart();

// Ціни й залишки десертів на цій сторінці: id -> { price, stock, card }
const desserts = new Map(
  [...document.querySelectorAll('.card.selectable')].map((card) => [
    card.dataset.id,
    { card, price: Number(card.dataset.price), stock: Number(card.dataset.stock) },
  ]),
);

// Ціни десертів з інших категорій, вибраних раніше, — щоб панель показувала повну суму
const PRICES_KEY = 'cart-prices';
const prices = (() => {
  try {
    return new Map(JSON.parse(sessionStorage.getItem(PRICES_KEY) ?? '[]'));
  } catch {
    return new Map();
  }
})();
for (const [id, { price }] of desserts) prices.set(id, price);

const bar = document.getElementById('cart-bar');
const countEl = document.getElementById('cart-count');
const totalEl = document.getElementById('cart-total');
const checkoutLink = document.getElementById('cart-checkout');

function paintCard(id) {
  const info = desserts.get(id);
  if (!info) return;
  const qty = cart.get(id) ?? 0;
  info.card.classList.toggle('is-selected', qty > 0);
  info.card.setAttribute('aria-pressed', String(qty > 0));
  info.card.querySelector('.card-qty-value').textContent = qty;
  info.card.querySelector('[data-step="1"]').disabled = qty >= info.stock;
}

function paintBar() {
  const entries = [...cart];
  const count = entries.reduce((sum, [, qty]) => sum + qty, 0);
  const total = entries.reduce((sum, [id, qty]) => sum + (prices.get(id) ?? 0) * qty, 0);
  bar.hidden = count === 0;
  document.body.classList.toggle('has-cart', count > 0);
  countEl.textContent = count;
  totalEl.textContent = total.toFixed(2);
  checkoutLink.href = `/cart?items=${entries.map(([id, qty]) => `${id}:${qty}`).join(',')}`;
}

function setQty(id, qty) {
  const { stock } = desserts.get(id);
  const value = Math.min(Math.max(qty, 0), stock);
  if (value === 0) cart.delete(id);
  else cart.set(id, value);
  saveCart();
  try {
    sessionStorage.setItem(PRICES_KEY, JSON.stringify([...prices]));
  } catch {
    /* див. вище */
  }
  paintCard(id);
  paintBar();
}

// десерти, яких уже немає на складі, прибираємо з кошика
for (const [id, qty] of cart) {
  const info = desserts.get(id);
  if (info && qty > info.stock) cart.set(id, info.stock);
}
desserts.forEach((_, id) => paintCard(id));
paintBar();

const grid = document.querySelector('.cards');

grid?.addEventListener('click', (event) => {
  const card = event.target.closest('.card.selectable');
  if (!card) return;
  const { id } = card.dataset;
  const stepButton = event.target.closest('[data-step]');
  if (stepButton) {
    setQty(id, (cart.get(id) ?? 0) + Number(stepButton.dataset.step));
  } else {
    setQty(id, cart.has(id) ? 0 : 1);   // натискання на картку: вибрати / зняти вибір
  }
});

// з клавіатури: Enter або пробіл на картці
grid?.addEventListener('keydown', (event) => {
  const card = event.target.closest('.card.selectable');
  if (card && event.target === card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    setQty(card.dataset.id, cart.has(card.dataset.id) ? 0 : 1);
  }
});

document.getElementById('cart-clear')?.addEventListener('click', () => {
  cart.clear();
  saveCart();
  desserts.forEach((_, id) => paintCard(id));
  paintBar();
});
