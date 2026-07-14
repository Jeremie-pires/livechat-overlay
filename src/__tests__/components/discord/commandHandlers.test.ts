import { describe, it, expect, vi, beforeEach } from 'vitest';

const makeRosetty = () => ({
  t: vi.fn((key: string) => key),
  getCurrentLang: vi.fn(() => 'fr'),
});

const makeInteraction = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-123', username: 'testuser', avatarURL: vi.fn(() => null) },
  guildId: '123456789012345678',
  createdTimestamp: Date.now(),
  options: {
    get: vi.fn().mockReturnValue({ value: 30, id: 'ch-123' }),
    getChannel: vi.fn().mockReturnValue({ id: 'ch-123' }),
  },
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue({}),
  reply: vi.fn().mockResolvedValue({}),
  ...overrides,
});

const makeGuildMember = (isAdmin: boolean) => ({
  permissions: { has: vi.fn().mockReturnValue(isAdmin) },
});

const makeDiscordClient = (member: ReturnType<typeof makeGuildMember>) => ({
  guilds: {
    fetch: vi.fn().mockResolvedValue({
      members: { fetch: vi.fn().mockResolvedValue(member) },
    }),
  },
});

beforeEach(() => {
  (global as Record<string, unknown>).rosetty = makeRosetty();
  (global as Record<string, unknown>).prisma = {
    guild: { upsert: vi.fn().mockResolvedValue({}) },
    queue: { create: vi.fn().mockResolvedValue({}) },
  };
  (global as Record<string, unknown>).logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
});

// ── setupCommand ──────────────────────────────────────────────────────────────

describe('setupCommand handler', () => {
  it('defers reply before any async work', async () => {
    const { setupCommand } = await import('../../../components/discord/setupCommand');
    const interaction = makeInteraction();
    const member = makeGuildMember(true);
    const client = makeDiscordClient(member);

    await setupCommand().handler(interaction as never, client as never);

    expect(interaction.deferReply).toHaveBeenCalledOnce();
    expect(interaction.deferReply).toHaveBeenCalledBefore(client.guilds.fetch as never);
  });

  it('editReply with error embed when user is not admin', async () => {
    const { setupCommand } = await import('../../../components/discord/setupCommand');
    const interaction = makeInteraction();
    const member = makeGuildMember(false);
    const client = makeDiscordClient(member);

    await setupCommand().handler(interaction as never, client as never);

    expect(interaction.editReply).toHaveBeenCalledOnce();
    expect(interaction.reply).not.toHaveBeenCalled();
    const embed = (interaction.editReply.mock.calls[0][0] as { embeds: Array<{ data: { color: number } }> }).embeds[0];
    expect(embed.data.color).toBe(0xe74c3c);
  });

  it('upserts guild and editReply with success embed when admin', async () => {
    const { setupCommand } = await import('../../../components/discord/setupCommand');
    const interaction = makeInteraction();
    const member = makeGuildMember(true);
    const client = makeDiscordClient(member);
    const mockUpsert = vi.fn().mockResolvedValue({});
    (global as Record<string, unknown>).prisma = { guild: { upsert: mockUpsert } };

    await setupCommand().handler(interaction as never, client as never);

    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledOnce();
    const embed = (interaction.editReply.mock.calls[0][0] as { embeds: Array<{ data: { color: number } }> }).embeds[0];
    expect(embed.data.color).toBe(0x2ecc71);
  });
});

// ── setDefaultTimeCommand ─────────────────────────────────────────────────────

describe('setDefaultTimeCommand handler', () => {
  it('defers reply before any async work', async () => {
    const { setDefaultTimeCommand } = await import('../../../components/discord/setDefaultTimeCommand');
    const interaction = makeInteraction({ options: { get: vi.fn().mockReturnValue({ value: 30 }) } });
    const member = makeGuildMember(true);
    const client = makeDiscordClient(member);

    await setDefaultTimeCommand().handler(interaction as never, client as never);

    expect(interaction.deferReply).toHaveBeenCalledOnce();
  });

  it('editReply with error when number is out of range (BLOCK-2 validation)', async () => {
    const { setDefaultTimeCommand } = await import('../../../components/discord/setDefaultTimeCommand');
    const interaction = makeInteraction({ options: { get: vi.fn().mockReturnValue({ value: 0 }) } });
    const member = makeGuildMember(true);
    const client = makeDiscordClient(member);

    await setDefaultTimeCommand().handler(interaction as never, client as never);

    expect(interaction.editReply).toHaveBeenCalledOnce();
    const embed = (interaction.editReply.mock.calls[0][0] as { embeds: Array<{ data: { color: number } }> }).embeds[0];
    expect(embed.data.color).toBe(0xe74c3c);
  });

  it('editReply with error when user is not admin', async () => {
    const { setDefaultTimeCommand } = await import('../../../components/discord/setDefaultTimeCommand');
    const interaction = makeInteraction({ options: { get: vi.fn().mockReturnValue({ value: 30 }) } });
    const member = makeGuildMember(false);
    const client = makeDiscordClient(member);

    await setDefaultTimeCommand().handler(interaction as never, client as never);

    expect(interaction.editReply).toHaveBeenCalledOnce();
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('upserts guild and editReply with success embed when admin and valid number', async () => {
    const { setDefaultTimeCommand } = await import('../../../components/discord/setDefaultTimeCommand');
    const interaction = makeInteraction({ options: { get: vi.fn().mockReturnValue({ value: 15 }) } });
    const member = makeGuildMember(true);
    const client = makeDiscordClient(member);
    const mockUpsert = vi.fn().mockResolvedValue({});
    (global as Record<string, unknown>).prisma = { guild: { upsert: mockUpsert } };

    await setDefaultTimeCommand().handler(interaction as never, client as never);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ defaultMediaTime: 15 }) }),
    );
    const embed = (interaction.editReply.mock.calls[0][0] as { embeds: Array<{ data: { color: number } }> }).embeds[0];
    expect(embed.data.color).toBe(0x2ecc71);
  });
});

