// Черга для персоналу: кожні 8 секунд оновлюємо дошку замовлень.
// Нові замовлення підсвічуються (Set з номерами, які вже були на дошці).
const board = document.getElementById('queue-board');
const idsOnBoard = () => new Set([...board.querySelectorAll('.ticket')].map((t) => t.dataset.id));
let known = idsOnBoard();
let lastMarkup = null;

function updateCounter(count) {
  const link = document.querySelector('.queue-link');
  if (!link) return;
  let badge = link.querySelector('[data-queue-count]');
  if (count > 0 && !badge) {
    badge = Object.assign(document.createElement('span'), { className: 'count' });
    badge.dataset.queueCount = '';
    link.append(' ', badge);
  }
  if (badge) {
    badge.textContent = count;
    badge.hidden = count === 0;
  }
  document.title = `${count > 0 ? `(${count}) ` : ''}Черга замовлень · кав'ярня`;
}

async function refresh() {
  try {
    const response = await fetch('/queue/board', { cache: 'no-store' });
    if (!response.ok) return;
    const markup = await response.text();
    if (markup !== lastMarkup) {
      lastMarkup = markup;
      board.innerHTML = markup;
      for (const ticket of board.querySelectorAll('.ticket')) {
        if (!known.has(ticket.dataset.id)) ticket.classList.add('fresh');   // нове замовлення
      }
      known = idsOnBoard();
    }
    updateCounter(Number(response.headers.get('X-Queue-Count') ?? 0));
  } catch {
    /* немає з'єднання — спробуємо пізніше */
  }
}

setInterval(refresh, 8000);
