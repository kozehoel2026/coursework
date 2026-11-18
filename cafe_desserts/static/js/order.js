// Форма замовлення: кнопки +/−, натискання на фото додає 1 шт.,
// вибрані позиції виділяються, чек і сума рахуються «наживо».
// (Сервер усе одно перевіряє залишки та рахує суму сам.)
const form = document.getElementById('order-form');
const linesEl = document.getElementById('receipt-lines');
const totalEl = document.getElementById('total');

// id десерту -> { input, row, name, price } — швидкий доступ без повторних пошуків у DOM
const positions = new Map(
  [...form.querySelectorAll('.order-row')].map((row) => {
    const input = row.querySelector('input[type=number]');
    return [row.dataset.id, { row, input, name: input.dataset.name, price: Number(input.dataset.price) }];
  }),
);

const quantityOf = ({ input }) => Math.max(0, Number.parseInt(input.value, 10) || 0);

function recalc() {
  const fragment = document.createDocumentFragment();
  let total = 0;

  for (const position of positions.values()) {
    const qty = quantityOf(position);
    position.row.classList.toggle('is-selected', qty > 0);   // виділення вибраних десертів
    if (qty === 0) continue;

    const sum = qty * position.price;
    total += sum;
    const li = document.createElement('li');
    const label = document.createElement('span');
    const amount = document.createElement('span');
    label.textContent = `${position.name} × ${qty}`;
    amount.textContent = sum.toFixed(2);
    li.append(label, amount);
    fragment.append(li);
  }

  if (!fragment.childNodes.length) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'Порожньо';
    fragment.append(empty);
  }
  linesEl.replaceChildren(fragment);
  totalEl.textContent = total.toFixed(2);
}

function step(row, delta) {
  const position = positions.get(row.dataset.id);
  if (!position || position.input.disabled) return;
  const max = Number(position.input.max);
  position.input.value = Math.min(Math.max(quantityOf(position) + delta, 0), max);
  recalc();

  // коротка «пульсація» картки при натисканні
  row.classList.remove('pulse');
  void row.offsetWidth;   // перезапуск CSS-анімації
  row.classList.add('pulse');
}

form.addEventListener('click', (event) => {
  const button = event.target.closest('[data-step]');
  if (button) step(button.closest('.order-row'), Number(button.dataset.step));
});
form.addEventListener('input', recalc);
recalc();