// ── setMaxTimeCommand ─────────────────────────────────────────────────────────

describe('setMaxTimeCommand handler', () => {
  it('defers reply before any async work', async () => {
    const { setMaxTimeCommand } = await import('../../../components/discord/setMaxTimeCommand');
    const interaction = makeInteraction({ options: { get: vi.fn().mockReturnValue({ value: 120 }) } });
    const member = makeGuildMember(true);
    const client = makeDiscordClient(member);

    await setMaxTimeCommand().handler(interaction as never, client as never);

    expect(interaction.deferReply).toHaveBeenCalledOnce();
  });

  it('editReply with error when number exceeds 3600', async () => {
    const { setMaxTimeCommand } = await import('../../../components/discord/setMaxTimeCommand');
    const interaction = makeInteraction({ options: { get: vi.fn().mockReturnValue({ value: 9999 }) } });
    const member = makeGuildMember(true);
    const client = makeDiscordClient(member);

    await setMaxTimeCommand().handler(interaction as never, client as never);

    const embed = (interaction.editReply.mock.calls[0][0] as { embeds: Array<{ data: { color: number } }> }).embeds[0];
    expect(embed.data.color).toBe(0xe74c3c);
  });

  it('upserts guild with maxMediaTime when admin and valid number', async () => {
    const { setMaxTimeCommand } = await import('../../../components/discord/setMaxTimeCommand');
    const interaction = makeInteraction({ options: { get: vi.fn().mockReturnValue({ value: 300 }) } });
    const member = makeGuildMember(true);
    const client = makeDiscordClient(member);
    const mockUpsert = vi.fn().mockResolvedValue({});
    (global as Record<string, unknown>).prisma = { guild: { upsert: mockUpsert } };

    await setMaxTimeCommand().handler(interaction as never, client as never);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ maxMediaTime: 300 }) }),
    );
  });
});

// ── I-04 regression: prisma.queue.create error boundary ──────────────────────

describe('sendCommand — I-04 prisma.queue.create error boundary', () => {
  it('editReply with error embed when prisma.queue.create throws', async () => {
    vi.resetModules();
    vi.doMock('../../../services/telemetry', () => ({
      measureContentProcessing: vi.fn().mockResolvedValue({ processingMs: 0, contentInfo: {} }),
    }));
    vi.doMock('../../../services/utils', () => ({
      getDurationFromGuildId: vi.fn().mockResolvedValue(5),
      parseDuration: vi.fn().mockReturnValue(undefined),
    }));

    const { sendCommand } = await import('../../../components/messages/sendCommand');

    (global as Record<string, unknown>).prisma = {
      queue: { create: vi.fn().mockRejectedValue(new Error('SQLite busy')) },
    };
    (global as Record<string, unknown>).logger = { error: vi.fn(), warn: vi.fn() };

    const interaction = makeInteraction({
      options: {
        get: vi.fn((key: string) => {
          if (key === 'rosetty.t(sendCommandOptionURL)') return { value: 'https://example.com' };
          if (key === 'sendCommandOptionURL') return { value: 'https://example.com' };
          return null;
        }),
        getChannel: vi.fn().mockReturnValue(null),
      },
    });

    const cmd = sendCommand();
    const optionsGet = vi.fn((key: string) => {
      if (key === (global as Record<string, unknown>).rosetty?.t?.('sendCommandOptionURL')) return { value: 'https://example.com', attachment: null };
      return null;
    });
    (interaction as Record<string, unknown>).options = {
      get: optionsGet,
      getChannel: vi.fn(),
    };

    await cmd.handler(interaction as never);

    const loggerError = ((global as Record<string, unknown>).logger as { error: ReturnType<typeof vi.fn> }).error;
    expect(loggerError).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    const lastCall = interaction.editReply.mock.calls.at(-1)?.[0] as { embeds: Array<{ data: { color: number } }> };
    expect(lastCall?.embeds?.[0]?.data?.color).toBe(0xe74c3c);

    vi.doUnmock('../../../services/telemetry');
    vi.doUnmock('../../../services/utils');
  });
});
