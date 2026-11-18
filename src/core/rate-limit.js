// Обмеження частоти дій: «не більше N разів за проміжок часу з одного ключа (IP)».
// Map «ключ -> масив часових позначок» у пам'яті сервера.
export class RateLimiter {
  #hits = new Map();
  #limit;
  #windowMs;

  constructor(limit, windowMs) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    setInterval(() => this.#sweep(), windowMs).unref();
  }

  /** Повертає true і рахує спробу, якщо ліміт не вичерпано; інакше — false. */
  try(key) {
    const now = Date.now();
    const recent = (this.#hits.get(key) ?? []).filter((time) => now - time < this.#windowMs);
    if (recent.length >= this.#limit) {
      this.#hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.#hits.set(key, recent);
    return true;
  }

  #sweep() {
    const now = Date.now();
    for (const [key, times] of this.#hits) {
      if (times.every((time) => now - time >= this.#windowMs)) this.#hits.delete(key);
    }
  }
}
