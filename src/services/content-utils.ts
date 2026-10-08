import https from 'node:https';
import fetch from 'node-fetch';
import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime-types';
import { runProcess } from './spawn-process';
import { assertPublicHttpUrl, type AssertedUrl } from './url-guard';
import { env } from './env';
import { findOrCreateProxy } from './video-proxy-cache';
import { extractVideoUrl } from './ytdlp';

const MAX_HTML_CHARS = 256 * 1024;
const FETCH_TIMEOUT_MS = 5_000;
const FFPROBE_TIMEOUT_MS = 5_000;
const COBALT_TIMEOUT_MS = 15_000;
const YOUTUBE_CONTENT_TYPE = 'video/youtube';
const TIKTOK_CONTENT_TYPE = 'video/tiktok';
const TWITTER_CONTENT_TYPE = 'video/twitter';

async function probeDuration(url: string): Promise<number | undefined> {
  const val = await runProcess(
    env.FFPROBE_PATH,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', url],
    FFPROBE_TIMEOUT_MS,
    (stdout) => {
      const s = Number.parseFloat(stdout.trim());
      return Number.isFinite(s) && s > 0 ? s : null;
    },
  );
  return val ?? undefined;
}

interface OpenGraphResult {
  videoUrl?: string;
  imageUrl?: string;
  videoType?: string;
  imageType?: string;
}

function getFileTypeWithRegex(url: string): string {
  const regex = /(?:\.([^.]+))?$/;
  const extension = regex.exec(url)?.[1];
  return extension ? extension.toLowerCase() : 'No extension found';
}

function isYouTubeShortUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.youtube.com' ||
        parsed.hostname === 'youtube.com' ||
        parsed.hostname === 'm.youtube.com') &&
      parsed.pathname.startsWith('/shorts/')
    );
  } catch {
    return false;
  }
}

function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const { hostname, pathname } = parsed;
    if (hostname === 'youtu.be') {
      return pathname.length > 1;
    }
    if (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'music.youtube.com'
    ) {
      return (
        pathname === '/watch' ||
        pathname.startsWith('/watch?') ||
        pathname.startsWith('/shorts/') ||
        pathname.startsWith('/embed/') ||
        pathname.startsWith('/live/')
      );
    }
    return false;
  } catch {
    return false;
  }
}

export function isTikTokUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'tiktok.com' ||
      hostname === 'www.tiktok.com' ||
      hostname === 'vm.tiktok.com' ||
      hostname === 'vt.tiktok.com'
    );
  } catch {
    return false;
  }
}

export function isTwitterUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    const isTwitterHost =
      hostname === 'twitter.com' ||
      hostname === 'www.twitter.com' ||
      hostname === 'x.com' ||
      hostname === 'www.x.com';
    return isTwitterHost && /\/status\/\d+/.test(pathname);
  } catch {
    return false;
  }
}

// Follows HTTP redirects (up to 3 hops) from a short URL to its canonical URL.
// Each redirect target is validated by assertPublicHttpUrl to prevent SSRF.
// Returns the resolved URL if at least one redirect was followed, otherwise null.
async function resolveHttpRedirect(startUrl: string, startGuard: AssertedUrl): Promise<string | null> {
  const MAX_HOPS = 3;
  let currentUrl = startUrl;
  let currentGuard = startGuard;
  let hops = 0;

  while (hops < MAX_HOPS) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let location: string | null = null;

    try {
      const [pinnedUrl, pinnedInit] = buildPinnedFetchArgs(
        currentGuard,
        { 'User-Agent': 'Mozilla/5.0 (compatible; LiveChatCCB/1.0)' },
        { redirect: 'manual' },
      );
      const response = await Promise.race([
        fetch(pinnedUrl, pinnedInit as Parameters<typeof fetch>[1]),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('redirect timeout')), FETCH_TIMEOUT_MS);
        }),
      ]);
      clearTimeout(timeoutId);
      location = response.headers.get('location');
    } catch {
      clearTimeout(timeoutId);
      break;
    }

    if (!location) break;

    try {
      const nextGuard = await assertPublicHttpUrl(location);
      currentUrl = location;
      currentGuard = nextGuard;
    } catch {
      break;
    }

    hops++;
  }

  return hops > 0 ? currentUrl : null;
}

