import { readFile } from 'node:fs/promises';

/**
 * Parse a Netscape cookies.txt and return a Cookie header string for all cookies
 * whose domain matches `targetDomain` (including subdomain wildcard, e.g. `.tiktok.com`
 * matches `v19-webapp.tiktok.com`).
 * Returns an empty string if the file cannot be read or no cookies match.
 */
export async function parseCookiesForDomain(cookiesFile: string, targetDomain: string): Promise<string> {
  let content: string;
  try {
    content = await readFile(cookiesFile, 'utf-8');
  } catch {
    return '';
  }

  const pairs: string[] = [];
  for (const line of content.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const [cookieDomain, , , , , name, ...rest] = parts;
    const value = rest.join('\t').trimEnd();
    const bare = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain;
    if (targetDomain === cookieDomain || targetDomain === bare || targetDomain.endsWith('.' + bare)) {
      pairs.push(`${name}=${value}`);
    }
  }

  return pairs.join('; ');
}
