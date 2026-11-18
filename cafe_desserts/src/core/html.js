// Мінімальний «шаблонізатор» на тегованих шаблонних рядках.
// Усі підставлені значення автоматично екрануються (захист від XSS),
// крім тих, що вже є готовим HTML (SafeHtml).

class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

const ESCAPES = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]);

export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (ch) => ESCAPES.get(ch));

/** Позначає рядок як довірений HTML (без екранування). */
export const raw = (text) => new SafeHtml(String(text));

const renderValue = (value) => {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return escapeHtml(value);
};

/** html`<p>${text}</p>` — повертає безпечний HTML. */
export const html = (strings, ...values) =>
  new SafeHtml(strings.reduce((out, chunk, i) => out + chunk + (i < values.length ? renderValue(values[i]) : ''), ''));

// ---------- допоміжні функції для шаблонів
export const money = (value, digits = 2) => Number(value ?? 0).toFixed(digits);

export const imgUrl = (filename) => `/static/img/desserts/${encodeURIComponent(filename)}`;

export const stockBadgeClass = (stock, lowStock) => {
  if (stock === 0) return 'out';
  return stock < lowStock ? 'low' : 'ok';
};
