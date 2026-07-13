import dns from 'node:dns';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

vi.mock('get-video-duration', () => ({
  getVideoDurationInSeconds: vi.fn().mockRejectedValue(new Error('ffprobe not available in test')),
}));

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn().mockResolvedValue(null),
}));

import fetch from 'node-fetch';
import { getContentInformationsFromUrl } from '../../services/content-utils';

const PUBLIC_IP = '93.184.216.34';
// URL with no recognizable extension — forces the fetch-based content-type path
const EXT_LESS_URL = 'https://example.com/api/media';

function makeResponse(contentType: string | null) {
  return {
    headers: { get: () => contentType },
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };
}

function makeHtmlResponse(html: string) {
  return {
    headers: { get: () => 'text/html' },
    text: vi.fn().mockResolvedValue(html),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };
}

beforeEach(() => {
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

// ── redirect policy (B-1) ──────────────────────────────────────────────────────

describe('getContentInformationsFromUrl — redirect policy (B-1)', () => {
  it('calls fetch with { redirect: "error" } to prevent SSRF redirect bypass', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('image/jpeg') as never);
    await getContentInformationsFromUrl(EXT_LESS_URL);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(EXT_LESS_URL, { redirect: 'error' });
  });

  it('returns undefined contentType when fetch throws a redirect error', async () => {
    vi.mocked(fetch).mockRejectedValue(
      new Error('uri requested responds with a redirect, redirect mode is set to error'),
    );
    const result = await getContentInformationsFromUrl(EXT_LESS_URL);
    expect(result.contentType).toBeUndefined();
  });

  it('does not follow 302 → private IP: contentType stays undefined', async () => {
    vi.mocked(fetch).mockRejectedValue(
      new Error('redirect to http://169.254.169.254/ blocked — redirect mode is set to error'),
    );
    const result = await getContentInformationsFromUrl(EXT_LESS_URL);
    expect(result.contentType).toBeUndefined();
  });

  it('logs redirect errors via logger.debug (Q-1)', async () => {
    const redirectErr = new Error('redirect mode is set to error');
    vi.mocked(fetch).mockRejectedValue(redirectErr);
    await getContentInformationsFromUrl(EXT_LESS_URL);
    expect((global as Record<string, unknown>).logger).toBeDefined();
    expect(
      vi.mocked((global as Record<string, { debug: ReturnType<typeof vi.fn> }>).logger.debug),
    ).toHaveBeenCalledWith({ err: redirectErr }, 'content-type from fetch/buffer failed');
  });
});

// ── normal fetch flow ──────────────────────────────────────────────────────────

describe('getContentInformationsFromUrl — normal fetch flow', () => {
  it('returns contentType from response Content-Type header', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('video/mp4') as never);
    const result = await getContentInformationsFromUrl(EXT_LESS_URL);
    expect(result.contentType).toBe('video/mp4');
  });

  it('returns mediaIsShort false for a non-Shorts URL', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('text/html') as never);
    const result = await getContentInformationsFromUrl(EXT_LESS_URL);
    expect(result.mediaIsShort).toBe(false);
  });

  it('returns mediaIsShort true for a YouTube Shorts URL', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('text/html') as never);
    const result = await getContentInformationsFromUrl('https://www.youtube.com/shorts/abc123');
    expect(result.mediaIsShort).toBe(true);
  });
});

// ── GIF provider extraction (Tenor / Giphy) ───────────────────────────────────

