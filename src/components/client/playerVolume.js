// Volume helpers for the overlay player (shared by client.html and unit tests).

export function clampVolume(vol) {
  const n = Number(vol);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

// Vidstack re-applies `props.volume` (default 1) to the provider on can-play,
// overriding any `player.volume` set earlier — so the app volume must be a create prop.
export function buildPlayerOptions({ src, layout, volume, isDesktop }) {
  return {
    target: '#message-player',
    src,
    layout,
    crossOrigin: true,
    playsInline: true,
    load: 'eager',
    autoplay: true,
    muted: !isDesktop,
    volume: clampVolume(volume),
  };
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
