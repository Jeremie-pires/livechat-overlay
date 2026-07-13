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
