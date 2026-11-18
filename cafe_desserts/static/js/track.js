// Сторінка відстеження замовлення: кожні 5 секунд питаємо сервер про статус
// і оновлюємо кроки та повідомлення без перезавантаження сторінки.
const panel = document.querySelector('.track');
const STEPS = ['new', 'ready', 'done'];
const FINAL = new Set(['done', 'cancelled']);
const messages = new Map(
  [...document.getElementById('messages').content.querySelectorAll('p')].map((p) => [p.dataset.for, p.textContent]),
);

// замовлення оформлено — кошик у меню очищаємо
try {
  sessionStorage.removeItem('cart');
} catch {
  /* сховище недоступне */
}

function show(status) {
  if (panel.dataset.status === status) return;
  panel.dataset.status = status;
  const current = STEPS.indexOf(status);
  document.querySelector('.steps').classList.toggle('cancelled', status === 'cancelled');
  document.querySelectorAll('.steps li').forEach((li, i) => {
    li.classList.toggle('passed', i < current);
    li.classList.toggle('current', i === current);
  });
  document.getElementById('track-message').textContent = messages.get(status) ?? '';

  if (status === 'ready') {
    document.title = '🔔 Готове! · кав\'ярня';
    panel.classList.add('ring');
    navigator.vibrate?.([200, 100, 200]);   // на телефоні — вібрація
  }
}

async function poll() {
  try {
    const response = await fetch(panel.dataset.statusUrl, { cache: 'no-store' });
    if (response.ok) show((await response.json()).status);
  } catch {
    /* немає з'єднання — спробуємо наступного разу */
  }
  if (!FINAL.has(panel.dataset.status)) setTimeout(poll, 5000);
}

if (!FINAL.has(panel.dataset.status)) setTimeout(poll, 5000);
