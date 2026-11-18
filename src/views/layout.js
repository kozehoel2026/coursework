// Спільний каркас сторінки: шапка, навігація, флеш-повідомлення, підвал
// (аналог base.html).
import { Role, ROLE_LABELS } from '../config.js';
import { html } from '../core/html.js';

// Пункти меню адміністратора: [адреса, підпис]
const ADMIN_LINKS = [
  ['/admin/desserts', 'Десерти'],
  ['/admin/categories', 'Категорії'],
  ['/admin/users', 'Користувачі'],
  ['/admin/reports', 'Звіти'],
];

const nav = (user, queueCount) => {
  if (!user) return html`<a class="btn-out" href="/login">Вхід для персоналу</a>`;
  return html`
      <a href="/queue" class="queue-link">Черга${queueCount > 0 && html` <span class="count" data-queue-count>${queueCount}</span>`}</a>
      <a href="/order/new">Нове замовлення</a>
      <a href="/orders">Замовлення</a>
      ${user.role === Role.ADMIN && ADMIN_LINKS.map(([href, label]) => html`<a href="${href}">${label}</a>`)}
      <span class="who">${user.full_name} · ${ROLE_LABELS.get(user.role)}</span>
      <a class="btn-out" href="/logout">Вийти</a>`;
};

export const layout = ({ title = 'Солодкий куточок', user, queueCount = 0, flashes = [], scripts = [], content }) => html`<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · кав'ярня</title>
  <link rel="stylesheet" href="/static/style.css">
  <script type="module" src="/static/js/common.js"></script>
  ${scripts.map((src) => html`<script type="module" src="${src}"></script>`)}
</head>
<body>
<header class="topbar">
  <a class="logo" href="/">🍰 Солодкий куточок</a>
  <input type="checkbox" id="nav-toggle" class="nav-toggle">
  <label for="nav-toggle" class="burger" aria-label="Меню">☰</label>
  <nav class="nav">
    <a href="/">Меню</a>
    ${nav(user, queueCount)}
  </nav>
</header>

<main class="container">
  ${flashes.map(({ category, message }) => html`<div class="flash ${category}">${message}</div>`)}
  ${content}
</main>

<footer class="footer">© Кав'ярня «Солодкий куточок» · курсова робота</footer>
</body>
</html>`;
