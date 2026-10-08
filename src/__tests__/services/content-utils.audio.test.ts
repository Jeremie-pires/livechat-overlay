import dns from 'node:dns';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAudioInfoFromUrl } from '../../services/content-utils';

// vi.hoisted runs before vi.mock hoisting, making mockEnv available in the factory.
// String literals must be inlined here — module-level consts are not yet initialized.
const mockEnv = vi.hoisted(() => ({
  YTDLP_PATH: 'yt-dlp',
  YTDLP_COOKIES: undefined as string | undefined,
  API_URL: 'http://localhost:3000',
  FFPROBE_PATH: 'ffprobe',
  COBALT_API_URL: 'https://cobalt.example.com/api/json' as string | undefined,
  COBALT_PUBLIC_URL: undefined as string | undefined,
}));

vi.mock('../../services/env', () => ({ env: mockEnv }));

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/video-proxy-cache', () => ({
  findOrCreateProxy: vi.fn().mockReturnValue('test-token'),
}));

const PUBLIC_IP = '93.184.216.34';
const COBALT_API_URL = 'https://cobalt.example.com/api/json';
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const AUDIO_DIRECT_URL = 'https://example.com/track.mp3';
const TIKTOK_URL = 'https://www.tiktok.com/@user/video/123456';
const TWITTER_URL = 'https://x.com/user/status/123456789';

function makeHeadResponse(contentType: string | null) {
  return { headers: { get: () => contentType } };
}

function makeCobaltResponse(status: string, url: string) {
  return { ok: true, json: async () => ({ status, url }) };
}

// Returns a process mock that exits immediately with no stdout output.
function spawnNoOutput() {
  const stdout = { on: vi.fn() };
  return {
    stdout,
    kill: vi.fn(),
    on: vi.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'close') setImmediate(() => cb(0));
    }),
  } as unknown as ReturnType<typeof spawn>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.COBALT_API_URL = COBALT_API_URL;
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
  vi.mocked(spawn).mockImplementation(spawnNoOutput);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAudioInfoFromUrl — YouTube', () => {
  it('returns proxy URL when Cobalt succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeCobaltResponse('redirect', 'https://cdn.example.com/audio.m4a') as never,
    );

    const result = await getAudioInfoFromUrl(YOUTUBE_URL);

    expect(result).not.toBeNull();
    expect(result!.audioUrl).toContain('/api/video?t=test-token');
    expect(vi.mocked((global as Record<string, { info: ReturnType<typeof vi.fn> }>).logger.info)).toHaveBeenCalledWith(
      { url: YOUTUBE_URL },
      'audio: cobalt extraction succeeded',
    );
  });

  it('returns null when Cobalt is not configured', async () => {
    mockEnv.COBALT_API_URL = undefined;

    const result = await getAudioInfoFromUrl(YOUTUBE_URL);

    expect(result).toBeNull();
    expect(vi.mocked((global as Record<string, { warn: ReturnType<typeof vi.fn> }>).logger.warn)).toHaveBeenCalledWith(
      { url: YOUTUBE_URL },
      'audio: cobalt extraction failed',
    );
  });

  it('returns null when Cobalt returns an error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as never);

    const result = await getAudioInfoFromUrl(YOUTUBE_URL);

    expect(result).toBeNull();
    expect(vi.mocked((global as Record<string, { warn: ReturnType<typeof vi.fn> }>).logger.warn)).toHaveBeenCalledWith(
      { url: YOUTUBE_URL },
      'audio: cobalt extraction failed',
    );
  });
});

describe('getAudioInfoFromUrl — direct audio URL', () => {
  it('returns audioUrl when Content-Type is audio/mpeg', async () => {
    vi.mocked(fetch).mockResolvedValue(makeHeadResponse('audio/mpeg; charset=utf-8') as never);

    const result = await getAudioInfoFromUrl(AUDIO_DIRECT_URL);

    expect(result).not.toBeNull();
    expect(result!.audioUrl).toBe(AUDIO_DIRECT_URL);
  });

  it('returns null when Content-Type is video/mp4', async () => {
    vi.mocked(fetch).mockResolvedValue(makeHeadResponse('video/mp4') as never);

    const result = await getAudioInfoFromUrl(AUDIO_DIRECT_URL);

    expect(result).toBeNull();
    expect(vi.mocked((global as Record<string, { debug: ReturnType<typeof vi.fn> }>).logger.debug)).toHaveBeenCalledWith(
      expect.objectContaining({ url: AUDIO_DIRECT_URL }),
      'audio: not an audio content-type',
    );
  });

  it('returns null when HEAD request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    const result = await getAudioInfoFromUrl(AUDIO_DIRECT_URL);

    expect(result).toBeNull();
  });
});

describe('getAudioInfoFromUrl — rejected domains', () => {
  it('returns null for TikTok URL', async () => {
    const result = await getAudioInfoFromUrl(TIKTOK_URL);

    expect(result).toBeNull();
    expect(vi.mocked((global as Record<string, { debug: ReturnType<typeof vi.fn> }>).logger.debug)).toHaveBeenCalledWith(
      { url: TIKTOK_URL },
      'audio: rejected domain (tiktok/twitter not supported for audio)',
    );
  });

  it('returns null for Twitter/X URL', async () => {
    const result = await getAudioInfoFromUrl(TWITTER_URL);

    expect(result).toBeNull();
  });
});

describe('getAudioInfoFromUrl — SSRF', () => {
  it('returns null for private IP', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '192.168.1.1', family: 4 }] as dns.LookupAddress[]);

    const result = await getAudioInfoFromUrl('https://internal.corp/audio.mp3');

    expect(result).toBeNull();
    expect(vi.mocked((global as Record<string, { debug: ReturnType<typeof vi.fn> }>).logger.debug)).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'audio: SSRF guard failed',
    );
  });
});
