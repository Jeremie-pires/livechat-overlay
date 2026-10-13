// Volume helpers for the overlay player (shared by client.html and unit tests).

export function clampVolume(vol) {
  const n = Number(vol);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

// Always start muted so autoplay cannot produce a volume burst before can-play fires.
// The can-play handler sets volume then unmutes; Electron and browser both allow muted autoplay.
export function buildPlayerOptions({ src, layout, volume }) {
  return {
    target: '#message-player',
    src,
    layout,
    crossOrigin: true,
    playsInline: true,
    load: 'eager',
    autoplay: true,
    muted: true,
    volume: clampVolume(volume),
  };
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
