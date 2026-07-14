import dns from 'node:dns';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertPublicHttpUrl, isPrivateIp, SsrfBlockedError } from '../../services/url-guard';

const PUBLIC_IP = '93.184.216.34';
const PUBLIC_IPV6 = '2001:db8::1';

function mockDnsPublic() {
  return vi.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: PUBLIC_IP, family: 4 }] as dns.LookupAddress[]);
}

function mockDnsPublicV6() {
  return vi
    .spyOn(dns.promises, 'lookup')
    .mockResolvedValue([{ address: PUBLIC_IPV6, family: 6 }] as dns.LookupAddress[]);
}

function mockDnsPrivate(address: string) {
  return vi.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address, family: 4 }] as dns.LookupAddress[]);
}

function mockDnsFailure() {
  return vi.spyOn(dns.promises, 'lookup').mockRejectedValue(new Error('ENOTFOUND'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── isPrivateIp ────────────────────────────────────────────────────────────────

describe('isPrivateIp — IPv4', () => {
  it('returns true for loopback 127.0.0.1', () => expect(isPrivateIp('127.0.0.1')).toBe(true));
  it('returns true for 127.x.x.x', () => expect(isPrivateIp('127.255.255.255')).toBe(true));
  it('returns true for RFC1918 10.x', () => expect(isPrivateIp('10.0.0.1')).toBe(true));
  it('returns true for RFC1918 172.16.x', () => expect(isPrivateIp('172.16.0.1')).toBe(true));
  it('returns true for RFC1918 172.31.x', () => expect(isPrivateIp('172.31.255.255')).toBe(true));
  it('returns false for 172.15.x (outside /12)', () => expect(isPrivateIp('172.15.0.1')).toBe(false));
  it('returns false for 172.32.x (outside /12)', () => expect(isPrivateIp('172.32.0.1')).toBe(false));
  it('returns true for RFC1918 192.168.x', () => expect(isPrivateIp('192.168.1.1')).toBe(true));
  it('returns true for link-local 169.254.x', () => expect(isPrivateIp('169.254.169.254')).toBe(true));
  it('returns true for 0.0.0.0', () => expect(isPrivateIp('0.0.0.0')).toBe(true));
  it('returns true for 255.255.255.255', () => expect(isPrivateIp('255.255.255.255')).toBe(true));
  it('returns false for public IP 8.8.8.8', () => expect(isPrivateIp('8.8.8.8')).toBe(false));
  it('returns false for public IP 93.184.216.34', () => expect(isPrivateIp(PUBLIC_IP)).toBe(false));
  it('returns false for non-IP string', () => expect(isPrivateIp('example.com')).toBe(false));
});

describe('isPrivateIp — IPv6', () => {
  it('returns true for ::1 (loopback)', () => expect(isPrivateIp('::1')).toBe(true));
  it('returns true for :: (unspecified)', () => expect(isPrivateIp('::')).toBe(true));
  it('returns true for fe80::1 (link-local)', () => expect(isPrivateIp('fe80::1')).toBe(true));
  it('returns true for fe90::1 (link-local)', () => expect(isPrivateIp('fe90::1')).toBe(true));
  it('returns true for fc00::1 (ULA)', () => expect(isPrivateIp('fc00::1')).toBe(true));
  it('returns true for fd00::1 (ULA)', () => expect(isPrivateIp('fd00::1')).toBe(true));
  it('returns true for ::ffff:127.0.0.1 (IPv4-mapped loopback)', () =>
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true));
  it('returns true for ::ffff:10.0.0.1 (IPv4-mapped RFC1918)', () => expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true));
  it('returns false for 2001:db8::1 (documentation, public range)', () =>
    expect(isPrivateIp('2001:db8::1')).toBe(false));
  it('returns false for ::ffff:93.184.216.34 (IPv4-mapped public)', () =>
    expect(isPrivateIp('::ffff:93.184.216.34')).toBe(false));
});

// ── assertPublicHttpUrl — return shape ─────────────────────────────────────────

describe('assertPublicHttpUrl — return shape { url, ip, family }', () => {
  it('returns { url: URL, ip: string, family: 4|6 } for hostname resolved to IPv4', async () => {
    mockDnsPublic();
    const result = await assertPublicHttpUrl('https://example.com/path');
    expect(result.url).toBeInstanceOf(URL);
    expect(result.ip).toBe(PUBLIC_IP);
    expect(result.family).toBe(4);
  });

  it('returns family: 6 when DNS resolves to an IPv6 address', async () => {
    mockDnsPublicV6();
    const result = await assertPublicHttpUrl('https://example.com/path');
    expect(result.family).toBe(6);
    expect(result.ip).toBe(PUBLIC_IPV6);
  });

  it('returns the literal IP when host is a public IPv4 literal (no DNS lookup)', async () => {
    const dnsSpy = mockDnsPublic();
    const result = await assertPublicHttpUrl(`http://${PUBLIC_IP}/path`);
    expect(result.ip).toBe(PUBLIC_IP);
    expect(result.family).toBe(4);
    expect(dnsSpy).not.toHaveBeenCalled();
  });

  it('returns the literal IP when host is a public IPv6 literal (no DNS lookup)', async () => {
    const dnsSpy = mockDnsPublic();
    const result = await assertPublicHttpUrl(`http://[${PUBLIC_IPV6}]/path`);
    expect(result.ip).toBe(PUBLIC_IPV6);
    expect(result.family).toBe(6);
    expect(dnsSpy).not.toHaveBeenCalled();
  });

  it('url.href is preserved from the original URL', async () => {
    mockDnsPublic();
    const original = 'https://example.com/some/path?q=1';
    const result = await assertPublicHttpUrl(original);
    expect(result.url.href).toBe(original);
  });
});

// ── assertPublicHttpUrl — scheme validation ────────────────────────────────────

describe('assertPublicHttpUrl — scheme validation', () => {
  beforeEach(() => mockDnsPublic());

  it('accepts http:// URLs', async () => {
    const result = await assertPublicHttpUrl('http://example.com/path');
    expect(result.url).toBeInstanceOf(URL);
    expect(result.url.protocol).toBe('http:');
  });

  it('accepts https:// URLs', async () => {
    const result = await assertPublicHttpUrl('https://example.com');
    expect(result.url.protocol).toBe('https:');
  });

  it('rejects file: scheme', async () => {
    await expect(assertPublicHttpUrl('file:///etc/passwd')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects ftp: scheme', async () => {
    await expect(assertPublicHttpUrl('ftp://example.com/file')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects gopher: scheme', async () => {
    await expect(assertPublicHttpUrl('gopher://example.com')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects data: scheme', async () => {
    await expect(assertPublicHttpUrl('data:text/plain,hello')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects malformed URL strings', async () => {
    await expect(assertPublicHttpUrl('not-a-url')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects empty string', async () => {
    await expect(assertPublicHttpUrl('')).rejects.toThrow(SsrfBlockedError);
  });
});

describe('assertPublicHttpUrl — loopback and private literal IPs', () => {
  it('rejects localhost hostname', async () => {
    await expect(assertPublicHttpUrl('http://localhost/path')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects 127.0.0.1', async () => {
    await expect(assertPublicHttpUrl('http://127.0.0.1/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects 127.255.255.255', async () => {
    await expect(assertPublicHttpUrl('http://127.255.255.255/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects 0.0.0.0', async () => {
    await expect(assertPublicHttpUrl('http://0.0.0.0/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects RFC1918 10.x', async () => {
    await expect(assertPublicHttpUrl('http://10.0.0.1/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects RFC1918 172.16.x', async () => {
    await expect(assertPublicHttpUrl('http://172.16.0.1/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects RFC1918 192.168.x', async () => {
    await expect(assertPublicHttpUrl('http://192.168.1.1/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects cloud metadata 169.254.169.254', async () => {
    await expect(assertPublicHttpUrl('http://169.254.169.254/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects link-local 169.254.0.1', async () => {
    await expect(assertPublicHttpUrl('http://169.254.0.1/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects ::1 IPv6 loopback', async () => {
    await expect(assertPublicHttpUrl('http://[::1]/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects fc00::1 ULA IPv6', async () => {
    await expect(assertPublicHttpUrl('http://[fc00::1]/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects ::ffff:127.0.0.1 IPv4-mapped', async () => {
    await expect(assertPublicHttpUrl('http://[::ffff:127.0.0.1]/')).rejects.toThrow(SsrfBlockedError);
  });
});

describe('assertPublicHttpUrl — edge cases', () => {
  it('throws SsrfBlockedError when DNS returns empty address array', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue([] as unknown as dns.LookupAddress[]);
    await expect(assertPublicHttpUrl('https://example.com/')).rejects.toThrow(SsrfBlockedError);
  });

  it('accepts 172.32.0.1 (just outside RFC1918 /12 block, public literal IP)', async () => {
    const result = await assertPublicHttpUrl('http://172.32.0.1/');
    expect(result.ip).toBe('172.32.0.1');
    expect(result.family).toBe(4);
  });

  it('preserves url.pathname and url.search in returned AssertedUrl', async () => {
    mockDnsPublic();
    const original = 'https://example.com/some/path?q=hello&r=world';
    const { url } = await assertPublicHttpUrl(original);
    expect(url.pathname).toBe('/some/path');
    expect(url.search).toBe('?q=hello&r=world');
  });
});

describe('assertPublicHttpUrl — DNS resolution check', () => {
  it('accepts hostname resolving to a public IP and returns validated IP', async () => {
    mockDnsPublic();
    const result = await assertPublicHttpUrl('https://example.com');
    expect(result.url).toBeInstanceOf(URL);
    expect(result.ip).toBe(PUBLIC_IP);
    expect(result.family).toBe(4);
  });

  it('rejects hostname resolving to 127.0.0.1', async () => {
    mockDnsPrivate('127.0.0.1');
    await expect(assertPublicHttpUrl('http://evil-rebind.example.com/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects hostname resolving to 10.0.0.1 (RFC1918)', async () => {
    mockDnsPrivate('10.0.0.1');
    await expect(assertPublicHttpUrl('http://internal.example.com/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects hostname resolving to 169.254.169.254 (cloud metadata)', async () => {
    mockDnsPrivate('169.254.169.254');
    await expect(assertPublicHttpUrl('http://metadata.example.com/')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects on DNS failure (fail closed)', async () => {
    mockDnsFailure();
    await expect(assertPublicHttpUrl('http://nxdomain.example.com/')).rejects.toThrow(SsrfBlockedError);
  });

  it('private-only hostname still throws SsrfBlockedError and no fetch occurs', async () => {
    mockDnsPrivate('10.0.0.1');
    await expect(assertPublicHttpUrl('http://internal.corp/')).rejects.toThrow(SsrfBlockedError);
  });
});
