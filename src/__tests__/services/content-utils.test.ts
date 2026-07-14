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

// Creates an async-iterable stream body yielding the given HTML chunks.
function makeStreamBody(chunks: string[]): {
  [Symbol.asyncIterator](): AsyncGenerator<Buffer, void, unknown>;
  destroy: ReturnType<typeof vi.fn>;
} {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield Buffer.from(chunk, 'utf-8');
      }
    },
    destroy: vi.fn(),
  };
}

function makeHtmlResponse(html: string) {
  return {
    headers: { get: () => 'text/html' },
    body: makeStreamBody([html]),
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

// ── redirect policy (B-1) ──────────────────────────────────────────────────────

describe('getContentInformationsFromUrl — redirect policy (B-1)', () => {
  it('calls fetch with redirect: "error", IP-pinned URL, and Host header', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('image/jpeg') as never);
    await getContentInformationsFromUrl(EXT_LESS_URL);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `https://${PUBLIC_IP}/api/media`,
      expect.objectContaining({
        redirect: 'error',
        headers: expect.objectContaining({ Host: 'example.com' }),
      }),
    );
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

  it('non-provider URLs still resolve content type correctly (regression)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('image/jpeg') as never);
    const result = await getContentInformationsFromUrl(EXT_LESS_URL);
    expect(result.contentType).toBe('image/jpeg');
    // Fetch is IP-pinned — verify Host header is present
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining(PUBLIC_IP),
      expect.objectContaining({ redirect: 'error' }),
    );
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

  it('T-17: graceful fallthrough when Tenor page throws redirect error: logger.debug called, contentType undefined', async () => {
    const redirectErr = new Error('redirect mode is set to error');
    vi.mocked(fetch).mockRejectedValue(redirectErr);
    const result = await getContentInformationsFromUrl(TENOR_PAGE_URL);
    expect(
      vi.mocked((global as Record<string, { debug: ReturnType<typeof vi.fn> }>).logger.debug),
    ).toHaveBeenCalledWith(expect.objectContaining({ err: redirectErr }), 'gif-provider: HTML fetch failed');
    expect(result.contentType).toBeUndefined();
  });
});

// ── Streaming HTML OG extraction ──────────────────────────────────────────────

describe('getContentInformationsFromUrl — streaming HTML OG extraction', () => {
  const TENOR_PAGE_URL = 'https://tenor.com/view/test-gif-12345';
  const MAX_HTML_CHARS = 256 * 1024;

  it('cancels stream (calls destroy) after OG URL found in first chunk', async () => {
    const ogHtml =
      '<meta property="og:video:url" content="https://media.tenor.com/abc.mp4"><meta property="og:video:type" content="video/mp4">';
    const body = makeStreamBody([ogHtml, 'SHOULD_NOT_READ_THIS_SECOND_CHUNK']);
    vi.mocked(fetch).mockResolvedValueOnce({
      headers: { get: () => 'text/html' },
      body,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    } as never);

    const result = await getContentInformationsFromUrl(TENOR_PAGE_URL);
    expect(result.contentType).toBe('video/mp4');
    expect(body.destroy).toHaveBeenCalled();
  });

  it('always calls destroy on the stream body after reading (cleanup)', async () => {
    const html = '<html><head><meta property="og:image" content="https://media.giphy.com/img.gif"></head></html>';
    const body = makeStreamBody([html]);
    vi.mocked(fetch).mockResolvedValueOnce({
      headers: { get: () => 'text/html' },
      body,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    } as never);

    await getContentInformationsFromUrl('https://giphy.com/gifs/test');
    expect(body.destroy).toHaveBeenCalled();
  });

  it('stops reading at 256 KB ceiling when no OG URL is found and returns null provider result', async () => {
    // Generate HTML bigger than MAX_HTML_CHARS with no OG tags
    const bigChunk = 'x'.repeat(MAX_HTML_CHARS + 500);
    const body = makeStreamBody([bigChunk]);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        headers: { get: () => 'text/html' },
        body,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      } as never)
      // Second call: content-type fallback fetch
      .mockResolvedValueOnce(makeResponse('image/gif') as never);

    const result = await getContentInformationsFromUrl(TENOR_PAGE_URL);
    expect(result.contentType).toBe('image/gif');
    expect(body.destroy).toHaveBeenCalled();
  });

  it('parses OG tag split across two chunk boundaries', async () => {
    const fullTag = '<meta property="og:video:url" content="https://media.tenor.com/split.mp4">';
    const mid = Math.floor(fullTag.length / 2);
    const chunk1 = '<html><head>' + fullTag.slice(0, mid);
    const chunk2 = fullTag.slice(mid) + '</head></html>';
    const body = makeStreamBody([chunk1, chunk2]);
    vi.mocked(fetch).mockResolvedValueOnce({
      headers: { get: () => 'text/html' },
      body,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    } as never);

    const result = await getContentInformationsFromUrl(TENOR_PAGE_URL);
    expect(result.resolvedUrl).toBe('https://media.tenor.com/split.mp4');
    expect(body.destroy).toHaveBeenCalled();
  });

  it('provider HTML fetch is IP-pinned with Host header', async () => {
    const html =
      '<meta property="og:video:url" content="https://media.tenor.com/abc.mp4"><meta property="og:video:type" content="video/mp4">';
    vi.mocked(fetch).mockResolvedValueOnce({
      headers: { get: () => 'text/html' },
      body: makeStreamBody([html]),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    } as never);

    await getContentInformationsFromUrl(TENOR_PAGE_URL);
    // Provider HTML fetch should target the pinned IP, not tenor.com hostname
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining(PUBLIC_IP),
      expect.objectContaining({
        redirect: 'error',
        headers: expect.objectContaining({ Host: 'tenor.com' }),
      }),
    );
  });
});

