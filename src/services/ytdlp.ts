import { parseCookiesForDomain } from './cookies-parser';
import { env } from './env';
import { runProcess } from './spawn-process';

const YTDLP_TIMEOUT_MS = 20_000;
const MAX_CONCURRENT = 5;

let activeSemaphore = 0;
const semaphoreQueue: Array<() => void> = [];

function acquireSemaphore(): Promise<void> {
  if (activeSemaphore < MAX_CONCURRENT) {
    activeSemaphore++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    semaphoreQueue.push(() => {
      activeSemaphore++;
      resolve();
    });
  });
}

function releaseSemaphore(): void {
  activeSemaphore--;
  const next = semaphoreQueue.shift();
  if (next) next();
}

export interface YtdlpResult {
  url: string;
  headers: Record<string, string>;
  duration?: number;
}

// In-flight dedup: concurrent callers for the same URL share one yt-dlp process.
const inFlight = new Map<string, Promise<YtdlpResult | null>>();

export async function extractVideoUrl(url: string, cookiesFile?: string): Promise<YtdlpResult | null> {
  const key = `video:${url}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = _runYtdlp(url, cookiesFile).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function _runYtdlp(url: string, cookiesFile?: string): Promise<YtdlpResult | null> {
  await acquireSemaphore();
  try {
    const args = [
      '--no-playlist',
      '--format',
      'best[ext=mp4][vcodec^=h264]/best[ext=mp4]/best',
      '-J',
      ...(cookiesFile ? ['--cookies', cookiesFile] : []),
      url,
    ];

    const result = await runProcess<YtdlpResult>(env.YTDLP_PATH, args, YTDLP_TIMEOUT_MS, (stdout) => {
      try {
        const info = JSON.parse(stdout) as {
          url?: string;
          http_headers?: Record<string, string>;
          duration?: number;
        };
        const cdnUrl = info.url;
        if (!cdnUrl?.startsWith('http')) return null;
        const duration =
          typeof info.duration === 'number' && Number.isFinite(info.duration) && info.duration > 0
            ? info.duration
            : undefined;
        return { url: cdnUrl, headers: info.http_headers ?? {}, duration };
      } catch {
        return null;
      }
    });

    if (!result || !cookiesFile) return result;

    // Inject CDN cookies so the proxy can forward them (e.g. tt_chain_token for TikTok)
    try {
      const cdnDomain = new URL(result.url).hostname;
      const cookieHeader = await parseCookiesForDomain(cookiesFile, cdnDomain);
      if (cookieHeader) {
        return { url: result.url, headers: { ...result.headers, Cookie: cookieHeader }, duration: result.duration };
      }
    } catch {
      // Malformed CDN URL — return result without Cookie header
    }

    return result;
  } finally {
    releaseSemaphore();
  }
}
