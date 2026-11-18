// Звіт про продажі за період (F11) і десерти, що закінчуються (F12).
import { config } from '../config.js';
import { adminRequired } from '../core/guards.js';
import { reportsView } from '../views/reports.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Дата у форматі РРРР-ММ-ДД за місцевим часом (date.today() у Python). */
const localIsoDate = (date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
};

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

export function registerReportRoutes(router) {
  router.get('/admin/reports', adminRequired(reports));
}

function reports(ctx) {
  const { db } = ctx;
  const pick = (name, fallback) => {
    const value = ctx.query.get(name) ?? '';
    return ISO_DATE.test(value) ? value : fallback;
  };
  const dateFrom = pick('from', localIsoDate(daysAgo(6)));
  const dateTo = pick('to', localIsoDate(new Date()));
  const where = "o.status = 'done' AND date(o.created_at) BETWEEN ? AND ?";

  const summary = db.get(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS revenue FROM orders o WHERE ${where}`, dateFrom, dateTo);
  const byDay = db.all(
    `SELECT date(o.created_at) AS day, COUNT(*) AS cnt, SUM(total) AS revenue
     FROM orders o WHERE ${where} GROUP BY day ORDER BY day`, dateFrom, dateTo);
  const top = db.all(
    `SELECT d.name, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.price) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     JOIN desserts d ON d.id = oi.dessert_id
     WHERE ${where} GROUP BY d.id ORDER BY qty DESC LIMIT 5`, dateFrom, dateTo);
  const low = db.all(
    'SELECT name, stock FROM desserts WHERE is_active = 1 AND stock < ? ORDER BY stock', config.lowStock);
  const maxRevenue = Math.max(0, ...byDay.map((row) => row.revenue));

  ctx.render(reportsView, { title: 'Звіти', summary, byDay, top, low, dateFrom, dateTo, maxRevenue });
}
