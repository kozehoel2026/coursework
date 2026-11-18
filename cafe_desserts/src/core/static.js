// Віддача статичних файлів (CSS, JS, фото) з папки static/.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { config } from '../config.js';
import { HttpError } from './errors.js';

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

export const STATIC_PREFIX = '/static/';

export async function serveStatic(ctx) {
  let relative;
  try {
    relative = decodeURIComponent(ctx.url.pathname.slice(STATIC_PREFIX.length));
  } catch {
    throw new HttpError(404);
  }
  const file = path.resolve(config.staticDir, relative);
  // захист від виходу за межі папки static (../../)
  if (!file.startsWith(config.staticDir + path.sep)) throw new HttpError(404);

  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) throw new HttpError(404);

  ctx.res.writeHead(200, {
    'Content-Type': MIME_TYPES.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': 'public, max-age=3600',
  });
  if (ctx.req.method === 'HEAD') return ctx.res.end();
  await pipeline(createReadStream(file), ctx.res);
}
