import { randomUUID } from 'node:crypto';
import { copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCookiesForDomain } from './cookies-parser';
import { env } from './env';
import { runProcess } from './spawn-process';

async function makeTempCookies(cookiesFile: string): Promise<string> {
  const tempPath = join(tmpdir(), `ytdlp-cookies-${randomUUID()}.txt`);
  await copyFile(cookiesFile, tempPath);
  return tempPath;
}

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
// Keys are namespaced ("video:<url>" / "audio:<url>") to allow simultaneous video
// and audio extraction of the same source URL without sharing the same promise.
const inFlight = new Map<string, Promise<YtdlpResult | null>>();

function deduplicatedExtract(
  key: string,
  factory: () => Promise<YtdlpResult | null>,
): Promise<YtdlpResult | null> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = factory().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export async function extractVideoUrl(url: string, cookiesFile?: string): Promise<YtdlpResult | null> {
  return deduplicatedExtract(`video:${url}`, () => _runYtdlp(url, cookiesFile));
}

export async function extractAudioUrl(url: string, cookiesFile?: string): Promise<YtdlpResult | null> {
  return deduplicatedExtract(`audio:${url}`, () => _runYtdlpAudio(url, cookiesFile));
}

function parseYtdlpOutput(stdout: string): YtdlpResult | null {
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
}

async function runYtdlpProcess(url: string, format: string, cookiesFile?: string): Promise<YtdlpResult | null> {
  await acquireSemaphore();
  let tempCookies: string | undefined;
  try {
    if (cookiesFile) tempCookies = await makeTempCookies(cookiesFile);
    const args = [
      '--no-playlist',
      '--format',
      format,
      '--js-runtimes',
      'node',
      '-J',
      ...(tempCookies ? ['--cookies', tempCookies] : []),
      url,
    ];
    return await runProcess<YtdlpResult>(env.YTDLP_PATH, args, YTDLP_TIMEOUT_MS, parseYtdlpOutput);
  } finally {
    releaseSemaphore();
    if (tempCookies) rm(tempCookies, { force: true }).catch(() => undefined);
  }
}

async function _runYtdlpAudio(url: string, cookiesFile?: string): Promise<YtdlpResult | null> {
  return runYtdlpProcess(url, 'bestaudio[ext=m4a]/bestaudio', cookiesFile);
}

async function _runYtdlp(url: string, cookiesFile?: string): Promise<YtdlpResult | null> {
  const result = await runYtdlpProcess(url, 'best[ext=mp4][vcodec^=h264]/best[ext=mp4]/best', cookiesFile);

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
}
