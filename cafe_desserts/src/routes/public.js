// Меню для гостей (F1), вхід і вихід (F2).
import { toInt } from '../core/context.js';
import { verifyPassword } from '../security.js';
import { loginView } from '../views/login.js';
import { menuView } from '../views/menu.js';
import { guestActiveOrders } from './kiosk.js';

export function registerPublicRoutes(router) {
  router.get('/', menu);
  router.get('/login', (ctx) => ctx.render(loginView, { title: 'Вхід' }));
  router.post('/login', login);
  router.get('/logout', logout);
}

function menu(ctx) {
  const { db } = ctx;
  const catId = toInt(ctx.query.get('category'));
  const categories = db.all('SELECT * FROM categories ORDER BY name');

  let sql = `SELECT d.*, c.name AS category FROM desserts d
             JOIN categories c ON c.id = d.category_id
             WHERE d.is_active = 1`;
  const params = [];
  if (catId) {
    sql += ' AND d.category_id = ?';
    params.push(catId);
  }
  const desserts = db.all(`${sql} ORDER BY c.name, d.name`, ...params);
  ctx.render(menuView, {
    title: 'Меню', desserts, categories, catId, activeOrders: guestActiveOrders(ctx), scripts: ['/static/js/menu.js'],
  });
}

async function login(ctx) {
  const form = await ctx.form();
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');

  const user = ctx.db.get('SELECT * FROM users WHERE username = ?', username);
  if (user && (await verifyPassword(password, user.password_hash))) {
    ctx.login(user.id);
    ctx.flash(`Вітаємо, ${user.full_name}!`, 'success');
    const next = ctx.query.get('next') ?? '';
    // лише внутрішні адреси: "/orders" — так, "//інший-сайт" — ні
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/order/new';
    return ctx.redirect(safeNext);
  }
  ctx.flash('Неправильний логін або пароль.', 'error');
  ctx.render(loginView, { title: 'Вхід', username });
}

function logout(ctx) {
  ctx.logout();
  ctx.flash('Ви вийшли з системи.', 'success');
  ctx.redirect('/');
}
