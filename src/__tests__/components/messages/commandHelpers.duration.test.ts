import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMessageHandler } from '../../../components/messages/commandHelpers';

const { measureContentProcessing } = vi.hoisted(() => ({ measureContentProcessing: vi.fn() }));

vi.mock('../../../services/telemetry', () => ({ measureContentProcessing }));
vi.mock('../../../services/content-utils', () => ({ getAudioInfoFromUrl: vi.fn() }));
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
});
