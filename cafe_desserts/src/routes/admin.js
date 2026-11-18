// Адміністрування: десерти й залишки (F7, F8), категорії (F9), користувачі (F10).
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ALLOWED_EXT, Role, config } from '../config.js';
import { toInt } from '../core/context.js';
import { HttpError } from '../core/errors.js';
import { adminRequired } from '../core/guards.js';
import { SEED_IMAGE_FILES } from '../db.js';
import { hashPassword } from '../security.js';
import { adminDessertsView, categoriesView, dessertFormView, usersView } from '../views/admin.js';

const ROLES = new Set(Object.values(Role));

export function registerAdminRoutes(router) {
  router
    .get('/admin/desserts', adminRequired(listDesserts))
    .get('/admin/desserts/new', adminRequired(showDessertForm))
    .post('/admin/desserts/new', adminRequired(saveDessert))
    .get('/admin/desserts/:dessertId/edit', adminRequired(showDessertForm))
    .post('/admin/desserts/:dessertId/edit', adminRequired(saveDessert))
    .post('/admin/desserts/:dessertId/restock', adminRequired(restock))
    .post('/admin/desserts/:dessertId/delete', adminRequired(deleteDessert))
    .get('/admin/categories', adminRequired(listCategories))
    .post('/admin/categories', adminRequired(addCategory))
    .post('/admin/categories/:catId/delete', adminRequired(deleteCategory))
    .get('/admin/users', adminRequired(listUsers))
    .post('/admin/users', adminRequired(addUser))
    .post('/admin/users/:userId/delete', adminRequired(deleteUser));
}

// ---------------------------------------------------------------- десерти
function listDesserts(ctx) {
  const desserts = ctx.db.all(
    `SELECT d.*, c.name AS category FROM desserts d
     JOIN categories c ON c.id = d.category_id
     ORDER BY d.is_active DESC, c.name, d.name`);
  ctx.render(adminDessertsView, { title: 'Десерти', desserts });
}

const EMPTY_DESSERT = Object.freeze({
  name: '', description: '', price: '', stock: 0, category_id: null, is_active: 1, image: '',
});

const formScripts = ['/static/js/dessert-form.js'];

function loadDessert(ctx) {
  const { dessertId } = ctx.params;
  if (!dessertId) return null;
  const dessert = ctx.db.get('SELECT * FROM desserts WHERE id = ?', dessertId);
  if (!dessert) throw new HttpError(404);
  return dessert;
}

function renderDessertForm(ctx, dessert) {
  const { dessertId } = ctx.params;
  const categories = ctx.db.all('SELECT * FROM categories ORDER BY name');
  ctx.render(dessertFormView, {
    title: dessertId ? 'Редагування' : 'Новий десерт', dessert, categories, dessertId, scripts: formScripts,
  });
}

function showDessertForm(ctx) {
  renderDessertForm(ctx, loadDessert(ctx) ?? { ...EMPTY_DESSERT });
}

/** Розширення файлу в нижньому регістрі: "Фото.JPG" -> "jpg" */
const extensionOf = (filename) => path.extname(filename).slice(1).toLowerCase();

const uploadedPhoto = (form) => {
  const photo = form.get('photo');
  return photo instanceof File && photo.name && photo.size > 0 ? photo : null;
};

/** Перевіряє поля форми; повертає { data, errors } (аналог dessert_form_data). */
function readDessertForm(form) {
  const text = (name) => String(form.get(name) ?? '').trim();
  const errors = [];

  const name = text('name');
  if (!name) errors.push('Вкажіть назву.');

  let price = Number(text('price').replace(',', '.'));
  if (text('price') === '' || !Number.isFinite(price) || price < 0) {
    errors.push("Ціна має бути невід'ємним числом.");
    price = 0;
  }
  price = Math.round(price * 100) / 100;

  const stock = toInt(form.get('stock'));
  if (stock === null || stock < 0) errors.push("Залишок має бути цілим невід'ємним числом.");

  const categoryId = toInt(form.get('category_id'));
  if (!categoryId) errors.push('Оберіть категорію.');

  const photo = uploadedPhoto(form);
  if (photo && !ALLOWED_EXT.has(extensionOf(photo.name))) {
    errors.push('Фото має бути у форматі JPG, PNG, WEBP або GIF.');
  }

  const data = {
    name,
    description: text('description'),
    price,
    stock: stock ?? 0,
    category_id: categoryId,
    is_active: form.has('is_active') ? 1 : 0,
  };
  return { data, errors, photo };
}

/** Зберігає фото під унікальним ім'ям і повертає це ім'я. */
async function savePhoto(photo) {
  const filename = `${randomUUID().replaceAll('-', '')}.${extensionOf(photo.name)}`;
  await mkdir(config.imgDir, { recursive: true });
  await writeFile(path.join(config.imgDir, filename), Buffer.from(await photo.arrayBuffer()));
  return filename;
}

/** Видаляє файл фото, якщо це не одне з початкових фото тестових десертів. */
async function removePhoto(filename) {
  if (!filename || SEED_IMAGE_FILES.has(filename)) return;
  await rm(path.join(config.imgDir, path.basename(filename)), { force: true });
}

