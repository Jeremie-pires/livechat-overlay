import { describe, it, expect } from 'vitest';
import { computeFinalDuration } from '../../../components/messages/commandHelpers';

describe('computeFinalDuration', () => {
  it('custom duration wins over everything', () => {
    expect(computeFinalDuration(30, 5, 'video/mp4', { audioDuration: 120, audioUrl: 'a.mp3' })).toBe(30);
  });

  it('audioDuration beats mediaDuration when audioInfo is present', () => {
    expect(computeFinalDuration(undefined, 5, 'video/mp4', { audioDuration: 120, audioUrl: 'a.mp3' })).toBe(120);
  });

  it('falls back to mediaDuration when no audioInfo', () => {
    expect(computeFinalDuration(undefined, 5, 'video/mp4', null)).toBe(5);
  });

  it('uses audioDuration when mediaDuration is absent (e.g. YouTube + audio overlay)', () => {
    expect(computeFinalDuration(undefined, undefined, 'video/youtube', { audioDuration: 120, audioUrl: 'a.mp3' })).toBe(
      120,
    );
  });

  it('returns undefined when nothing is set', () => {
    expect(computeFinalDuration(undefined, undefined, 'video/mp4', null)).toBeUndefined();
  });

  it('applies ceiling to mediaDuration', () => {
    expect(computeFinalDuration(undefined, 4.2, 'video/mp4', null)).toBe(5);
  });

  it('applies ceiling to audioDuration', () => {
    expect(computeFinalDuration(undefined, 5, 'video/mp4', { audioDuration: 3.1, audioUrl: 'a.mp3' })).toBe(4);
  });

  it('ignores mediaDuration for non-video/audio content types', () => {
    expect(computeFinalDuration(undefined, 10, 'image/jpeg', null)).toBeUndefined();
  });
});