// Sends url to a self-hosted Cobalt instance and returns the resolved stream URL.
// Returns null if Cobalt is unconfigured, unreachable, or returns an unexpected response.
async function resolveCobaltUrl(url: string, options: { audioOnly?: boolean } = {}): Promise<string | null> {
  const apiUrl = env.COBALT_API_URL;
  if (!apiUrl) return null;

  const body: Record<string, string> = { url };
  if (options.audioOnly) body.downloadMode = 'audio';

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('cobalt timeout')), COBALT_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.debug({ status: response.status }, 'cobalt: non-OK response');
      return null;
    }

    const data = (await response.json()) as { status?: string; url?: string };

    if (
      (data.status === 'tunnel' || data.status === 'stream' || data.status === 'redirect') &&
      typeof data.url === 'string'
    ) {
      const publicBase = env.COBALT_PUBLIC_URL;
      if (publicBase && (data.status === 'tunnel' || data.status === 'stream')) {
        // Rewrite internal tunnel origin to the browser-accessible URL
        try {
          const { pathname, search } = new URL(data.url);
          return new URL(pathname + search, publicBase).toString();
        } catch {
          // Malformed tunnel URL — cannot rewrite, fall through to iframe fallback
          return null;
        }
      }
      return data.url;
    }

    logger.debug({ cobaltStatus: data.status }, 'cobalt: unhandled status');
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    logger.debug({ err: error }, 'cobalt: request failed');
    return null;
  }
}

function isSupportedGifProvider(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'tenor.com' ||
      hostname.endsWith('.tenor.com') ||
      hostname === 'giphy.com' ||
      hostname.endsWith('.giphy.com')
    );
  } catch {
    return false;
  }
}

function parseOpenGraph(html: string): OpenGraphResult {
  const result: OpenGraphResult = {};
  const tagRe = /<meta\b([^>]*)>/gi;
  const attrRe = /\b(property|content)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRe.exec(html)) !== null) {
    const tagContent = tagMatch[1];
    const attrs: Record<string, string> = {};
    attrRe.lastIndex = 0;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRe.exec(tagContent)) !== null) {
      attrs[attrMatch[1].toLowerCase()] = (attrMatch[2] ?? attrMatch[3] ?? '').trim();
    }

    const prop = attrs['property'];
    const content = attrs['content'];
    if (prop === undefined || content === undefined) continue;

    const propLower = prop.toLowerCase();
    if ((propLower === 'og:video:url' || propLower === 'og:video') && result.videoUrl === undefined) {
      result.videoUrl = content;
    } else if (propLower === 'og:video:type' && result.videoType === undefined) {
      result.videoType = content;
    } else if (propLower === 'og:image' && result.imageUrl === undefined) {
      result.imageUrl = content;
    } else if (propLower === 'og:image:type' && result.imageType === undefined) {
      result.imageType = content;
    }
  }

  return result;
}

// Builds a fetch URL pinned to the validated IP and corresponding init options.
// Prevents DNS TOCTOU: the connection goes to the already-resolved IP while
// the Host header carries the original hostname for virtual hosting / TLS SNI.
function buildPinnedFetchArgs(
  guard: AssertedUrl,
  extraHeaders: Record<string, string>,
  extraInit: Record<string, unknown>,
): [string, Record<string, unknown>] {
  const { url: originalUrl, ip, family } = guard;

  const pinnedUrlObj = new URL(originalUrl.toString());
  if (family === 6) {
    pinnedUrlObj.host = originalUrl.port ? `[${ip}]:${originalUrl.port}` : `[${ip}]`;
  } else {
    pinnedUrlObj.host = originalUrl.port ? `${ip}:${originalUrl.port}` : ip;
  }

  // Strip brackets from IPv6 for SNI servername
  const sniHostname =
    originalUrl.hostname.startsWith('[') && originalUrl.hostname.endsWith(']')
      ? originalUrl.hostname.slice(1, -1)
      : originalUrl.hostname;

  const agent = originalUrl.protocol === 'https:' ? new https.Agent({ servername: sniHostname }) : undefined;

  const init: Record<string, unknown> = {
    ...extraInit,
    headers: {
      ...extraHeaders,
      Host: originalUrl.host,
    },
    ...(agent !== undefined ? { agent } : {}),
  };

  return [pinnedUrlObj.toString(), init];
}

