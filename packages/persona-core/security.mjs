// 简单的访问防护：来源白名单 + 每 IP 限流。
// 注意：限流基于函数实例内存，Vercel 多实例时是尽力而为，
// 需要严格防护请使用 Upstash Redis 等分布式限流。

const DEFAULT_ORIGINS = [
  'https://edwarddang02-crypto.github.io',
  'https://talk-to-me-omega.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const EXTRA_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const ALLOWED_ORIGINS = new Set([...DEFAULT_ORIGINS, ...EXTRA_ORIGINS]);

export function isAllowedOrigin(req) {
  const raw = req.headers['origin'] || req.headers['referer'] || '';
  if (!raw) return false;
  try {
    return ALLOWED_ORIGINS.has(new URL(raw).origin);
  } catch {
    return false;
  }
}

const WINDOW_MS = 60_000;
const MAX_HITS = 20;
const hits = new Map();

export function rateLimit(req) {
  const ip =
    String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  let list = hits.get(ip);
  if (!list) {
    list = [];
    hits.set(ip, list);
  }
  while (list.length && now - list[0] > WINDOW_MS) list.shift();
  if (list.length >= MAX_HITS) {
    const retryAfter = Math.max(1, Math.ceil((list[0] + WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfter };
  }
  list.push(now);
  if (hits.size > 5000) {
    for (const [key, value] of hits) {
      if (!value.length || now - value[value.length - 1] > WINDOW_MS) hits.delete(key);
    }
  }
  return { allowed: true };
}
