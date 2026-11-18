// Звіт про продажі (F11) та десерти, що закінчуються (F12).
import { html, money } from '../core/html.js';

const barRow = ({ day, revenue }, maxRevenue) => {
  const width = maxRevenue ? (revenue / maxRevenue) * 100 : 0;
  return html`
      <div class="bar-row">
        <span class="bar-label">${day}</span>
        <span class="bar"><span style="width: ${width.toFixed(1)}%"></span></span>
        <span class="bar-val">${money(revenue, 0)}</span>
      </div>`;
};

export const reportsView = ({ summary, byDay, top, low, dateFrom, dateTo, maxRevenue, lowStock }) => html`
<h1>Звіт про продажі</h1>
<form class="filters" method="get">
  <label>З <input type="date" name="from" value="${dateFrom}"></label>
  <label>По <input type="date" name="to" value="${dateTo}"></label>
  <button class="btn">Показати</button>
</form>

<div class="stats">
  <div class="stat"><span>Виручка</span><b>${money(summary.revenue)} грн</b></div>
  <div class="stat"><span>Замовлень</span><b>${summary.cnt}</b></div>
  <div class="stat"><span>Середній чек</span><b>${money(summary.cnt ? summary.revenue / summary.cnt : 0)} грн</b></div>
</div>

<div class="grid-2">
  <div class="panel">
    <h2>Виручка по днях</h2>
    ${byDay.length
      ? byDay.map((row) => barRow(row, maxRevenue))
      : html`<p class="muted">За період продажів немає.</p>`}
  </div>
  <div class="panel">
    <h2>Топ-5 десертів</h2>
    <ol class="top-list">
      ${top.length
        ? top.map((t) => html`<li><span>${t.name}</span><span>${t.qty} шт. · ${money(t.revenue, 0)} грн</span></li>`)
        : html`<li class="muted">Немає даних.</li>`}
    </ol>
    <h2>Закінчуються (&lt; ${lowStock} шт.)</h2>
    <ul class="plain-list">
      ${low.length
        ? low.map((l) => html`
        <li><span>${l.name}</span><span class="badge ${l.stock === 0 ? 'out' : 'low'}">${l.stock} шт.</span></li>`)
        : html`<li class="muted">Усього достатньо.</li>`}
    </ul>
  </div>
</div>`;
