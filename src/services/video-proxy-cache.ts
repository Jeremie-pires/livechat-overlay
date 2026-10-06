import { randomUUID } from 'node:crypto';

const TTL_MS = 30 * 60 * 1000;
// Source URL → token cache: avoids re-extracting the same video URL within the TTL.
// Shorter than TTL_MS to ensure the CDN URL behind the token is still fresh.
const SOURCE_TTL_MS = 8 * 60 * 1000;

interface ProxyEntry {
  url: string;
  headers?: Record<string, string>;
  exp: number;
}

const cache = new Map<string, ProxyEntry>();
const sourceCache = new Map<string, { token: string; exp: number }>();

export function storeVideoProxy(url: string, headers?: Record<string, string>): string {
  const token = randomUUID();
  cache.set(token, { url, headers, exp: Date.now() + TTL_MS });
  return token;
}

export function resolveVideoProxy(token: string): { url: string; headers?: Record<string, string> } | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    cache.delete(token);
    return null;
  }
  return { url: entry.url, headers: entry.headers };
}

// Returns an existing live token for sourceUrl, or creates a new proxy entry for upstreamUrl.
// Use this for TikTok/Twitter so the same video link sent by multiple users reuses one token.
export function findOrCreateProxy(sourceUrl: string, upstreamUrl: string, headers?: Record<string, string>): string {
  const existing = sourceCache.get(sourceUrl);
  if (existing && Date.now() <= existing.exp && resolveVideoProxy(existing.token) !== null) {
    return existing.token;
  }
  const token = storeVideoProxy(upstreamUrl, headers);
  sourceCache.set(sourceUrl, { token, exp: Date.now() + SOURCE_TTL_MS });
  return token;
}
