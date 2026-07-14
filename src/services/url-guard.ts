import dns from 'node:dns';
import net from 'node:net';

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`SSRF blocked: ${reason}`);
    this.name = 'SsrfBlockedError';
  }
}

export interface AssertedUrl {
  url: URL;
  ip: string;
  family: 4 | 6;
}

function isPrivateIpv4(addr: string): boolean {
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    parts.every((p) => p === 0) ||
    parts.every((p) => p === 255)
  );
}

function ipv4MappedToV4(hexPart: string): string | null {
  if (net.isIPv4(hexPart)) return hexPart;
  // Normalized hex form: two 16-bit groups e.g. "7f00:1" → "127.0.0.1"
  const m = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(hexPart);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isPrivateIpv6(addr: string): boolean {
  const n = addr.toLowerCase();
  if (n === '::1' || n === '::') return true;
  // IPv4-mapped ::ffff: — handles dotted-decimal and normalized hex forms
  if (n.startsWith('::ffff:')) {
    const v4 = ipv4MappedToV4(n.slice(7));
    if (v4 !== null) return isPrivateIpv4(v4);
  }
  // fe80::/10 — link-local (fe80 to febf)
  if (/^fe[89ab]/i.test(n)) return true;
  // fc00::/7 — unique-local (fc00 to fdff)
  if (/^f[cd]/i.test(n)) return true;
  return false;
}

export function isPrivateIp(addr: string): boolean {
  if (net.isIPv4(addr)) return isPrivateIpv4(addr);
  if (net.isIPv6(addr)) return isPrivateIpv6(addr);
  return false;
}

export async function assertPublicHttpUrl(url: string): Promise<AssertedUrl> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfBlockedError('invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(`scheme not allowed: ${parsed.protocol}`);
  }

  const { hostname } = parsed;
  const rawHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  if (rawHost === 'localhost') throw new SsrfBlockedError('loopback hostname');

  if (net.isIP(rawHost) !== 0) {
    if (isPrivateIp(rawHost)) throw new SsrfBlockedError(`private IP: ${rawHost}`);
    const family: 4 | 6 = net.isIPv4(rawHost) ? 4 : 6;
    return { url: parsed, ip: rawHost, family };
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(rawHost, { all: true });
  } catch (err) {
    throw new SsrfBlockedError(`DNS resolution failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new SsrfBlockedError(`hostname resolves to private IP: ${address}`);
    }
  }

  const first = addresses[0];
  const resolvedFamily: 4 | 6 = first.family === 4 ? 4 : 6;
  return { url: parsed, ip: first.address, family: resolvedFamily };
}
