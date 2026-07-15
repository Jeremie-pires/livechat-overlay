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
  it.each([
    ['127.0.0.1'],
    ['127.255.255.255'],
    ['10.0.0.1'],
    ['172.16.0.1'],
    ['172.31.255.255'],
    ['192.168.1.1'],
    ['169.254.169.254'],
    ['0.0.0.0'],
    ['255.255.255.255'],
  ])('returns true for private address %s', (ip) => expect(isPrivateIp(ip)).toBe(true));

  it.each([['172.15.0.1'], ['172.32.0.1'], ['8.8.8.8'], [PUBLIC_IP], ['example.com']])(
    'returns false for public/non-private address %s',
    (ip) => expect(isPrivateIp(ip)).toBe(false),
  );
});

describe('isPrivateIp — IPv6', () => {
  it.each([
    ['::1'],
    ['::'],
    ['fe80::1'],
    ['fe90::1'],
    ['fc00::1'],
    ['fd00::1'],
    ['::ffff:127.0.0.1'],
    ['::ffff:10.0.0.1'],
  ])('returns true for private IPv6 %s', (ip) => expect(isPrivateIp(ip)).toBe(true));

  it.each([['2001:db8::1'], ['::ffff:93.184.216.34']])('returns false for public IPv6 %s', (ip) =>
    expect(isPrivateIp(ip)).toBe(false),
  );
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

  it.each([
    ['file:///etc/passwd'],
    ['ftp://example.com/file'],
    ['gopher://example.com'],
    ['data:text/plain,hello'],
    ['not-a-url'],
    [''],
  ])('rejects disallowed URL "%s"', async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toThrow(SsrfBlockedError);
  });
});

describe('assertPublicHttpUrl — loopback and private literal IPs', () => {
  it.each([
    ['http://localhost/path'],
    ['http://127.0.0.1/'],
    ['http://127.255.255.255/'],
    ['http://0.0.0.0/'],
    ['http://10.0.0.1/'],
    ['http://172.16.0.1/'],
    ['http://192.168.1.1/'],
    ['http://169.254.169.254/'],
    ['http://169.254.0.1/'],
    ['http://[::1]/'],
    ['http://[fc00::1]/'],
    ['http://[::ffff:127.0.0.1]/'],
  ])('rejects private/loopback address %s', async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toThrow(SsrfBlockedError);
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

  it.each([
    ['127.0.0.1', 'http://evil-rebind.example.com/'],
    ['10.0.0.1', 'http://internal.example.com/'],
    ['169.254.169.254', 'http://metadata.example.com/'],
    ['10.0.0.1', 'http://internal.corp/'],
  ])('rejects hostname resolving to private IP %s', async (resolvedIp, url) => {
    mockDnsPrivate(resolvedIp);
    await expect(assertPublicHttpUrl(url)).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects on DNS failure (fail closed)', async () => {
    mockDnsFailure();
    await expect(assertPublicHttpUrl('http://nxdomain.example.com/')).rejects.toThrow(SsrfBlockedError);
  });
});