// Reads the response body stream incrementally, stopping as soon as an OG
// media tag is matched or MAX_HTML_CHARS bytes have been consumed.
async function readHtmlStreamUntilOg(body: NodeJS.ReadableStream | null): Promise<string> {
  if (!body) return '';
  let accumulated = '';
  try {
    for await (const rawChunk of body as AsyncIterable<unknown>) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk.toString('utf-8') : String(rawChunk);
      accumulated += chunk;
      if (accumulated.length >= MAX_HTML_CHARS) {
        accumulated = accumulated.slice(0, MAX_HTML_CHARS);
        break;
      }
      const og = parseOpenGraph(accumulated);
      if (og.videoUrl !== undefined || og.imageUrl !== undefined) {
        break;
      }
    }
  } finally {
    // Drop the underlying socket as soon as we are done reading
    if (typeof (body as { destroy?: () => void }).destroy === 'function') {
      (body as { destroy: () => void }).destroy();
    } else if (typeof (body as { cancel?: () => void }).cancel === 'function') {
      (body as { cancel: () => void }).cancel();
    }
  }
  return accumulated;
}

async function resolveProviderMediaUrl(
  url: string,
): Promise<{ url: string; contentType?: string; guard: AssertedUrl } | null> {
  if (!isSupportedGifProvider(url)) return null;

  let guard: AssertedUrl;
  try {
    guard = await assertPublicHttpUrl(url);
  } catch (error) {
    logger.debug({ err: error }, 'gif-provider: SSRF guard failed for provider URL');
    return null;
  }

  const [pinnedUrl, pinnedInit] = buildPinnedFetchArgs(
    guard,
    { 'User-Agent': 'Mozilla/5.0 (compatible; LiveChatCCB/1.0)', Accept: 'text/html' },
    { redirect: 'error' },
  );

  let html: string;
  try {
    const response = await Promise.race([
      fetch(pinnedUrl, pinnedInit as Parameters<typeof fetch>[1]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('provider HTML fetch timeout')), FETCH_TIMEOUT_MS),
      ),
    ]);
    html = await readHtmlStreamUntilOg(response.body as NodeJS.ReadableStream | null);
  } catch (error) {
    logger.debug({ err: error }, 'gif-provider: HTML fetch failed');
    return null;
  }

  const og = parseOpenGraph(html);
  const rawUrl = og.videoUrl ?? og.imageUrl;

  if (rawUrl === undefined) {
    logger.debug({ url }, 'gif-provider: no OG media URL found in HTML');
    return null;
  }

  let ogGuard: AssertedUrl;
  try {
    ogGuard = await assertPublicHttpUrl(rawUrl);
  } catch (error) {
    logger.debug({ err: error, rawUrl }, 'gif-provider: extracted URL failed SSRF guard');
    return null;
  }

  const ogContentType = og.videoType ?? og.imageType;
  const ext = getFileTypeWithRegex(rawUrl);
  const derivedContentType = ogContentType ?? (mime.lookup(ext) || undefined);

  return { url: rawUrl, contentType: derivedContentType, guard: ogGuard };
}

function buildProxyUrl(sourceUrl: string, cdnUrl: string, headers?: Record<string, string>): string {
  const token = findOrCreateProxy(sourceUrl, cdnUrl, headers);
  return new URL(`/api/video?t=${token}`, env.API_URL).toString();
}