async function saveDessert(ctx) {
  const { db } = ctx;
  const existing = loadDessert(ctx);
  const form = await ctx.form();
  const { data, errors, photo } = readDessertForm(form);
  data.image = existing?.image ?? '';

  if (errors.length) {
    errors.forEach((message) => ctx.flash(message, 'error'));
    return renderDessertForm(ctx, data);
  }

  if (photo) {                                   // нове фото замінює старе
    const newImage = await savePhoto(photo);
    await removePhoto(data.image);
    data.image = newImage;
  } else if (form.has('remove_photo')) {         // «прибрати фото»
    await removePhoto(data.image);
    data.image = '';
  }

  const values = [data.name, data.description, data.price, data.stock, data.category_id, data.is_active, data.image];
  if (existing) {
    db.run(`UPDATE desserts SET name = ?, description = ?, price = ?, stock = ?, category_id = ?,
            is_active = ?, image = ? WHERE id = ?`, ...values, existing.id);
    ctx.flash('Десерт оновлено.', 'success');
  } else {
    db.run(`INSERT INTO desserts (name, description, price, stock, category_id, is_active, image)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, ...values);
    ctx.flash('Десерт додано.', 'success');
  }
  ctx.redirect('/admin/desserts');
}

async function restock(ctx) {
  const form = await ctx.form();
  const amount = toInt(form.get('amount'));
  if (!amount || amount <= 0) {
    ctx.flash('Вкажіть додатну кількість.', 'error');
  } else {
    ctx.db.run('UPDATE desserts SET stock = stock + ? WHERE id = ?', amount, ctx.params.dessertId);
    ctx.flash(`Залишок поповнено на ${amount} шт.`, 'success');
  }
  ctx.redirect('/admin/desserts');
}

async function deleteDessert(ctx) {
  const { db } = ctx;
  const { dessertId } = ctx.params;
  const { used } = db.get('SELECT COUNT(*) AS used FROM order_items WHERE dessert_id = ?', dessertId);
  if (used) {
    // десерт є в історії продажів — лише приховуємо з меню
    db.run('UPDATE desserts SET is_active = 0 WHERE id = ?', dessertId);
    ctx.flash('Десерт є в замовленнях, тому його приховано з меню (не видалено).', 'success');
  } else {
    const row = db.get('SELECT image FROM desserts WHERE id = ?', dessertId);
    db.run('DELETE FROM desserts WHERE id = ?', dessertId);
    if (row) await removePhoto(row.image);
    ctx.flash('Десерт видалено.', 'success');
  }
  ctx.redirect('/admin/desserts');
}

// ---------------------------------------------------------------- категорії
function listCategories(ctx) {
  const categories = ctx.db.all(
    `SELECT c.*, COUNT(d.id) AS cnt FROM categories c
     LEFT JOIN desserts d ON d.category_id = c.id
     GROUP BY c.id ORDER BY c.name`);
  ctx.render(categoriesView, { title: 'Категорії', categories });
}

async function addCategory(ctx) {
  const { db } = ctx;
  const name = String((await ctx.form()).get('name') ?? '').trim();
  if (!name) {
    ctx.flash('Вкажіть назву категорії.', 'error');
  } else if (db.get('SELECT 1 FROM categories WHERE name = ?', name)) {
    ctx.flash('Така категорія вже існує.', 'error');
  } else {
    db.run('INSERT INTO categories (name) VALUES (?)', name);
    ctx.flash('Категорію додано.', 'success');
  }
  ctx.redirect('/admin/categories');
}

function deleteCategory(ctx) {
  const { db } = ctx;
  const { catId } = ctx.params;
  const { cnt } = db.get('SELECT COUNT(*) AS cnt FROM desserts WHERE category_id = ?', catId);
  if (cnt) {
    ctx.flash('Не можна видалити категорію, у якій є десерти.', 'error');
  } else {
    db.run('DELETE FROM categories WHERE id = ?', catId);
    ctx.flash('Категорію видалено.', 'success');
  }
  ctx.redirect('/admin/categories');
}

// ---------------------------------------------------------------- користувачі
function listUsers(ctx) {
  const users = ctx.db.all(
    `SELECT u.*, COUNT(o.id) AS orders_count FROM users u
     LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id ORDER BY u.role, u.full_name`);
  ctx.render(usersView, { title: 'Користувачі', users });
}

async function addUser(ctx) {
  const { db } = ctx;
  const form = await ctx.form();
  const username = String(form.get('username') ?? '').trim();
  const fullName = String(form.get('full_name') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const role = String(form.get('role') ?? '');

  if (!username || !fullName || password.length < 6 || !ROLES.has(role)) {
    ctx.flash('Заповніть усі поля (пароль — щонайменше 6 символів).', 'error');
  } else if (db.get('SELECT 1 FROM users WHERE username = ?', username)) {
    ctx.flash('Такий логін уже зайнятий.', 'error');
  } else {
    db.run('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      username, await hashPassword(password), fullName, role);
    ctx.flash('Користувача додано.', 'success');
  }
  ctx.redirect('/admin/users');
}

function deleteUser(ctx) {
  const { db } = ctx;
  const { userId } = ctx.params;
  if (userId === ctx.user.id) {
    ctx.flash('Не можна видалити самого себе.', 'error');
  } else if (db.get('SELECT COUNT(*) AS cnt FROM orders WHERE user_id = ?', userId).cnt) {
    ctx.flash('Користувач має замовлення — видалити не можна.', 'error');
  } else {
    db.run('DELETE FROM users WHERE id = ?', userId);
    ctx.flash('Користувача видалено.', 'success');
  }
  ctx.redirect('/admin/users');
}
