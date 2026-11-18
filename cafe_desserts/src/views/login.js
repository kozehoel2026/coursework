import { html } from '../core/html.js';

export const loginView = ({ username = '' }) => html`
<div class="narrow panel">
  <h1>Вхід для персоналу</h1>
  <form method="post" class="form">
    <label>Логін <input name="username" value="${username}" required autofocus></label>
    <label>Пароль <input name="password" type="password" required></label>
    <button class="btn">Увійти</button>
  </form>
  <p class="muted small">Тестові облікові записи (пароль <b>zxcvbnm123</b>):
    <b>elvira</b> — Козегородська Ельвіра (адміністратор),
    <b>arina</b> — Сташенко Аріна (касир).</p>
</div>`;
