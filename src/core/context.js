// Контекст одного HTTP-запиту: розбір запиту, сесія, поточний користувач,
// флеш-повідомлення та зручні методи відповіді.
import { config } from '../config.js';
import { layout } from '../views/layout.js';
import { HttpError } from './errors.js';

const COOKIE_NAME = 'sid';

const parseCookies = (header = '') =>
  new Map(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([name, value]) => name && value !== undefined)
      .map(([name, ...rest]) => [name, decodeURIComponent(rest.join('='))]),
  );

/** Рядок -> ціле число або null (аналог request.form.get(..., type=int) у Flask). */
export const toInt = (value) => {
  const text = String(value ?? '').trim();
  return /^-?\d+$/.test(text) ? Number(text) : null;
};

export class Context {
  #sessions;
  #user;          // undefined — ще не завантажено, null — гість
  #form;

  constructor(req, res, { db, sessions }) {
    this.req = req;
    this.res = res;
    this.db = db;
    this.#sessions = sessions;
    this.url = new URL(req.url, 'http://localhost');
    this.query = this.url.searchParams;
    this.params = {};
    this.session = sessions.get(parseCookies(req.headers.cookie).get(COOKIE_NAME));
  }

  // ---------------------------------------------------------- користувач і сесія
  get user() {
    if (this.#user === undefined) {
      const id = this.session?.userId;
      this.#user = id ? (this.db.get('SELECT * FROM users WHERE id = ?', id) ?? null) : null;
    }
    return this.#user;
  }

  #ensureSession() {
    if (!this.session) {
      this.session = this.#sessions.create();
      this.#setCookie(this.session.id);
    }
    return this.session;
  }

  #setCookie(value, maxAge) {
    const parts = [`${COOKIE_NAME}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
    if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
    this.res.appendHeader('Set-Cookie', parts.join('; '));
  }

  /** Сесія для гостя (клієнта) — створюється за потреби, напр. щоб пам'ятати його замовлення. */
  guestSession() {
    return this.#ensureSession();
  }

  /** IP-адреса клієнта (для обмеження частоти замовлень). */
  get ip() {
    return this.req.socket.remoteAddress ?? 'unknown';
  }

  /** Відповідь у форматі JSON (для автооновлення сторінок). */
  json(data, status = 200) {
    this.send(JSON.stringify(data), { status, type: 'application/json; charset=utf-8' });
  }

  /** Вхід: стара сесія знищується, створюється нова (захист від фіксації сесії). */
  login(userId) {
    if (this.session) this.#sessions.destroy(this.session.id);
    this.session = null;
    this.#ensureSession().userId = userId;
    this.#user = undefined;
  }

  logout() {
    if (this.session) this.#sessions.destroy(this.session.id);
    this.session = null;
    this.#user = null;
    this.#setCookie('', 0);
  }

  // ---------------------------------------------------------- флеш-повідомлення
  flash(message, category = 'success') {
    this.#ensureSession().flashes.push({ message, category });
  }

  takeFlashes() {
    if (!this.session) return [];
    const { flashes } = this.session;
    this.session.flashes = [];
    return flashes;
  }

  // ---------------------------------------------------------- тіло запиту
  /** Розбирає тіло форми (urlencoded або multipart з файлами) у стандартний FormData. */
  async form() {
    if (this.#form) return this.#form;

    const declared = Number(this.req.headers['content-length'] ?? 0);
    if (declared > config.maxUploadBytes) throw new HttpError(413);

    const chunks = [];
    let size = 0;
    for await (const chunk of this.req) {
      size += chunk.length;
      if (size > config.maxUploadBytes) throw new HttpError(413);
      chunks.push(chunk);
    }

    const contentType = this.req.headers['content-type'] ?? 'application/x-www-form-urlencoded';
    const request = new Request(this.url, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: Buffer.concat(chunks),
    });
    try {
      this.#form = await request.formData();
    } catch {
      throw new HttpError(400, 'Некоректні дані форми.');
    }
    return this.#form;
  }

  // ---------------------------------------------------------- відповіді
  send(body, { status = 200, type = 'text/html; charset=utf-8' } = {}) {
    this.res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    this.res.end(body);
  }

  /** Рендер сторінки: view(data) вставляється у спільний каркас layout. */
  render(view, data = {}, status = 200) {
    const page = layout({
      title: data.title,
      user: this.user,
      // лічильник черги замовлень від клієнтів — лише для персоналу
      queueCount: this.user
        ? this.db.get("SELECT COUNT(*) AS cnt FROM orders WHERE status IN ('new', 'ready')").cnt
        : 0,
      flashes: this.takeFlashes(),
      scripts: data.scripts ?? [],
      content: view({ ...data, user: this.user, lowStock: config.lowStock }),
    });
    this.send(String(page), { status });
  }

  /** Перенаправлення (303 — після POST браузер робить GET). */
  redirect(location, status = 303) {
    this.res.writeHead(status, { Location: location });
    this.res.end();
  }

  /** Безпечне «назад»: лише на сторінки цього ж сайту. */
  back(fallback) {
    const referer = this.req.headers.referer;
    try {
      const target = new URL(referer);
      if (target.host === this.req.headers.host) return this.redirect(target.pathname + target.search);
    } catch {
      /* немає або некоректний Referer */
    }
    return this.redirect(fallback);
  }
}
