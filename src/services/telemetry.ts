import { getContentInformationsFromUrl } from './content-utils';

export type ContentInfo = Awaited<ReturnType<typeof getContentInformationsFromUrl>>;

export interface ProcessingResult {
  processingMs: number;
  contentInfo: ContentInfo;
}

export const measureContentProcessing = async (url: string): Promise<ProcessingResult> => {
  const start = Date.now();
  const contentInfo = await getContentInformationsFromUrl(url);
  const processingMs = Math.max(0, Date.now() - start);
  return { processingMs, contentInfo };
};
