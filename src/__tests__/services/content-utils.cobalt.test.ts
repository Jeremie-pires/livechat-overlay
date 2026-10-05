import dns from 'node:dns';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn().mockImplementation(() => ({
      stdout: { on: vi.fn() },
      kill: vi.fn(),
      on: vi.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'error') setImmediate(() => cb(new Error('ffprobe not available in test')));
      }),
    })),
  };
});

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/env', () => ({
  env: {
    COBALT_API_URL: 'http://cobalt-test:9000',
    COBALT_PUBLIC_URL: undefined,
    API_URL: 'http://localhost:3000',
  },
}));

import fetch from 'node-fetch';
import { getContentInformationsFromUrl, isTikTokUrl, isTwitterUrl } from '../../services/content-utils';

const PUBLIC_IP = '93.184.216.34';

function makeCobaltResponse(body: object, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    headers: { get: () => null },
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (global as Record<string, unknown>).logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  vi.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: PUBLIC_IP, family: 4 }] as dns.LookupAddress[]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── URL detectors ─────────────────────────────────────────────────────────────

describe('isTikTokUrl', () => {
  it.each([
    ['https://www.tiktok.com/@user/video/123456', true],
    ['https://tiktok.com/@user/video/123456', true],
    ['https://vm.tiktok.com/ZM8abcd/', true],
    ['https://vt.tiktok.com/ZS8xyz/', true],
    ['https://youtube.com/watch?v=abc', false],
    ['https://twitter.com/user/status/123', false],
    ['https://evilttiktok.com/video/1', false],
    ['not-a-url', false],
  ])('%s → %s', (url, expected) => {
    expect(isTikTokUrl(url)).toBe(expected);
  });
});

describe('isTwitterUrl', () => {
  it.each([
    ['https://twitter.com/user/status/123456', true],
    ['https://www.twitter.com/user/status/123456', true],
    ['https://x.com/user/status/123456', true],
    ['https://www.x.com/user/status/123456', true],
    ['https://t.co/ABCDEF1234', true],
    ['https://tiktok.com/@user/video/123', false],
    ['https://xcom.example.com/status/1', false],
    ['not-a-url', false],
  ])('%s → %s', (url, expected) => {
    expect(isTwitterUrl(url)).toBe(expected);
  });
});

// ── Cobalt resolver — tunnel path ─────────────────────────────────────────────

describe('getContentInformationsFromUrl — TikTok via Cobalt (tunnel)', () => {
  it('returns video/mp4 with a server proxy URL when Cobalt returns tunnel status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCobaltResponse({ status: 'tunnel', url: 'http://cobalt-test:9000/tunnel?id=abc123' }) as never,
    );

    const result = await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/123456');

    expect(result.contentType).toBe('video/mp4');
    expect(result.resolvedUrl).toMatch(/^http:\/\/localhost:3000\/api\/video\?t=[\w-]+$/);
    expect(result.mediaIsShort).toBe(false);
  });

  it('does not call the SSRF-guarded fetch path for TikTok URLs (Cobalt handles it)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCobaltResponse({ status: 'tunnel', url: 'http://cobalt-test:9000/tunnel?id=xyz' }) as never,
    );

    await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/123456');

    // Only one fetch call: the Cobalt POST (no SSRF-guarded fetch for the original URL)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://cobalt-test:9000',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ── Cobalt resolver — redirect path ──────────────────────────────────────────

describe('getContentInformationsFromUrl — Twitter via Cobalt (redirect)', () => {
  it('returns video/mp4 with a server proxy URL when Cobalt returns redirect status', async () => {
    const cdnUrl = 'https://video.twimg.com/ext_tw_video/123/mp4/vid/720x1280/abc.mp4';
    vi.mocked(fetch).mockResolvedValueOnce(makeCobaltResponse({ status: 'redirect', url: cdnUrl }) as never);

    const result = await getContentInformationsFromUrl('https://x.com/user/status/987654321');

    expect(result.contentType).toBe('video/mp4');
    expect(result.resolvedUrl).toMatch(/^http:\/\/localhost:3000\/api\/video\?t=[\w-]+$/);
  });
});

// ── Cobalt stream status (alias) ──────────────────────────────────────────────

describe('getContentInformationsFromUrl — Cobalt "stream" status (alias for tunnel)', () => {
  it('returns video/mp4 with proxy URL for "stream" status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCobaltResponse({ status: 'stream', url: 'http://cobalt-test:9000/tunnel?id=s1' }) as never,
    );
    const result = await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/111');
    expect(result.contentType).toBe('video/mp4');
    expect(result.resolvedUrl).toMatch(/^http:\/\/localhost:3000\/api\/video\?t=[\w-]+$/);
  });
});

// ── Cobalt error → iframe fallback ────────────────────────────────────────────

