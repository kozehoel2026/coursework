// HTTP-помилка зі статус-кодом (403, 404, 413 …)
export class HttpError extends Error {
  constructor(status, message = '') {
    super(message || `HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}
