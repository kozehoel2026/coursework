// Сховище сесій у пам'яті сервера: Map «ідентифікатор -> дані сесії».
// У браузер іде лише випадковий ідентифікатор у cookie (HttpOnly).
import { randomUUID } from 'node:crypto';

export class SessionStore {
  #sessions = new Map();
  #ttlMs;

  constructor(ttlMs) {
    this.#ttlMs = ttlMs;
    // раз на 10 хвилин прибираємо прострочені сесії; unref — не заважає серверу завершитися
    setInterval(() => this.#sweep(), 10 * 60 * 1000).unref();
  }

  get(id) {
    if (!id) return null;
    const session = this.#sessions.get(id);
    if (!session) return null;
    if (Date.now() - session.touchedAt > this.#ttlMs) {
      this.#sessions.delete(id);
      return null;
    }
    session.touchedAt = Date.now();
    return session;
  }

  create() {
    const session = { id: randomUUID(), userId: null, flashes: [], touchedAt: Date.now() };
    this.#sessions.set(session.id, session);
    return session;
  }

  destroy(id) {
    this.#sessions.delete(id);
  }

  #sweep() {
    const now = Date.now();
    for (const [id, session] of this.#sessions) {
      if (now - session.touchedAt > this.#ttlMs) this.#sessions.delete(id);
    }
  }
}
