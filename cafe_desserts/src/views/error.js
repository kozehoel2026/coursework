import { html } from '../core/html.js';

export const ERROR_TEXTS = new Map([
  [400, 'Некоректний запит.'],
  [403, 'Недостатньо прав для цієї сторінки.'],
  [404, 'Сторінку не знайдено.'],
  [405, 'Метод не підтримується.'],
  [500, 'Внутрішня помилка сервера.'],
]);

export const errorView = ({ code, text }) => html`
<div class="narrow panel center">
  <h1>${code}</h1>
  <p>${text}</p>
  <a class="btn" href="/">На головну</a>
</div>`;
