// Простий маршрутизатор: шаблони виду /orders/:id, де :id — ціле число.

export class Router {
  #routes = new Map();   // HTTP-метод -> масив маршрутів

  get(pattern, handler) {
    return this.#add('GET', pattern, handler);
  }

  post(pattern, handler) {
    return this.#add('POST', pattern, handler);
  }

  #add(method, pattern, handler) {
    const keys = [];
    const source = pattern.replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return '(\\d+)';
    });
    const route = { regex: new RegExp(`^${source}/?$`), keys, handler };
    if (!this.#routes.has(method)) this.#routes.set(method, []);
    this.#routes.get(method).push(route);
    return this;   // дозволяє ланцюжок router.get(...).post(...)
  }

  /** Повертає { handler, params } або null. */
  match(method, pathname) {
    const lookup = method === 'HEAD' ? 'GET' : method;
    for (const { regex, keys, handler } of this.#routes.get(lookup) ?? []) {
      const found = regex.exec(pathname);
      if (found) {
        const params = Object.fromEntries(keys.map((key, i) => [key, Number(found[i + 1])]));
        return { handler, params };
      }
    }
    return null;
  }

  /** Чи існує шлях для іншого методу (щоб відповісти 405, а не 404). */
  allows(pathname) {
    return [...this.#routes.values()].some((list) => list.some(({ regex }) => regex.test(pathname)));
  }
}