describe('getContentInformationsFromUrl — Cobalt error paths → iframe fallback', () => {
  it('returns video/tiktok fallback when Cobalt returns an error status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCobaltResponse({ status: 'error', error: { code: 'error.api.unreachable' } }) as never,
    );

    const result = await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/123456');

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBeUndefined();
    expect(result.mediaDuration).toBeUndefined();
  });

  it('returns video/twitter fallback when Cobalt returns an error status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCobaltResponse({ status: 'error', error: { code: 'error.api.unreachable' } }) as never,
    );

    const result = await getContentInformationsFromUrl('https://twitter.com/user/status/987');

    expect(result.contentType).toBe('video/twitter');
    expect(result.resolvedUrl).toBeUndefined();
  });

  it('returns video/tiktok fallback when Cobalt fetch throws (network error)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/123456');

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBeUndefined();
  });

  it('returns video/tiktok fallback when Cobalt returns HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeCobaltResponse({}, 500) as never);

    const result = await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/123456');

    expect(result.contentType).toBe('video/tiktok');
  });
});

// ── vm.tiktok.com short links ─────────────────────────────────────────────────

describe('getContentInformationsFromUrl — TikTok short links forwarded to Cobalt', () => {
  it('sends vm.tiktok.com short link to Cobalt without server-side redirect resolution', async () => {
    const shortUrl = 'https://vm.tiktok.com/ZM8abcd/';
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCobaltResponse({ status: 'tunnel', url: 'http://cobalt-test:9000/tunnel?id=short1' }) as never,
    );

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://cobalt-test:9000',
      expect.objectContaining({ body: JSON.stringify({ url: shortUrl }) }),
    );
    expect(result.contentType).toBe('video/mp4');
  });
});

// ── Short-link redirect resolution (no Cobalt) ────────────────────────────────

function makeRedirectResponse(location: string | null, status = 302) {
  return {
    ok: false,
    status,
    json: vi.fn(),
    headers: { get: (h: string) => (h === 'location' ? location : null) },
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };
}

describe('getContentInformationsFromUrl — short-link redirect resolution (Cobalt returns error)', () => {
  it('resolves vm.tiktok.com short URL to canonical URL via HTTP redirect', async () => {
    const shortUrl = 'https://vm.tiktok.com/ZM8abcd/';
    const canonical = 'https://www.tiktok.com/@username/video/7391234567890123456';

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeCobaltResponse({ status: 'error' }) as never) // Cobalt fails
      .mockResolvedValueOnce(makeRedirectResponse(canonical) as never); // redirect

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBe(canonical);
  });

  it('resolves vt.tiktok.com short URL to canonical URL via HTTP redirect', async () => {
    const shortUrl = 'https://vt.tiktok.com/ZS8xyz/';
    const canonical = 'https://www.tiktok.com/@user2/video/9876543210123456789';

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeCobaltResponse({ status: 'error' }) as never)
      .mockResolvedValueOnce(makeRedirectResponse(canonical) as never);

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBe(canonical);
  });

  it('resolves t.co short URL to canonical Twitter URL via HTTP redirect', async () => {
    const shortUrl = 'https://t.co/ABCDEF1234';
    const canonical = 'https://x.com/username/status/1800000000000000001';

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeCobaltResponse({ status: 'error' }) as never)
      .mockResolvedValueOnce(makeRedirectResponse(canonical) as never);

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(result.contentType).toBe('video/twitter');
    expect(result.resolvedUrl).toBe(canonical);
  });

  it('does not resolve redirect when URL already has /video/ID (full TikTok URL)', async () => {
    const fullUrl = 'https://www.tiktok.com/@user/video/7391234567890123456';

    vi.mocked(fetch).mockResolvedValueOnce(makeCobaltResponse({ status: 'error' }) as never);

    const result = await getContentInformationsFromUrl(fullUrl);

    expect(result.contentType).toBe('video/tiktok');
    // resolvedUrl is undefined — no redirect attempted for full URLs
    expect(result.resolvedUrl).toBeUndefined();
    // Only one fetch call (Cobalt), no redirect fetch
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('returns resolvedUrl undefined when redirect target is not a TikTok/Twitter URL', async () => {
    const shortUrl = 'https://vm.tiktok.com/ZM8abcd/';
    const maliciousRedirect = 'https://evil.example.com/page';

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeCobaltResponse({ status: 'error' }) as never)
      .mockResolvedValueOnce(makeRedirectResponse(maliciousRedirect) as never);

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBeUndefined();
  });

  it('returns resolvedUrl undefined when redirect fetch fails', async () => {
    const shortUrl = 'https://vm.tiktok.com/ZM8abcd/';

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeCobaltResponse({ status: 'error' }) as never)
      .mockRejectedValueOnce(new Error('ECONNREFUSED')); // redirect fetch fails

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBeUndefined();
  });
});
