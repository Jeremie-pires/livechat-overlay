// Volume helpers for the overlay player (shared by client.html and unit tests).

export function clampVolume(vol) {
  const n = Number(vol);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

// No `volume`/`muted` here: VidstackPlayer.create assigns options through the element setters,
// which only queue a request and leave the props at their defaults (volume 1, unmuted).
// Right after can-play, Vidstack 1.12.13 pushes props.volume to the provider, so those
// requests are overwritten and the media starts at 100%. Use setInitialPlayerVolume instead.
export function buildPlayerOptions({ src, layout }) {
  return {
    target: '#message-player',
    src,
    layout,
    crossOrigin: true,
    playsInline: true,
    load: 'eager',
    autoplay: true,
  };
}

// VidstackPlayer.create copies the target's attributes onto <media-player>, and the player
// reads them into its props at setup — the only way to set props.volume from outside.
export function setInitialPlayerVolume(target, volume) {
  target?.setAttribute('volume', String(clampVolume(volume)));
}

// Reads ?volume=XX (0–100 integer) from a URL search string and returns a 0–1 float.
// Falls back to 1 when the param is absent or invalid.
export function volumeFromUrlParams(search) {
  const raw = new URLSearchParams(search).get('volume');
  if (raw === null) return 1;
  return clampVolume(Number(raw) / 100);
}

export function applyPlayerVolume(player, volume) {
  if (!player) return;
  try {
    player.volume = volume;
  } catch {
    // provider not ready yet — Vidstack applies props.volume on can-play
  }
  const video = player.querySelector?.('video');
  if (video) video.volume = volume;
}
