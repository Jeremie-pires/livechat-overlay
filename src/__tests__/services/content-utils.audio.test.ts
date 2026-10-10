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
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const AUDIO_DIRECT_URL = 'https://example.com/track.mp3';
const TIKTOK_URL = 'https://www.tiktok.com/@user/video/123456';
const TWITTER_URL = 'https://x.com/user/status/123456789';

function makeHeadResponse(contentType: string | null) {
  return { headers: { get: () => contentType } };
}

// Returns a process mock that exits with the given code and no stdout output.
function spawnExitCode(code = 0) {
  const stdout = { on: vi.fn() };
  return {
    stdout,
    kill: vi.fn(),
    on: vi.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'close') setImmediate(() => cb(code));
    }),
  } as unknown as ReturnType<typeof spawn>;
}

// Returns a process mock that emits JSON on stdout then exits 0.
function spawnYtdlpOutput(data: object) {
  const dataListeners: Array<(chunk: Buffer) => void> = [];
  const stdout = {
    on: vi.fn().mockImplementation((event: string, cb: (chunk: Buffer) => void) => {
      if (event === 'data') dataListeners.push(cb);
    }),
  };
  return {
    stdout,
    kill: vi.fn(),
    on: vi.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'close') {
        setImmediate(() => {
          dataListeners.forEach((l) => l(Buffer.from(JSON.stringify(data))));
          cb(0);
        });
      }
    }),
  } as unknown as ReturnType<typeof spawn>;
}

const LOG_KEYS = ['debug', 'info', 'warn', 'error', 'fatal', 'trace', 'silent'];
let logMock: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  logMock = Object.fromEntries(LOG_KEYS.map((k) => [k, vi.fn()]));
  logMock.child = vi.fn().mockReturnThis();
  (global as Record<string, unknown>).logger = logMock;
  vi.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: PUBLIC_IP, family: 4 }] as dns.LookupAddress[]);
  vi.mocked(spawn).mockImplementation(() => spawnExitCode());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAudioInfoFromUrl — YouTube', () => {
  it('returns proxy URL with duration when yt-dlp succeeds', async () => {
    vi.mocked(spawn).mockReturnValueOnce(
      spawnYtdlpOutput({
        url: 'https://cdn.example.com/audio.m4a',
        http_headers: { 'User-Agent': 'yt-dlp' },
        duration: 212.5,
      }),
    );

    const result = await getAudioInfoFromUrl(YOUTUBE_URL);

    expect(result).not.toBeNull();
    expect(result!.audioUrl).toContain('/api/video?t=test-token');
    expect(result!.audioDuration).toBe(212.5);
    expect(logMock.info).toHaveBeenCalledWith(
      { url: YOUTUBE_URL, duration: 212.5 },
      'audio: yt-dlp extraction succeeded',
    );
  });

  it('returns null when yt-dlp returns no output', async () => {
    const result = await getAudioInfoFromUrl(YOUTUBE_URL);

    expect(result).toBeNull();
    expect(logMock.warn).toHaveBeenCalledWith({ url: YOUTUBE_URL }, 'audio: yt-dlp extraction failed');
  });

  it('returns null when yt-dlp process exits with non-zero code', async () => {
    vi.mocked(spawn).mockReturnValueOnce(spawnExitCode(1));

    const result = await getAudioInfoFromUrl(YOUTUBE_URL);

    expect(result).toBeNull();
    expect(logMock.warn).toHaveBeenCalledWith({ url: YOUTUBE_URL }, 'audio: yt-dlp extraction failed');
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
    expect(logMock.debug).toHaveBeenCalledWith(
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
    expect(logMock.debug).toHaveBeenCalledWith(
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
    expect(logMock.debug).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'audio: SSRF guard failed',
    );
  });
});
