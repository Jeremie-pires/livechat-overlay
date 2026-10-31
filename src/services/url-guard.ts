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
    a === 0 ||
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) ||
    // 192.0.0.0/24 — IETF protocol assignments
    (a === 192 && b === 0 && parts[2] === 0) ||
    // 198.18.0.0/15 — benchmarking
    (a === 198 && (b === 18 || b === 19)) ||
    // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved, 255.255.255.255 broadcast
    a >= 224
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
  // fec0::/10 — deprecated site-local (fec0 to feff)
  if (/^fe[c-f]/i.test(n)) return true;
  // fc00::/7 — unique-local (fc00 to fdff)
  if (/^f[cd]/i.test(n)) return true;
  // 64:ff9b::/96 — NAT64
  if (n.startsWith('64:ff9b:')) return true;
  // ff00::/8 — multicast
  if (n.startsWith('ff')) return true;
  // 2002::/16 — 6to4, the second and third groups embed an IPv4 address
  if (n.startsWith('2002:')) {
    const [, hi, lo] = n.split(':');
    const v4 = ipv4MappedToV4(`${hi}:${lo}`);
    return v4 === null || isPrivateIpv4(v4);
  }
  return false;
}

export function isPrivateIp(addr: string): boolean {
  if (net.isIPv4(addr)) return isPrivateIpv4(addr);
  if (net.isIPv6(addr)) return isPrivateIpv6(addr);
  return false;
}

async function resolveAndValidateHostname(hostname: string): Promise<{ ip: string; family: 4 | 6 }> {
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch (err) {
    throw new SsrfBlockedError(`DNS resolution failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (addresses.length === 0) {
    throw new SsrfBlockedError('DNS returned no addresses');
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new SsrfBlockedError(`hostname resolves to private IP: ${address}`);
    }
  }

  const first = addresses[0];
  return { ip: first.address, family: first.family === 4 ? 4 : 6 };
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

  const { ip, family } = await resolveAndValidateHostname(rawHost);
  return { url: parsed, ip, family };
}
