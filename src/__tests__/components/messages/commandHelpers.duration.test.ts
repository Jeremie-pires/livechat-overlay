import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMessageHandler } from '../../../components/messages/commandHelpers';

const { measureContentProcessing, getAudioInfoFromUrl, getYouTubeDuration } = vi.hoisted(() => ({
  measureContentProcessing: vi.fn(),
  getAudioInfoFromUrl: vi.fn(),
  getYouTubeDuration: vi.fn(),
}));

vi.mock('../../../services/telemetry', () => ({ measureContentProcessing }));
vi.mock('../../../services/content-utils', () => ({ getAudioInfoFromUrl, getYouTubeDuration }));
vi.mock('../../../services/gtts', () => ({}));
vi.mock('../../../services/prisma/loadPrisma', () => ({ QueueType: { MESSAGE: 'message', VOCAL: 'vocal' } }));

const config = {
  optionKeys: { url: 'url', text: 'text', media: 'media', audio: 'audio', duration: 'duration' },
  successKey: 'success',
} as never;

const makeInteraction = (options: Record<string, string>) => ({
  user: { username: 'testuser', avatarURL: vi.fn(() => null) },
  guildId: '123456789012345678',
  createdTimestamp: Date.now(),
  options: { get: vi.fn((key: string) => (key in options ? { value: options[key] } : null)) },
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue({}),
});

const queueCreate = vi.fn().mockResolvedValue({});

beforeEach(() => {
  vi.clearAllMocks();
  (global as Record<string, unknown>).rosetty = { t: vi.fn((key: string) => key) };
  (global as Record<string, unknown>).prisma = {
    guild: { findFirst: vi.fn().mockResolvedValue(null) },
    queue: { create: queueCreate },
  };
  measureContentProcessing.mockResolvedValue({
    processingMs: 10,
    contentInfo: { contentType: 'video/mp4', mediaDuration: 41.2 },
  });
});

describe('executeMessageHandler — custom duration', () => {
  it('"full" with a URL uses the duration resolved from the URL', async () => {
    const interaction = makeInteraction({ url: 'https://example.com/v', duration: 'full' });

    await executeMessageHandler(interaction as never, config);

    expect(queueCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ duration: 42 }) });
  });

  it('"full" with a URL is capped at 3600 seconds', async () => {
    measureContentProcessing.mockResolvedValue({
      processingMs: 10,
      contentInfo: { contentType: 'video/mp4', mediaDuration: 10800 },
    });
    const interaction = makeInteraction({ url: 'https://example.com/v', duration: 'full' });

    await executeMessageHandler(interaction as never, config);

    expect(queueCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ duration: 3600 }) });
  });

  it('rejects a malformed duration before extracting the content', async () => {
    const interaction = makeInteraction({ url: 'https://example.com/v', duration: 'abc' });

    await executeMessageHandler(interaction as never, config);

    expect(measureContentProcessing).not.toHaveBeenCalled();
    expect(queueCreate).not.toHaveBeenCalled();
    expect(rosetty.t).toHaveBeenCalledWith('invalidDuration');
  });

  it('"full" with a YouTube link fetches the duration through yt-dlp', async () => {
    measureContentProcessing.mockResolvedValue({
      processingMs: 10,
      contentInfo: { contentType: 'youtube', mediaDuration: undefined },
    });
    getYouTubeDuration.mockResolvedValue(212.4);
    const interaction = makeInteraction({ url: 'https://youtu.be/abc', duration: 'full' });

    await executeMessageHandler(interaction as never, config);

    expect(getYouTubeDuration).toHaveBeenCalledWith('https://youtu.be/abc');
    expect(queueCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ duration: 213 }) });
  });

  it('"full" with an audio track uses the audio duration', async () => {
    getAudioInfoFromUrl.mockResolvedValue({ audioUrl: 'https://proxy/a', audioDuration: 95.5 });
    const interaction = makeInteraction({ audio: 'https://youtu.be/abc', duration: 'full' });

    await executeMessageHandler(interaction as never, config);

    expect(getYouTubeDuration).not.toHaveBeenCalled();
    expect(queueCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ duration: 96 }) });
  });

  it('does not call yt-dlp for a YouTube link without "full"', async () => {
    measureContentProcessing.mockResolvedValue({
      processingMs: 10,
      contentInfo: { contentType: 'youtube', mediaDuration: undefined },
    });
    const interaction = makeInteraction({ url: 'https://youtu.be/abc', duration: '30' });

    await executeMessageHandler(interaction as never, config);

    expect(getYouTubeDuration).not.toHaveBeenCalled();
    expect(queueCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ duration: 30 }) });
  });
});
