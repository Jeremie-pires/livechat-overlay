import { describe, it, expect, beforeEach, vi } from 'vitest';

type PresenceStore = typeof import('../../services/presenceStore').presenceStore;

describe('presenceStore — delta sync', () => {
  let ps: PresenceStore;

  // The store is a module-level singleton: re-import it so each test starts empty.
  beforeEach(async () => {
    vi.resetModules();
    ({ presenceStore: ps } = await import('../../services/presenceStore'));
  });

  it('get() returns entries with id field', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    const entries = ps.get('g1');
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('u1');
    expect(entries[0].displayName).toBe('Alice');
  });

  it('get() does not expose the internal discordUserId field', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    expect(ps.get('g1')[0]).not.toHaveProperty('discordUserId');
  });

  it('get() returns empty array for unknown guild', () => {
    expect(ps.get('unknown')).toEqual([]);
  });

  it('getAll() groups entries by guild', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.add('g2', 's2', 'u2', 'Bob', 'https://cdn.example/a.png');
    const all = ps.getAll();
    expect(Object.keys(all).sort()).toEqual(['g1', 'g2']);
    expect(all.g2[0]).toMatchObject({ id: 'u2', avatarUrl: 'https://cdn.example/a.png' });
  });

  it('getSocketEntries() returns guildId and discordUserId for connected socket', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    expect(ps.getSocketEntries('s1')).toEqual([{ guildId: 'g1', discordUserId: 'u1' }]);
  });

  it('getSocketEntries() returns empty array for unknown socket', () => {
    expect(ps.getSocketEntries('unknown')).toEqual([]);
  });

  it('getSocketEntries() returns all guilds for a multi-guild socket', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.add('g2', 's1', 'u1', 'Alice', null);
    const result = ps.getSocketEntries('s1');
    expect(result.map((e) => e.guildId).sort()).toEqual(['g1', 'g2']);
  });

  it('getSocketEntries() returns empty after removeSocket', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.removeSocket('s1');
    expect(ps.getSocketEntries('s1')).toEqual([]);
  });

  it('add() replaces old socket entry on reconnect — same user, new socket', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.add('g1', 's2', 'u1', 'Alice', null);
    expect(ps.get('g1')).toHaveLength(1);
    expect(ps.getSocketEntries('s1')).toEqual([]);
    expect(ps.getSocketEntries('s2')).toEqual([{ guildId: 'g1', discordUserId: 'u1' }]);
  });

  it('removeSocket() on a replaced socket keeps the user present', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.add('g1', 's2', 'u1', 'Alice', null);
    expect(ps.removeSocket('s1')).toEqual([]);
    expect(ps.get('g1')).toHaveLength(1);
  });

  it('removeSocket() returns affected guildIds', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    expect(ps.removeSocket('s1')).toEqual(['g1']);
  });

  it('removeSocket() cleans up empty guild from store', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.removeSocket('s1');
    expect(ps.get('g1')).toEqual([]);
    expect(ps.getAll()).toEqual({});
  });
});