async function resolveShortLink(
  url: string,
  urlGuard: AssertedUrl,
  shortLinkPattern: RegExp,
  isValidUrl: (u: string) => boolean,
): Promise<string | undefined> {
  if (shortLinkPattern.test(new URL(url).pathname)) return undefined;
  const canonical = await resolveHttpRedirect(url, urlGuard);
  return canonical && isValidUrl(canonical) ? canonical : undefined;
}

async function handleTikTokUrl(url: string, urlGuard: AssertedUrl) {
  const extracted = await extractVideoUrl(url, env.YTDLP_COOKIES);
  if (extracted) {
    logger.info({ url, duration: extracted.duration }, 'tiktok: yt-dlp extraction succeeded');
    const proxyUrl = buildProxyUrl(url, extracted.url, extracted.headers);
    return { contentType: 'video/mp4', mediaDuration: extracted.duration, mediaIsShort: false, resolvedUrl: proxyUrl };
  }
  logger.warn({ url }, 'tiktok: yt-dlp extraction failed — falling back to iframe');
  const resolvedUrl = await resolveShortLink(url, urlGuard, /\/video\/\d+/, isTikTokUrl);
  return { contentType: TIKTOK_CONTENT_TYPE, mediaDuration: undefined, mediaIsShort: false as const, resolvedUrl };
}

async function handleTwitterUrl(url: string, urlGuard: AssertedUrl) {
  const streamUrl = await resolveCobaltUrl(url);
  if (streamUrl) {
    logger.info({ url }, 'twitter: cobalt resolution succeeded');
    const mediaDuration = await probeDuration(streamUrl);
    const proxyUrl = buildProxyUrl(url, streamUrl);
    return { contentType: 'video/mp4', mediaDuration, mediaIsShort: false, resolvedUrl: proxyUrl };
  }
  logger.warn({ url }, 'twitter: cobalt resolution failed — falling back to iframe');
  const resolvedUrl = await resolveShortLink(url, urlGuard, /\/status\/\d+/, isTwitterUrl);
  return { contentType: TWITTER_CONTENT_TYPE, mediaDuration: undefined, mediaIsShort: false as const, resolvedUrl };
}

async function resolveGenericContentInfo(
  effectiveUrl: string,
  effectiveGuard: AssertedUrl,
  initialContentType?: string,
): Promise<{ contentType?: string; mediaDuration?: number }> {
  let contentType = initialContentType;

  try {
    const tmpContentType = mime.lookup(getFileTypeWithRegex(effectiveUrl));
    if (tmpContentType) contentType = tmpContentType;
  } catch (error) {
    logger.debug({ err: error }, 'content-type from URL extension failed');
  }

  try {
    if (!contentType) {
      const [pinnedUrl, pinnedInit] = buildPinnedFetchArgs(effectiveGuard, {}, { redirect: 'error' });
      const file = await fetch(pinnedUrl, pinnedInit as Parameters<typeof fetch>[1]);
      contentType = file.headers.get('Content-Type') ?? undefined;
      if (!contentType) {
        const res = await fileTypeFromBuffer(await file.arrayBuffer());
        if (res) contentType = res.mime;
      }
    }
  } catch (error) {
    logger.debug({ err: error }, 'content-type from fetch/buffer failed');
  }

  let mediaDuration: number | undefined;
  try {
    const [pinnedFfprobeUrl] = buildPinnedFetchArgs(effectiveGuard, {}, {});
    mediaDuration = await probeDuration(pinnedFfprobeUrl);
  } catch (error) {
    logger.debug({ err: error }, 'ffprobe duration detection failed');
  }

  return { contentType, mediaDuration };
}

function sanitizeTikTokUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'www.tiktok.com' || parsed.hostname === 'tiktok.com') {
      const match = /(\/@[^/]+\/video\/\d+)/.exec(parsed.pathname);
      if (match) return `${parsed.protocol}//${parsed.hostname}${match[1]}`;
    }
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function sanitizeTwitterUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/video\/\d+$/, '');
    return parsed.toString();
  } catch {
    return url;
  }
}

export interface AudioInfo {
  audioUrl: string;
  audioDuration?: number;
}

// Validates a user-supplied audio URL and returns proxied CDN URL + duration.
// Accepts YouTube (extracted via Cobalt) or direct audio URLs (Content-Type: audio/*).
// Returns null for TikTok, Twitter, and any non-audio URL.
export async function getAudioInfoFromUrl(url: string): Promise<AudioInfo | null> {
  let guard;
  try {
    guard = await assertPublicHttpUrl(url);
  } catch (error) {
    logger.debug({ err: error }, 'audio: SSRF guard failed');
    return null;
  }

  if (isYouTubeUrl(url)) {
    const streamUrl = await resolveCobaltUrl(url, { audioOnly: true });
    if (!streamUrl) {
      logger.warn({ url }, 'audio: cobalt extraction failed');
      return null;
    }
    logger.info({ url }, 'audio: cobalt extraction succeeded');
    const proxyUrl = buildProxyUrl(url, streamUrl);
    // Cobalt tunnel URLs are single-use — probing them via ffprobe consumes the stream
    // before the client can play it. Duration falls back to DEFAULT_DURATION or temps param.
    return { audioUrl: proxyUrl, audioDuration: undefined };
  }

  if (isTikTokUrl(url) || isTwitterUrl(url)) {
    logger.debug({ url }, 'audio: rejected domain (tiktok/twitter not supported for audio)');
    return null;
  }

  // Direct audio URL: verify Content-Type via HEAD request
  try {
    const [pinnedUrl, pinnedInit] = buildPinnedFetchArgs(guard, {}, { method: 'HEAD', redirect: 'error' });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const response = await Promise.race([
      fetch(pinnedUrl, pinnedInit as Parameters<typeof fetch>[1]),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('audio HEAD timeout')), FETCH_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timeoutId);
    const contentType = response.headers.get('Content-Type') ?? '';
    if (!contentType.startsWith('audio/')) {
      logger.debug({ url, contentType }, 'audio: not an audio content-type');
      return null;
    }
    const [pinnedFfprobeUrl] = buildPinnedFetchArgs(guard, {}, {});
    const duration = await probeDuration(pinnedFfprobeUrl);
    return { audioUrl: url, audioDuration: duration };
  } catch (error) {
    logger.debug({ err: error }, 'audio: HEAD check failed');
    return null;
  }
}

export const getContentInformationsFromUrl = async (url: string) => {
  const cleanUrl = isTikTokUrl(url) ? sanitizeTikTokUrl(url) : isTwitterUrl(url) ? sanitizeTwitterUrl(url) : url;
  const urlGuard = await assertPublicHttpUrl(cleanUrl);
  const mediaIsShort = isYouTubeShortUrl(cleanUrl);

  if (isYouTubeUrl(cleanUrl)) {
    return { contentType: YOUTUBE_CONTENT_TYPE, mediaDuration: undefined, mediaIsShort, resolvedUrl: undefined };
  }
  if (isTikTokUrl(cleanUrl)) return handleTikTokUrl(cleanUrl, urlGuard);
  if (isTwitterUrl(cleanUrl)) return handleTwitterUrl(cleanUrl, urlGuard);

  const providerResult = await resolveProviderMediaUrl(cleanUrl);
  const resolvedUrl = providerResult?.url;
  const effectiveUrl = resolvedUrl ?? cleanUrl;
  const effectiveGuard = providerResult?.guard ?? urlGuard;

  const { contentType, mediaDuration } = await resolveGenericContentInfo(
    effectiveUrl,
    effectiveGuard,
    providerResult?.contentType,
  );
  return { contentType, mediaDuration, mediaIsShort, resolvedUrl };
};
