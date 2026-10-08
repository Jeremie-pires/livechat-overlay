import dns from 'node:dns';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { getAudioInfoFromUrl } from '../../services/content-utils';

const PUBLIC_IP = '93.184.216.34';
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const AUDIO_DIRECT_URL = 'https://example.com/track.mp3';
const TIKTOK_URL = 'https://www.tiktok.com/@user/video/123456';
const TWITTER_URL = 'https://x.com/user/status/123456789';

function makeHeadResponse(contentType: string | null) {
  return { headers: { get: () => contentType } };
}

function makeYtdlpSpawn(result: object | null) {
  return vi.fn().mockImplementation(() => {
    const stdout = { on: vi.fn() };
    const proc = {
      stdout,
      kill: vi.fn(),
      on: vi.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'close') {
          setImmediate(() => {
            if (result !== null) {
              const handler = stdout.on.mock.calls.find((args: unknown[]) => args[0] === 'data')?.[1] as ((buf: Buffer) => void) | undefined;
              if (handler) handler(Buffer.from(JSON.stringify(result)));
            }
            cb(0);
          });
        }
      }),
    };
    return proc;
  });
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
  (global as Record<string, unknown>).env = {
    YTDLP_PATH: 'yt-dlp',
    YTDLP_COOKIES: undefined,
    API_URL: 'https://api.example.com',
    FFPROBE_PATH: 'ffprobe',
  };
  vi.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: PUBLIC_IP, family: 4 }] as dns.LookupAddress[]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAudioInfoFromUrl — YouTube', () => {
  it('returns proxy URL and duration when yt-dlp succeeds', async () => {
    vi.mocked(spawn).mockImplementation(
      makeYtdlpSpawn({ url: 'https://cdn.example.com/audio.m4a', http_headers: {}, duration: 180 }),
    );

    const result = await getAudioInfoFromUrl(YOUTUBE_URL);

    expect(result).not.toBeNull();
    expect(result!.audioUrl).toContain('/api/video?t=test-token');
    expect(result!.audioDuration).toBe(180);
  });

  it('returns null when yt-dlp fails', async () => {
    vi.mocked(spawn).mockImplementation(
      makeYtdlpSpawn(null),
    );

    const result = await getAudioInfoFromUrl(YOUTUBE_URL);

    expect(result).toBeNull();
    expect(vi.mocked((global as Record<string, { warn: ReturnType<typeof vi.fn> }>).logger.warn)).toHaveBeenCalledWith(
      { url: YOUTUBE_URL },
      'audio: yt-dlp extraction failed',
    );
  });
});

describe('getAudioInfoFromUrl — direct audio URL', () => {
  it('returns audioUrl when Content-Type is audio/mpeg', async () => {
    vi.mocked(fetch).mockResolvedValue(makeHeadResponse('audio/mpeg; charset=utf-8') as never);
    vi.mocked(spawn).mockImplementation(
      makeYtdlpSpawn(null),
    );

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
