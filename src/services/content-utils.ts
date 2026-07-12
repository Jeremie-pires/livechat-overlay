import fetch from 'node-fetch';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime-types';
import { assertPublicHttpUrl } from './url-guard';

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

export const getContentInformationsFromUrl = async (url: string) => {
  await assertPublicHttpUrl(url);

  let contentType: string | undefined;
  let mediaDuration: number | undefined;
  const mediaIsShort = isYouTubeShortUrl(url);
  // First try to get it with URL
  try {
    const fileExt = getFileTypeWithRegex(url);

    const tmpContentType = mime.lookup(fileExt);

    if (tmpContentType) {
      contentType = tmpContentType;
    }
  } catch (error) {
    logger.debug({ err: error }, 'content-type from URL extension failed');
  }

  // If it doesn't work with URL, try with fetch
  try {
    if (!contentType) {
      const file = await fetch(url, { redirect: 'error' });

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
    mediaDuration = await getVideoDurationInSeconds(url, 'ffprobe');
  } catch (error) {
    logger.debug({ err: error }, 'ffprobe duration detection failed');
  }

  return { contentType, mediaDuration, mediaIsShort: mediaIsShort ?? false };
};
