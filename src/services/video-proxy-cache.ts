import { randomUUID } from 'node:crypto';

const TTL_MS = 30 * 60 * 1000; // 30 min — covers queue wait + playback duration
const cache = new Map<string, { url: string; exp: number }>();

export function storeVideoProxy(url: string): string {
  const token = randomUUID();
  cache.set(token, { url, exp: Date.now() + TTL_MS });
  return token;
}

export function resolveVideoProxy(token: string): string | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    cache.delete(token);
    return null;
  }
  return entry.url;
}
