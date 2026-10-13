import { describe, it, expect } from 'vitest';
import { clampVolume, buildPlayerOptions, applyPlayerVolume, volumeFromUrlParams } from '../../components/client/playerVolume.js';

// Minimal model of Vidstack 1.12.13: `player.volume` set before can-play is queued,
// then on can-play the provider receives `storage?.getVolume() ?? props.volume` (default 1).
function fakeVidstack(options: { volume?: number }) {
  const video = { volume: 1 };
  const queued: Array<() => void> = [];
  const player = {
    set volume(v: number) {
      queued.push(() => (video.volume = v));
    },
    querySelector: (sel: string) => (sel === 'video' ? video : null),
  };
  const canPlay = () => {
    queued.forEach((fn) => fn());
    video.volume = options.volume ?? 1;
  };
  return { player, video, canPlay };
}

describe('buildPlayerOptions', () => {
  it('passes the app volume as a create prop so can-play does not reset it to 100%', () => {
    const options = buildPlayerOptions({ src: 'a.mp4', layout: {}, volume: 0.2, isDesktop: true });
    const { player, video, canPlay } = fakeVidstack(options);

    applyPlayerVolume(player, 0.2);
    canPlay();

    expect(video.volume).toBe(0.2);
  });

  it('always starts muted to prevent volume burst before can-play', () => {
    expect(buildPlayerOptions({ src: 'a.mp4', layout: {}, volume: 1 }).muted).toBe(true);
  });

  it('clamps the volume prop', () => {
    expect(buildPlayerOptions({ src: 'a.mp4', layout: {}, volume: 3, isDesktop: true }).volume).toBe(1);
  });
});

describe('applyPlayerVolume', () => {
  it('sets both the player and the inner <video> volume', () => {
    const video = { volume: 1 };
    const player = { volume: 1, querySelector: () => video };

    applyPlayerVolume(player, 0.4);

    expect(player.volume).toBe(0.4);
    expect(video.volume).toBe(0.4);
  });

  it('ignores a missing player', () => {
    expect(() => applyPlayerVolume(null, 0.5)).not.toThrow();
  });

  it('survives a player whose volume setter throws before the provider is ready', () => {
    const player = {
      set volume(_v: number) {
        throw new Error('not ready');
      },
      querySelector: () => null,
    };
    expect(() => applyPlayerVolume(player, 0.5)).not.toThrow();
  });
});

describe('volumeFromUrlParams', () => {
  it.each([
    ['?volume=20', 0.2],
    ['?volume=0', 0],
    ['?volume=100', 1],
    ['?volume=150', 1],
    ['', 1],
    ['?volume=abc', 1],
    ['?volume=-10', 0],
  ])('volumeFromUrlParams(%s) → %s', (input, expected) => {
    expect(volumeFromUrlParams(input)).toBe(expected);
  });
});

describe('clampVolume', () => {
  it.each([
    [-1, 0],
    [0.5, 0.5],
    [2, 1],
    [Number.NaN, 1],
    ['0.3', 0.3],
  ])('clampVolume(%s) → %s', (input, expected) => {
    expect(clampVolume(input)).toBe(expected);
  });
});
