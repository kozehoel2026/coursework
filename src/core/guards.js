// Перевірка доступу — функції вищого порядку, що «обгортають» обробник маршруту
// (аналог декораторів login_required / admin_required).
import { Role } from '../config.js';
import { HttpError } from './errors.js';

export const loginRequired = (handler) => async (ctx) => {
  if (!ctx.user) {
    ctx.flash('Увійдіть до системи.', 'error');
    return ctx.redirect(`/login?next=${encodeURIComponent(ctx.url.pathname)}`);
  }
  return handler(ctx);
};

export const adminRequired = (handler) =>
  loginRequired(async (ctx) => {
    if (ctx.user.role !== Role.ADMIN) throw new HttpError(403);
    return handler(ctx);
  });