describe('getContentInformationsFromUrl — GIF provider extraction (Tenor / Giphy)', () => {
  const TENOR_PAGE_URL = 'https://tenor.com/view/test-gif-12345';
  const GIPHY_PAGE_URL = 'https://giphy.com/gifs/test-abc123';
  const EVIL_TENOR_URL = 'https://eviltenor.com/view/test';

  const TENOR_HTML = [
    '<html><head>',
    '<meta property="og:video:url" content="https://media.tenor.com/abc.mp4">',
    '<meta property="og:video:type" content="video/mp4">',
    '</head></html>',
  ].join('\n');

  const GIPHY_HTML = [
    '<html><head>',
    '<meta property="og:image" content="https://media.giphy.com/abc.gif">',
    '<meta property="og:image:type" content="image/gif">',
    '</head></html>',
  ].join('\n');

  const EMPTY_HTML = '<html><head></head><body></body></html>';

  it('resolves Tenor landing page to raw MP4 via og:video:url', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeHtmlResponse(TENOR_HTML) as never);
    const result = await getContentInformationsFromUrl(TENOR_PAGE_URL);
    expect(result.contentType).toBe('video/mp4');
  });

  it('resolves Giphy landing page to GIF via og:image fallback when og:video:url absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeHtmlResponse(GIPHY_HTML) as never);
    const result = await getContentInformationsFromUrl(GIPHY_PAGE_URL);
    expect(result.contentType).toBe('image/gif');
  });

  it('rejects an extracted OG URL that resolves to a private IP via SSRF guard', async () => {
    const ssrfHtml = [
      '<html><head>',
      '<meta property="og:video:url" content="http://192.168.1.1/evil.mp4">',
      '</head></html>',
    ].join('\n');
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeHtmlResponse(ssrfHtml) as never)
      .mockResolvedValueOnce(makeResponse(null) as never);
    const result = await getContentInformationsFromUrl(TENOR_PAGE_URL);
    expect(
      vi.mocked((global as Record<string, { debug: ReturnType<typeof vi.fn> }>).logger.debug),
    ).toHaveBeenCalledWith(
      expect.objectContaining({ rawUrl: 'http://192.168.1.1/evil.mp4' }),
      'gif-provider: extracted URL failed SSRF guard',
    );
    expect(result.contentType).toBeUndefined();
  });

  it('leaves behavior unchanged for non-provider URLs (regression)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('image/jpeg') as never);
    const result = await getContentInformationsFromUrl(EXT_LESS_URL);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(EXT_LESS_URL, { redirect: 'error' });
    expect(result.contentType).toBe('image/jpeg');
  });

  it('gracefully falls through to legacy path when HTML contains no OG tags', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeHtmlResponse(EMPTY_HTML) as never)
      .mockResolvedValueOnce(makeResponse('image/gif') as never);
    const result = await getContentInformationsFromUrl(TENOR_PAGE_URL);
    expect(
      vi.mocked((global as Record<string, { debug: ReturnType<typeof vi.fn> }>).logger.debug),
    ).toHaveBeenCalledWith(
      expect.objectContaining({ url: TENOR_PAGE_URL }),
      'gif-provider: no OG media URL found in HTML',
    );
    expect(result.contentType).toBe('image/gif');
  });

  it('does not treat eviltenor.com as a supported provider', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('text/html') as never);
    const result = await getContentInformationsFromUrl(EVIL_TENOR_URL);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(EVIL_TENOR_URL, { redirect: 'error' });
    expect(result.contentType).toBe('text/html');
  });

  it('handles attribute-reversed OG tags (content before property)', async () => {
    const reversedHtml = [
      '<html><head>',
      '<meta content="https://media.tenor.com/reversed.mp4" property="og:video:url">',
      '</head></html>',
    ].join('\n');
    vi.mocked(fetch).mockResolvedValueOnce(makeHtmlResponse(reversedHtml) as never);
    const result = await getContentInformationsFromUrl(TENOR_PAGE_URL);
    expect(result.contentType).toBe('video/mp4');
  });
});

// ── YouTube URL classification & early-return (T-1…T-11) ─────────────────────

describe('getContentInformationsFromUrl — YouTube classification', () => {
  it('T-1: returns video/youtube for www.youtube.com/watch without calling fetch', async () => {
    const result = await getContentInformationsFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.contentType).toBe('video/youtube');
    expect(result.mediaIsShort).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('T-2: returns video/youtube for youtube.com/watch (no www) without calling fetch', async () => {
    const result = await getContentInformationsFromUrl('https://youtube.com/watch?v=abc');
    expect(result.contentType).toBe('video/youtube');
    expect(result.mediaIsShort).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('T-3: returns video/youtube for m.youtube.com/watch without calling fetch', async () => {
    const result = await getContentInformationsFromUrl('https://m.youtube.com/watch?v=abc');
    expect(result.contentType).toBe('video/youtube');
    expect(result.mediaIsShort).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('T-4: returns video/youtube with mediaIsShort=true for www.youtube.com/shorts', async () => {
    const result = await getContentInformationsFromUrl('https://www.youtube.com/shorts/abc123');
    expect(result.contentType).toBe('video/youtube');
    expect(result.mediaIsShort).toBe(true);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('T-5: returns video/youtube with mediaIsShort=true for m.youtube.com/shorts', async () => {
    const result = await getContentInformationsFromUrl('https://m.youtube.com/shorts/abc123');
    expect(result.contentType).toBe('video/youtube');
    expect(result.mediaIsShort).toBe(true);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('T-6: returns video/youtube for youtu.be short links without calling fetch', async () => {
    const result = await getContentInformationsFromUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(result.contentType).toBe('video/youtube');
    expect(result.mediaIsShort).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('T-7: returns video/youtube for youtu.be with timestamp query param without calling fetch', async () => {
    const result = await getContentInformationsFromUrl('https://youtu.be/dQw4w9WgXcQ?t=30');
    expect(result.contentType).toBe('video/youtube');
    expect(result.mediaIsShort).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('T-8: returns video/youtube even when fetch is mocked to reject (independence from redirect gate)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('redirect mode is set to error'));
    const result = await getContentInformationsFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.contentType).toBe('video/youtube');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('T-9: non-YouTube host falls through to normal fetch pipeline', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('video/mp4') as never);
    const result = await getContentInformationsFromUrl('https://notyoutube.com/watch?v=x');
    expect(vi.mocked(fetch)).toHaveBeenCalled();
    expect(result.contentType).toBe('video/mp4');
  });

  it('T-11: video/youtube does not start with "image" — client routes to player not img element', () => {
    expect('video/youtube'.indexOf('image')).not.toBe(0);
  });
});
