import fetch from 'node-fetch';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime-types';
import { assertPublicHttpUrl } from './url-guard';

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

async function resolveProviderMediaUrl(url: string): Promise<{ url: string; contentType?: string } | null> {
  if (!isSupportedGifProvider(url)) return null;

  let html: string;
  try {
    const response = await Promise.race([
      fetch(url, {
        redirect: 'error',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LiveChatCCB/1.0)',
          Accept: 'text/html',
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('provider HTML fetch timeout')), FETCH_TIMEOUT_MS),
      ),
    ]);
    html = (await response.text()).slice(0, MAX_HTML_CHARS);
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
  await assertPublicHttpUrl(url);

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
      const file = await fetch(effectiveUrl, { redirect: 'error' });

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
