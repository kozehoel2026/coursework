// Сторінки адміністратора: десерти (F7, F8), категорії (F9), користувачі (F10).
import { ROLE_LABELS, Role } from '../config.js';
import { html, imgUrl, money } from '../core/html.js';
import { stockBadge, thumb } from './partials.js';

// ---------------------------------------------------------------- десерти
export const adminDessertsView = ({ desserts, lowStock }) => html`
<div class="head-row">
  <h1>Десерти та залишки</h1>
  <a class="btn" href="/admin/desserts/new">+ Додати десерт</a>
</div>
<div class="table-wrap">
<table class="table">
  <thead><tr><th>Назва</th><th>Категорія</th><th>Ціна</th><th>Залишок</th><th>Поповнити</th><th>Дії</th></tr></thead>
  <tbody>
  ${desserts.map((d) => html`
    <tr class="${!d.is_active && 'inactive'}">
      <td data-label="Назва">
        <span class="name-cell">${thumb(d.image)} <b>${d.name}</b></span>
        ${!d.is_active && html`<span class="muted small">(приховано)</span>`}</td>
      <td data-label="Категорія">${d.category}</td>
      <td data-label="Ціна">${money(d.price)}</td>
      <td data-label="Залишок">${stockBadge(d.stock, lowStock)}</td>
      <td data-label="Поповнити">
        <form method="post" action="/admin/desserts/${d.id}/restock" class="inline">
          <input type="number" name="amount" min="1" value="5" class="small-input" aria-label="Кількість">
          <button class="btn small">+</button>
        </form>
      </td>
      <td data-label="Дії" class="nowrap">
        <a class="btn small ghost" href="/admin/desserts/${d.id}/edit">Змінити</a>
        <form method="post" action="/admin/desserts/${d.id}/delete" class="inline"
              data-confirm="Видалити «${d.name}»?">
          <button class="btn small danger" aria-label="Видалити">✕</button>
        </form>
      </td>
    </tr>`)}
  </tbody>
</table>
</div>`;

export const dessertFormView = ({ dessert, categories, dessertId }) => html`
<div class="narrow panel">
  <h1>${dessertId ? 'Редагування десерту' : 'Новий десерт'}</h1>
  <form method="post" class="form" enctype="multipart/form-data">
    <label>Назва <input name="name" value="${dessert.name}" required maxlength="80"></label>
    <label>Категорія
      <select name="category_id" required>
        <option value="">— оберіть —</option>
        ${categories.map((c) => html`
          <option value="${c.id}" ${dessert.category_id === c.id && 'selected'}>${c.name}</option>`)}
      </select>
    </label>
    <label>Опис <textarea name="description" rows="3" maxlength="300">${dessert.description}</textarea></label>
    <div class="two">
      <label>Ціна, грн <input name="price" type="number" step="0.01" min="0" value="${dessert.price}" required></label>
      <label>Залишок, шт. <input name="stock" type="number" min="0" value="${dessert.stock}" required></label>
    </div>
    <div class="photo-field">
      <div class="photo-preview">
        ${dessert.image
          ? html`<img id="preview" src="${imgUrl(dessert.image)}" alt="">`
          : html`<img id="preview" alt="" hidden><span id="no-preview" class="no-img">🍰</span>`}
      </div>
      <label>Фото (JPG, PNG, WEBP, до 5 МБ)
        <input type="file" name="photo" id="photo" accept="image/jpeg,image/png,image/webp,image/gif">
      </label>
      ${dessert.image && html`<label class="check"><input type="checkbox" name="remove_photo"> Прибрати фото</label>`}
    </div>
    <label class="check"><input type="checkbox" name="is_active" ${Boolean(dessert.is_active) && 'checked'}> Показувати в меню</label>
    <div class="actions">
      <a class="btn ghost" href="/admin/desserts">Скасувати</a>
      <button class="btn">Зберегти</button>
    </div>
  </form>
</div>`;

// ---------------------------------------------------------------- категорії
export const categoriesView = ({ categories }) => html`
<h1>Категорії</h1>
<div class="grid-2">
  <div class="panel">
    <h2>Нова категорія</h2>
    <form method="post" class="form">
      <label>Назва <input name="name" required maxlength="50"></label>
      <button class="btn">Додати</button>
    </form>
  </div>
  <div class="panel">
    <h2>Список</h2>
    <ul class="plain-list">
      ${categories.map((c) => html`
      <li>
        <span>${c.name} <span class="muted small">(${c.cnt} десертів)</span></span>
        <form method="post" action="/admin/categories/${c.id}/delete" class="inline"
              data-confirm="Видалити категорію?">
          <button class="btn small danger" aria-label="Видалити"
            ${c.cnt > 0 && html`disabled title="У категорії є десерти"`}>✕</button>
        </form>
      </li>`)}
    </ul>
  </div>
</div>`;

// ---------------------------------------------------------------- користувачі
export const usersView = ({ users, user }) => html`
<h1>Користувачі</h1>
<div class="grid-2">
  <div class="panel">
    <h2>Новий користувач</h2>
    <form method="post" class="form">
      <label>ПІБ <input name="full_name" required maxlength="80"></label>
      <label>Логін <input name="username" required maxlength="30"></label>
      <label>Пароль (мін. 6 символів) <input name="password" type="password" minlength="6" required></label>
      <label>Роль
        <select name="role">
          <option value="${Role.CASHIER}">Касир</option>
          <option value="${Role.ADMIN}">Адміністратор</option>
        </select>
      </label>
      <button class="btn">Додати</button>
    </form>
  </div>
  <div class="panel">
    <h2>Список</h2>
    <ul class="plain-list">
      ${users.map((u) => html`
      <li>
        <span><b>${u.full_name}</b> <span class="muted small">@${u.username} ·
          ${ROLE_LABELS.get(u.role)} · замовлень: ${u.orders_count}</span></span>
        ${u.id !== user.id && html`
        <form method="post" action="/admin/users/${u.id}/delete" class="inline"
              data-confirm="Видалити користувача?">
          <button class="btn small danger" aria-label="Видалити">✕</button>
        </form>`}
      </li>`)}
    </ul>
  </div>
</div>`;
