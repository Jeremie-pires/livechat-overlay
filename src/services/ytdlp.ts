import { spawn } from 'node:child_process';
import { parseCookiesForDomain } from './cookies-parser';
import { env } from './env';

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

// In-flight dedup: concurrent callers for the same URL share one yt-dlp process
const inFlight = new Map<string, Promise<YtdlpResult | null>>();

export async function extractVideoUrl(url: string, cookiesFile?: string): Promise<YtdlpResult | null> {
  const existing = inFlight.get(url);
  if (existing) return existing;

  const promise = _runYtdlp(url, cookiesFile).finally(() => inFlight.delete(url));
  inFlight.set(url, promise);
  return promise;
}

async function _runYtdlp(url: string, cookiesFile?: string): Promise<YtdlpResult | null> {
  await acquireSemaphore();
  try {
    const result = await new Promise<YtdlpResult | null>((resolve) => {
      const args = [
        '--no-playlist',
        '--format',
        'best[ext=mp4]/best',
        '-J',
        ...(cookiesFile ? ['--cookies', cookiesFile] : []),
        url,
      ];

      let stdout = '';
      let settled = false;

      const settle = (val: YtdlpResult | null) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };

      let proc: ReturnType<typeof spawn>;
      try {
        proc = spawn(env.YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        settle(null);
        return;
      }

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        settle(null);
      }, YTDLP_TIMEOUT_MS);

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          settle(null);
          return;
        }
        try {
          const info = JSON.parse(stdout) as {
            url?: string;
            http_headers?: Record<string, string>;
            duration?: number;
          };
          const cdnUrl = info.url;
          if (!cdnUrl?.startsWith('http')) {
            settle(null);
            return;
          }
          const duration =
            typeof info.duration === 'number' && Number.isFinite(info.duration) && info.duration > 0
              ? info.duration
              : undefined;
          settle({ url: cdnUrl, headers: info.http_headers ?? {}, duration });
        } catch {
          settle(null);
        }
      });

      proc.on('error', () => {
        clearTimeout(timer);
        settle(null);
      });
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
