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
    YTDLP_COOKIES: undefined,
  },
}));

vi.mock('../../services/ytdlp', () => ({
  extractVideoUrl: vi.fn(),
}));

import fetch from 'node-fetch';
import { extractVideoUrl } from '../../services/ytdlp';
import { getContentInformationsFromUrl, isTikTokUrl, isTwitterUrl } from '../../services/content-utils';

const PUBLIC_IP = '93.184.216.34';
const TIKTOK_CDN = 'https://v19-webapp.tiktok.com/video/tos/abc.mp4';
const TIKTOK_RESULT = { url: TIKTOK_CDN, headers: { 'User-Agent': 'Mozilla/5.0', Cookie: 'tt_chain_token=x' }, duration: 42 };

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
    ['https://twitter.com/user/status/123456/video/1', true],
    ['https://www.twitter.com/user/status/123456/video/1', true],
    ['https://x.com/user/status/123456/video/1', true],
    ['https://www.x.com/user/status/123456/video/2', true],
    ['https://x.com/user/status/123456', true],
    ['https://twitter.com/user/status/123456', true],
    ['https://t.co/ABCDEF1234', false],
    ['https://tiktok.com/@user/video/123', false],
    ['https://xcom.example.com/status/1', false],
    ['not-a-url', false],
  ])('%s → %s', (url, expected) => {
    expect(isTwitterUrl(url)).toBe(expected);
  });
});

// ── URL sanitization ─────────────────────────────────────────────────────────

describe('getContentInformationsFromUrl — tracking param stripping', () => {
  it('strips TikTok tracking params before passing to yt-dlp', async () => {
    vi.mocked(extractVideoUrl).mockResolvedValueOnce(TIKTOK_RESULT);

    await getContentInformationsFromUrl(
      'https://www.tiktok.com/@user/video/123456?is_from_webapp=1&sender_device=pc',
    );

    expect(vi.mocked(extractVideoUrl)).toHaveBeenCalledWith(
      'https://www.tiktok.com/@user/video/123456',
      undefined,
    );
  });

  it('strips Twitter tracking params before passing to Cobalt', async () => {
    const cdnUrl = 'https://video.twimg.com/ext_tw_video/123/mp4/vid/720x1280/abc.mp4';
    vi.mocked(fetch).mockResolvedValueOnce(makeCobaltResponse({ status: 'redirect', url: cdnUrl }) as never);

    await getContentInformationsFromUrl('https://x.com/user/status/987654321/video/1?s=20&t=abc123');

    const cobaltCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(cobaltCall[1]?.body as string) as { url: string };
    expect(body.url).toBe('https://x.com/user/status/987654321');
  });
});

// ── TikTok via yt-dlp ────────────────────────────────────────────────────────

