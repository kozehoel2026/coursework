// Спільна поведінка для всіх сторінок (замість inline onclick / onsubmit).

// Підтвердження небезпечних дій: <form data-confirm="Видалити?">
document.addEventListener('submit', (event) => {
  const message = event.target.dataset?.confirm;
  if (message && !window.confirm(message)) event.preventDefault();
});

// Клікабельні рядки таблиці: <tr data-href="/orders/5">
document.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-href]');
  if (row && !event.target.closest('a, button, input, form')) {
    window.location.href = row.dataset.href;
  }
});