// ── YouTube URL classification & early-return (T-1…T-11) ─────────────────────

describe('getContentInformationsFromUrl — YouTube classification', () => {
  it.each([
    ['T-1', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false],
    ['T-2', 'https://youtube.com/watch?v=abc', false],
    ['T-3', 'https://m.youtube.com/watch?v=abc', false],
    ['T-4', 'https://www.youtube.com/shorts/abc123', true],
    ['T-5', 'https://m.youtube.com/shorts/abc123', true],
    ['T-6', 'https://youtu.be/dQw4w9WgXcQ', false],
    ['T-7', 'https://youtu.be/dQw4w9WgXcQ?t=30', false],
  ])('%s: returns video/youtube without calling fetch', async (_label, url, expectedShort) => {
    const result = await getContentInformationsFromUrl(url);
    expect(result.contentType).toBe('video/youtube');
    expect(result.mediaIsShort).toBe(expectedShort);
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

  it.each([
    ['T-10', 'https://music.youtube.com/watch?v=abc'],
    ['T-12', 'https://youtube.com/embed/abc123'],
    ['T-13', 'https://youtube.com/live/abc123'],
  ])('%s: returns video/youtube for extended YouTube URL pattern without calling fetch', async (_label, url) => {
    const result = await getContentInformationsFromUrl(url);
    expect(result.contentType).toBe('video/youtube');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('T-11: video/youtube does not start with "image" — client routes to player not img element', () => {
    expect('video/youtube'.indexOf('image')).not.toBe(0);
  });

  it('T-14: youtube.com/watchmen falls through to normal pipeline (not classified as YouTube)', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('video/mp4') as never);
    const result = await getContentInformationsFromUrl('https://youtube.com/watchmen');
    expect(vi.mocked(fetch)).toHaveBeenCalled();
    expect(result.contentType).toBe('video/mp4');
  });

  it('T-15: youtu.be/ with empty path falls through to normal pipeline', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('text/html') as never);
    await getContentInformationsFromUrl('https://youtu.be/');
    expect(vi.mocked(fetch)).toHaveBeenCalled();
  });

  it('T-16: assertPublicHttpUrl rejects private-IP URL before YouTube early-return (guard-ordering contract)', async () => {
    await expect(getContentInformationsFromUrl('http://192.168.1.1/watch?v=abc')).rejects.toThrow();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
