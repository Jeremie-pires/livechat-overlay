import { describe, it, expect } from 'vitest';
import {
  clampVolume,
  buildPlayerOptions,
  setInitialPlayerVolume,
  applyPlayerVolume,
  volumeFromUrlParams,
} from '../../components/client/playerVolume.js';

function fakeTarget() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  };
}

// Minimal model of Vidstack 1.12.13 (checked in a real browser):
// - VidstackPlayer.create copies the target's attributes into props, then assigns each
//   option through the element setter, which only queues a request;
// - right after can-play, the queue is served, then the provider receives props.volume (default 1).
function fakeVidstack(target: ReturnType<typeof fakeTarget>, options: Record<string, unknown>) {
  const video = { volume: 1 };
  const queued: Array<() => void> = [];
  const propsVolume = Number(target.attributes.get('volume') ?? 1);
  const player = {
    set volume(v: number) {
      queued.push(() => (video.volume = v));
    },
    querySelector: (sel: string) => (sel === 'video' ? video : null),
  };
  if ('volume' in options) player.volume = options.volume as number;
  const canPlay = () => {
    queued.forEach((fn) => fn());
    video.volume = propsVolume;
  };
  return { player, video, canPlay };
}

describe('setInitialPlayerVolume', () => {
  it('keeps the app volume after can-play instead of resetting it to 100%', () => {
    const target = fakeTarget();
    setInitialPlayerVolume(target, 0.1);
    const { player, video, canPlay } = fakeVidstack(target, buildPlayerOptions({ src: 'a.mp4', layout: {} }));

    applyPlayerVolume(player, 0.1);
    canPlay();

    expect(video.volume).toBe(0.1);
  });

  it('starts at 100% without it, even when the volume is set before can-play', () => {
    const target = fakeTarget();
    const { player, video, canPlay } = fakeVidstack(target, buildPlayerOptions({ src: 'a.mp4', layout: {} }));

    applyPlayerVolume(player, 0.1);
    canPlay();

    expect(video.volume).toBe(1);
  });

  it('clamps the volume attribute', () => {
    const target = fakeTarget();
    setInitialPlayerVolume(target, 3);
    expect(target.attributes.get('volume')).toBe('1');
  });

  it('ignores a missing target', () => {
    expect(() => setInitialPlayerVolume(null, 0.5)).not.toThrow();
  });
});

describe('buildPlayerOptions', () => {
  it('does not pass volume or muted, which create() cannot turn into props', () => {
    const options = buildPlayerOptions({ src: 'a.mp4', layout: {} });
    expect(options).not.toHaveProperty('volume');
    expect(options).not.toHaveProperty('muted');
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
