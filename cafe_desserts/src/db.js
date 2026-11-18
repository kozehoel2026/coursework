// Робота з базою даних SQLite: підключення, створення таблиць, тестові дані.
// Використовується вбудований модуль node:sqlite — окремо нічого встановлювати не треба.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

import { config, Role } from './config.js';
import { hashPassword, isCurrentHash } from './security.js';

/** Обгортка над DatabaseSync: кеш підготовлених запитів і транзакції. */
export class Database {
  #conn;
  #statements = new Map();   // SQL-текст -> підготовлений запит (готуємо кожен лише раз)

  constructor(filename) {
    this.#conn = new DatabaseSync(filename);
    this.#conn.exec('PRAGMA foreign_keys = ON');
  }

  #prepare(sql) {
    let stmt = this.#statements.get(sql);
    if (!stmt) {
      stmt = this.#conn.prepare(sql);
      this.#statements.set(sql, stmt);
    }
    return stmt;
  }

  /** Один рядок або undefined. */
  get(sql, ...params) {
    return this.#prepare(sql).get(...params);
  }

  /** Масив рядків. */
  all(sql, ...params) {
    return this.#prepare(sql).all(...params);
  }

  /** INSERT / UPDATE / DELETE -> { changes, lastInsertRowid } */
  run(sql, ...params) {
    return this.#prepare(sql).run(...params);
  }

  exec(sql) {
    this.#conn.exec(sql);
  }

  /** Виконує fn в одній транзакції: або все, або нічого. */
  transaction(fn) {
    this.#conn.exec('BEGIN');
    try {
      const result = fn(this);
      this.#conn.exec('COMMIT');
      return result;
    } catch (err) {
      this.#conn.exec('ROLLBACK');
      throw err;
    }
  }

  close() {
    this.#conn.close();
  }
}

// Фото тестових десертів (файли лежать у static/img/desserts/)
export const SEED_IMAGES = new Map([
  ['Наполеон', 'napoleon.jpg'],
  ['Медовик', 'medovyk.jpg'],
  ['Чизкейк Нью-Йорк', 'cheesecake.jpg'],
  ['Еклер ванільний', 'eclair.jpg'],
  ['Тірамісу', 'tiramisu.jpg'],
  ['Шоколадний десерт «Картошка»', 'kartoshka.jpg'],
  ['Круасан мигдальний', 'croissant.jpg'],
  ['Синабон', 'cinnabon.jpg'],
  ['Макарон малина', 'macaron-raspberry.jpg'],
  ['Макарон фісташка', 'macaron-pistachio.jpg'],
]);

/** Імена файлів початкових фото — їх ніколи не видаляємо з диска. */
export const SEED_IMAGE_FILES = new Set(SEED_IMAGES.values());

// Виправлення назв у вже створеній базі: стара назва -> нова
const RENAMES = new Map([
  ['Чізкейк Нью-Йорк', 'Чизкейк Нью-Йорк'],
  ['Картопля', 'Шоколадний десерт «Картошка»'],
]);

const SEED_USERS = [
  { username: 'elvira', password: 'zxcvbnm123', fullName: 'Козегородська Ельвіра Андріївна', role: Role.ADMIN },
  { username: 'arina', password: 'zxcvbnm123', fullName: 'Сташенко Аріна Олександрівна', role: Role.CASHIER },
];

const SEED_CATEGORIES = ['Торти', 'Тістечка', 'Випічка', 'Макарон'];

// [категорія, назва, опис, ціна, залишок]
const SEED_DESSERTS = [
  ['Торти', 'Наполеон', 'Класичний листковий торт із заварним кремом, шматок', 85, 12],
  ['Торти', 'Медовик', 'Медові коржі зі сметанним кремом, шматок', 80, 10],
  ['Торти', 'Чизкейк Нью-Йорк', 'Ніжний вершковий сир на пісочній основі', 110, 8],
  ['Тістечка', 'Еклер ванільний', 'Заварне тісто, ванільний крем, шоколадна глазур', 55, 15],
  ['Тістечка', 'Тірамісу', 'Маскарпоне, савоярді, кава та какао', 105, 2],
  ['Тістечка', 'Шоколадний десерт «Картошка»', 'Шоколадне тістечко з горіхами', 40, 20],
  ['Випічка', 'Круасан мигдальний', 'Масляний круасан з мигдальним кремом', 70, 9],
  ['Випічка', 'Синабон', "Булочка з корицею та вершковою глазур'ю", 75, 6],
  ['Макарон', 'Макарон малина', 'Мигдальне печиво з малиновим ганашем', 35, 25],
  ['Макарон', 'Макарон фісташка', 'Мигдальне печиво з фісташковим кремом', 38, 1],
];

