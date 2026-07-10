import fetch from 'node-fetch';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime-types';

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
  } catch (error) {}

  // If it doesn't work with URL, try with fetch
  try {
    if (!contentType) {
      const file = await fetch(url);

      contentType = file.headers.get('Content-Type');

      if (!contentType) {
        const res = await fileTypeFromBuffer(await file.arrayBuffer());

        if (res) {
          contentType = res.mime;
        }
      }
    }
  } catch (error) {}

  try {
    mediaDuration = await getVideoDurationInSeconds(url, 'ffprobe');
  } catch (error) {}

  return { contentType, mediaDuration, mediaIsShort: mediaIsShort ?? false };
};