describe('getContentInformationsFromUrl — TikTok via yt-dlp', () => {
  it('returns video/mp4 with a server proxy URL when yt-dlp extracts a CDN URL', async () => {
    vi.mocked(extractVideoUrl).mockResolvedValueOnce(TIKTOK_RESULT);

    const result = await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/123456');

    expect(result.contentType).toBe('video/mp4');
    expect(result.resolvedUrl).toMatch(/^http:\/\/localhost:3000\/api\/video\?t=[\w-]+$/);
    expect(result.mediaIsShort).toBe(false);
  });

  it('does not call Cobalt for TikTok URLs', async () => {
    vi.mocked(extractVideoUrl).mockResolvedValueOnce(TIKTOK_RESULT);

    await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/123456');

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(vi.mocked(extractVideoUrl)).toHaveBeenCalledWith('https://www.tiktok.com/@user/video/123456', undefined);
  });

  it('uses duration from yt-dlp JSON (not ffprobe, which would 403 on CDN without Cookie)', async () => {
    vi.mocked(extractVideoUrl).mockResolvedValueOnce(TIKTOK_RESULT);

    const result = await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/123456');

    expect(result.mediaDuration).toBe(42);
    // fetch is not called (no ffprobe HTTP request via fetch mock)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('passes vm.tiktok.com short links to yt-dlp directly (no HTTP redirect resolution)', async () => {
    const shortUrl = 'https://vm.tiktok.com/ZM8abcd/';
    vi.mocked(extractVideoUrl).mockResolvedValueOnce(TIKTOK_RESULT);

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(vi.mocked(extractVideoUrl)).toHaveBeenCalledWith(shortUrl, undefined);
    expect(result.contentType).toBe('video/mp4');
    // No Cobalt / HTTP redirect fetch
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

// ── Twitter via Cobalt (redirect) ────────────────────────────────────────────

describe('getContentInformationsFromUrl — Twitter via Cobalt (redirect)', () => {
  it('returns video/mp4 with a server proxy URL when Cobalt returns redirect status', async () => {
    const cdnUrl = 'https://video.twimg.com/ext_tw_video/123/mp4/vid/720x1280/abc.mp4';
    vi.mocked(fetch).mockResolvedValueOnce(makeCobaltResponse({ status: 'redirect', url: cdnUrl }) as never);

    const result = await getContentInformationsFromUrl('https://x.com/user/status/987654321/video/1');

    expect(result.contentType).toBe('video/mp4');
    expect(result.resolvedUrl).toMatch(/^http:\/\/localhost:3000\/api\/video\?t=[\w-]+$/);
  });

  it('does not call yt-dlp for Twitter URLs', async () => {
    const cdnUrl = 'https://video.twimg.com/ext_tw_video/123/mp4/vid/720x1280/abc.mp4';
    vi.mocked(fetch).mockResolvedValueOnce(makeCobaltResponse({ status: 'redirect', url: cdnUrl }) as never);

    await getContentInformationsFromUrl('https://x.com/user/status/987654321/video/1');

    expect(vi.mocked(extractVideoUrl)).not.toHaveBeenCalled();
  });
});

// ── Cobalt "stream" status (Twitter) ─────────────────────────────────────────

describe('getContentInformationsFromUrl — Cobalt "stream" status (Twitter)', () => {
  it('returns video/mp4 with proxy URL for "stream" status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCobaltResponse({ status: 'stream', url: 'http://cobalt-test:9000/tunnel?id=s1' }) as never,
    );
    const result = await getContentInformationsFromUrl('https://twitter.com/user/status/111/video/1');
    expect(result.contentType).toBe('video/mp4');
    expect(result.resolvedUrl).toMatch(/^http:\/\/localhost:3000\/api\/video\?t=[\w-]+$/);
  });
});

// ── Fallback to iframe ────────────────────────────────────────────────────────

describe('getContentInformationsFromUrl — iframe fallback when extraction fails', () => {
  it('returns video/tiktok fallback when yt-dlp returns null', async () => {
    vi.mocked(extractVideoUrl).mockResolvedValueOnce(null);

    const result = await getContentInformationsFromUrl('https://www.tiktok.com/@user/video/123456');

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBeUndefined();
    expect(result.mediaDuration).toBeUndefined();
  });

  it('returns video/twitter fallback when Cobalt returns an error status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCobaltResponse({ status: 'error', error: { code: 'error.api.unreachable' } }) as never,
    );

    const result = await getContentInformationsFromUrl('https://twitter.com/user/status/987/video/1');

    expect(result.contentType).toBe('video/twitter');
    expect(result.resolvedUrl).toBeUndefined();
  });

  it('returns video/twitter fallback when Cobalt fetch throws (network error)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await getContentInformationsFromUrl('https://twitter.com/user/status/123456/video/1');

    expect(result.contentType).toBe('video/twitter');
    expect(result.resolvedUrl).toBeUndefined();
  });

  it('returns video/twitter fallback when Cobalt returns HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeCobaltResponse({}, 500) as never);

    const result = await getContentInformationsFromUrl('https://twitter.com/user/status/123456/video/1');

    expect(result.contentType).toBe('video/twitter');
  });
});

// ── Short-link redirect resolution (yt-dlp / Cobalt failed) ──────────────────

function makeRedirectResponse(location: string | null, status = 302) {
  return {
    ok: false,
    status,
    json: vi.fn(),
    headers: { get: (h: string) => (h === 'location' ? location : null) },
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };
}

describe('getContentInformationsFromUrl — short-link redirect resolution after failure', () => {
  it('resolves vm.tiktok.com short URL to canonical URL when yt-dlp fails', async () => {
    const shortUrl = 'https://vm.tiktok.com/ZM8abcd/';
    const canonical = 'https://www.tiktok.com/@username/video/7391234567890123456';

    vi.mocked(extractVideoUrl).mockResolvedValueOnce(null);
    vi.mocked(fetch).mockResolvedValueOnce(makeRedirectResponse(canonical) as never);

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBe(canonical);
  });

  it('resolves vt.tiktok.com short URL to canonical URL when yt-dlp fails', async () => {
    const shortUrl = 'https://vt.tiktok.com/ZS8xyz/';
    const canonical = 'https://www.tiktok.com/@user2/video/9876543210123456789';

    vi.mocked(extractVideoUrl).mockResolvedValueOnce(null);
    vi.mocked(fetch).mockResolvedValueOnce(makeRedirectResponse(canonical) as never);

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBe(canonical);
  });

  it('does not attempt HTTP redirect for full TikTok URL when yt-dlp fails', async () => {
    const fullUrl = 'https://www.tiktok.com/@user/video/7391234567890123456';

    vi.mocked(extractVideoUrl).mockResolvedValueOnce(null);

    const result = await getContentInformationsFromUrl(fullUrl);

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBeUndefined();
    // No HTTP redirect fetch
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('returns resolvedUrl undefined when redirect target is not a TikTok URL', async () => {
    const shortUrl = 'https://vm.tiktok.com/ZM8abcd/';

    vi.mocked(extractVideoUrl).mockResolvedValueOnce(null);
    vi.mocked(fetch).mockResolvedValueOnce(makeRedirectResponse('https://evil.example.com/page') as never);

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBeUndefined();
  });

  it('returns resolvedUrl undefined when redirect fetch fails for TikTok', async () => {
    const shortUrl = 'https://vm.tiktok.com/ZM8abcd/';

    vi.mocked(extractVideoUrl).mockResolvedValueOnce(null);
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await getContentInformationsFromUrl(shortUrl);

    expect(result.contentType).toBe('video/tiktok');
    expect(result.resolvedUrl).toBeUndefined();
  });
});
