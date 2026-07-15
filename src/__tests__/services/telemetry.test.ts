import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/content-utils', () => ({
  getContentInformationsFromUrl: vi.fn(),
}));

import { getContentInformationsFromUrl } from '../../services/content-utils';
import { measureContentProcessing } from '../../services/telemetry';

afterEach(() => {
  vi.restoreAllMocks();
});

const MOCK_CONTENT_INFO = {
  contentType: 'video/mp4' as string | undefined,
  mediaDuration: 30 as number | undefined,
  mediaIsShort: false,
  resolvedUrl: undefined as string | undefined,
};

describe('measureContentProcessing', () => {
  beforeEach(() => {
    vi.mocked(getContentInformationsFromUrl).mockResolvedValue(MOCK_CONTENT_INFO);
  });

  it('returns an object with processingMs and contentInfo', async () => {
    const result = await measureContentProcessing('https://example.com/video.mp4');
    expect(result).toHaveProperty('processingMs');
    expect(result).toHaveProperty('contentInfo');
  });

  it('processingMs is a non-negative finite number', async () => {
    const result = await measureContentProcessing('https://example.com/video.mp4');
    expect(result.processingMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.processingMs)).toBe(true);
  });

  it('contentInfo is passed through unchanged from getContentInformationsFromUrl', async () => {
    const mockInfo = {
      contentType: 'image/gif' as string | undefined,
      mediaDuration: undefined as number | undefined,
      mediaIsShort: false,
      resolvedUrl: 'https://cdn.example.com/img.gif' as string | undefined,
    };
    vi.mocked(getContentInformationsFromUrl).mockResolvedValue(mockInfo);
    const result = await measureContentProcessing('https://giphy.com/gifs/test');
    expect(result.contentInfo).toStrictEqual(mockInfo);
  });

  it('processingMs reflects elapsed time via Date.now', async () => {
    let callCount = 0;
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 1000 : 1075;
    });
    const result = await measureContentProcessing('https://example.com/test');
    expect(result.processingMs).toBe(75);
    dateSpy.mockRestore();
  });

  it('propagates rejection from getContentInformationsFromUrl without swallowing', async () => {
    const err = new Error('SSRF blocked: private IP');
    vi.mocked(getContentInformationsFromUrl).mockRejectedValue(err);
    await expect(measureContentProcessing('http://10.0.0.1/evil')).rejects.toThrow('SSRF blocked: private IP');
  });

  it('processingMs is clamped to >= 0 even when Date.now goes backwards', async () => {
    let callCount = 0;
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 1000 : 999;
    });
    const result = await measureContentProcessing('https://example.com/test');
    expect(result.processingMs).toBe(0);
    dateSpy.mockRestore();
  });
});
