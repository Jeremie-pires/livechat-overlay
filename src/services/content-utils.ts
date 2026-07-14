import https from 'node:https';
import fetch from 'node-fetch';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime-types';
import { assertPublicHttpUrl, type AssertedUrl } from './url-guard';

const MAX_HTML_CHARS = 256 * 1024;
const FETCH_TIMEOUT_MS = 5_000;
const YOUTUBE_CONTENT_TYPE = 'video/youtube';

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
      void (body as { cancel: () => void }).cancel();
    }
  }
  return accumulated;
}

async function resolveProviderMediaUrl(url: string): Promise<{ url: string; contentType?: string } | null> {
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

  try {
    await assertPublicHttpUrl(rawUrl);
  } catch (error) {
    logger.debug({ err: error, rawUrl }, 'gif-provider: extracted URL failed SSRF guard');
    return null;
  }

  const ogContentType = og.videoType ?? og.imageType;
  const ext = getFileTypeWithRegex(rawUrl);
  const derivedContentType = ogContentType ?? (mime.lookup(ext) || undefined);

  return { url: rawUrl, contentType: derivedContentType };
}

export const getContentInformationsFromUrl = async (url: string) => {
  const urlGuard = await assertPublicHttpUrl(url);

  const mediaIsShort = isYouTubeShortUrl(url);

  if (isYouTubeUrl(url)) {
    return { contentType: YOUTUBE_CONTENT_TYPE, mediaDuration: undefined, mediaIsShort, resolvedUrl: undefined };
  }

  let contentType: string | undefined;
  let mediaDuration: number | undefined;

  const providerResult = await resolveProviderMediaUrl(url);
  const resolvedUrl = providerResult?.url;
  const effectiveUrl = resolvedUrl ?? url;
  if (providerResult?.contentType !== undefined) {
    contentType = providerResult.contentType;
  }

  try {
    const fileExt = getFileTypeWithRegex(effectiveUrl);
    const tmpContentType = mime.lookup(fileExt);
    if (tmpContentType) {
      contentType = tmpContentType;
    }
  } catch (error) {
    logger.debug({ err: error }, 'content-type from URL extension failed');
  }

  try {
    if (!contentType) {
      // Re-validate effectiveUrl to get a fresh IP for pinning (closes the TOCTOU window)
      const effectiveGuard = effectiveUrl === url ? urlGuard : await assertPublicHttpUrl(effectiveUrl);
      const [pinnedUrl, pinnedInit] = buildPinnedFetchArgs(effectiveGuard, {}, { redirect: 'error' });
      const file = await fetch(pinnedUrl, pinnedInit as Parameters<typeof fetch>[1]);

      contentType = file.headers.get('Content-Type') ?? undefined;

      if (!contentType) {
        const res = await fileTypeFromBuffer(await file.arrayBuffer());
        if (res) {
          contentType = res.mime;
        }
      }
    }
  } catch (error) {
    logger.debug({ err: error }, 'content-type from fetch/buffer failed');
  }

  try {
    mediaDuration = await getVideoDurationInSeconds(effectiveUrl, 'ffprobe');
  } catch (error) {
    logger.debug({ err: error }, 'ffprobe duration detection failed');
  }

  return { contentType, mediaDuration, mediaIsShort, resolvedUrl };
};
