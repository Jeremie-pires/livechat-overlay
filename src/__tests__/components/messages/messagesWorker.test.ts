import { describe, it, expect, vi } from 'vitest';

type MediaType = 'image' | 'video' | 'audio' | 'link' | 'text';

const getMediaType = (type: string, content: { url?: string; mediaContentType?: string }): MediaType => {
  if (type === 'VOCAL' || content.mediaContentType?.startsWith('audio/')) return 'audio';
  if (content.mediaContentType?.startsWith('video/')) return 'video';
  if (content.mediaContentType?.startsWith('image/')) return 'image';
  if (content.url) return 'link';
  return 'text';
};

describe('getMediaType', () => {
  it('returns "audio" for VOCAL type', () => {
    expect(getMediaType('VOCAL', {})).toBe('audio');
  });

  it('returns "audio" for mediaContentType audio/*', () => {
    expect(getMediaType('OTHER', { mediaContentType: 'audio/mpeg' })).toBe('audio');
  });

  it('returns "video" for mediaContentType video/*', () => {
    expect(getMediaType('OTHER', { mediaContentType: 'video/mp4' })).toBe('video');
  });

  it('returns "image" for mediaContentType image/*', () => {
    expect(getMediaType('OTHER', { mediaContentType: 'image/png' })).toBe('image');
  });

  it('returns "link" for content with URL but no mediaContentType', () => {
    expect(getMediaType('OTHER', { url: 'https://example.com' })).toBe('link');
  });

  it('returns "text" by default', () => {
    expect(getMediaType('OTHER', {})).toBe('text');
  });

  it('VOCAL takes priority over mediaContentType video', () => {
    expect(getMediaType('VOCAL', { mediaContentType: 'video/mp4' })).toBe('audio');
  });

  it('audio takes priority over video via mediaContentType', () => {
    expect(getMediaType('TEXT', { mediaContentType: 'audio/mpeg', url: 'https://x.com' })).toBe('audio');
  });
});

describe('executeMessagesWorker — empty queue behavior', () => {
  it('returns undefined without error if queue is empty', async () => {
    const mockPrisma = {
      queue: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    // @ts-ignore
    global.prisma = mockPrisma;
    // @ts-ignore
    global.logger = { debug: vi.fn(), error: vi.fn() };

    const { executeMessagesWorker } = await import('../../../components/messages/messagesWorker');
    const mockFastify = { io: { to: vi.fn().mockReturnValue({ emit: vi.fn() }) } };
    // @ts-ignore
    const result = await executeMessagesWorker(mockFastify);

    expect(result).toBeUndefined();
    expect(mockPrisma.queue.findFirst).toHaveBeenCalledOnce();
  });
});