/** Відкриває базу, створює таблиці, за потреби заповнює та оновлює її. */
export async function openDatabase(filename = config.dbPath) {
  const db = new Database(filename);
  db.exec(readFileSync(config.schemaPath, 'utf8'));

  const { cnt } = db.get('SELECT COUNT(*) AS cnt FROM users');
  if (cnt === 0) {
    // хешування асинхронне, тому рахуємо хеші до початку транзакції
    const users = await Promise.all(
      SEED_USERS.map(async (u) => ({ ...u, hash: await hashPassword(u.password) })),
    );
    db.transaction(() => seed(db, users));
  }
  migrateOrders(db);
  db.transaction(() => migrate(db));
  await migrateUsers(db);
  return db;
}

/**
 * Таблиця orders попередньої версії не мала замовлень від клієнтів
 * (user_id був обов'язковим, статусів new/ready не було).
 * SQLite не вміє змінювати обмеження стовпців, тому таблицю перебудовуємо:
 * створюємо нову, копіюємо дані, стару видаляємо — усе в одній транзакції.
 */
function migrateOrders(db) {
  const columns = new Set(db.all('PRAGMA table_info(orders)').map((col) => col.name));
  if (columns.has('source')) return;

  db.exec('PRAGMA foreign_keys = OFF');   // інакше order_items «заважатимуть» видаленню
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE orders_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER REFERENCES users(id),
          created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          total         REAL    NOT NULL DEFAULT 0,
          status        TEXT    NOT NULL DEFAULT 'done'
                        CHECK (status IN ('new', 'ready', 'done', 'cancelled')),
          customer_note TEXT    NOT NULL DEFAULT '',
          source        TEXT    NOT NULL DEFAULT 'staff' CHECK (source IN ('staff', 'kiosk')),
          customer_name TEXT    NOT NULL DEFAULT '',
          token         TEXT    NOT NULL DEFAULT '',
          updated_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
        );
        INSERT INTO orders_new (id, user_id, created_at, total, status, customer_note, updated_at)
          SELECT id, user_id, created_at, total, status, customer_note, created_at FROM orders;
        DROP TABLE orders;
        ALTER TABLE orders_new RENAME TO orders;
      `);
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

// Облікові записи першої версії: логін -> логін нового власника їхніх замовлень
const OLD_USERS = new Map([
  ['admin', 'elvira'],     // Олена Коваль    -> Козегородська Ельвіра
  ['cashier', 'arina'],    // Андрій Мельник  -> Сташенко Аріна
]);

/**
 * Оновлює користувачів у базі, створеній попередньою версією:
 *  - додає / виправляє адміністратора та касира з SEED_USERS;
 *  - старі хеші (Python) замінює на хеш пароля з SEED_USERS;
 *  - замовлення старих тестових користувачів передає новим, а старих видаляє.
 */
async function migrateUsers(db) {
  const updates = [];
  for (const user of SEED_USERS) {
    const row = db.get('SELECT * FROM users WHERE username = ?', user.username);
    if (!row || !isCurrentHash(row.password_hash)) {
      updates.push({ ...user, exists: Boolean(row), hash: await hashPassword(user.password) });
    } else if (row.full_name !== user.fullName || row.role !== user.role) {
      updates.push({ ...user, exists: true, hash: row.password_hash });
    }
  }

  db.transaction(() => {
    for (const { username, fullName, role, hash, exists } of updates) {
      if (exists) {
        db.run('UPDATE users SET full_name = ?, role = ?, password_hash = ? WHERE username = ?',
          fullName, role, hash, username);
      } else {
        db.run('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
          username, hash, fullName, role);
      }
    }
    for (const [oldLogin, newLogin] of OLD_USERS) {
      const old = db.get('SELECT id FROM users WHERE username = ?', oldLogin);
      if (!old) continue;
      const { id: newId } = db.get('SELECT id FROM users WHERE username = ?', newLogin);
      db.run('UPDATE orders SET user_id = ? WHERE user_id = ?', newId, old.id);
      db.run('DELETE FROM users WHERE id = ?', old.id);
    }
  });
}

function seed(db, users) {
  for (const { username, hash, fullName, role } of users) {
    db.run('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      username, hash, fullName, role);
  }

  const categoryIds = new Map();   // назва категорії -> id
  for (const name of SEED_CATEGORIES) {
    const { lastInsertRowid } = db.run('INSERT INTO categories (name) VALUES (?)', name);
    categoryIds.set(name, Number(lastInsertRowid));
  }

  for (const [category, name, description, price, stock] of SEED_DESSERTS) {
    db.run(
      'INSERT INTO desserts (category_id, name, description, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)',
      categoryIds.get(category), name, description, price, stock, SEED_IMAGES.get(name) ?? '',
    );
  }
}

/** Оновлює базу, створену попередньою версією програми (дані зберігаються). */
function migrate(db) {
  const columns = new Set(db.all('PRAGMA table_info(desserts)').map((col) => col.name));
  if (!columns.has('image')) {
    db.exec("ALTER TABLE desserts ADD COLUMN image TEXT NOT NULL DEFAULT ''");
  }
  for (const [oldName, newName] of RENAMES) {
    db.run('UPDATE desserts SET name = ? WHERE name = ?', newName, oldName);
  }
  for (const [name, image] of SEED_IMAGES) {
    db.run("UPDATE desserts SET image = ? WHERE name = ? AND image = ''", image, name);
  }
}
