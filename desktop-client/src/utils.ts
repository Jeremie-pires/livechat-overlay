export type AppSettings = {
  backendUrl: string;
  guildId: string;
  screenId: number;
  volume: number;
  autoConnect: boolean;
  clickThrough: boolean;
  overlaySize: number;
  overlayPosition: string;
  launchAtStartup: boolean;
  startMinimized: boolean;
  clientToken: string;
};

export type PresenceEntry = {
  id: string;
  displayName: string;
  connectedAt: number;
  avatarUrl: string | null;
};

export const DEFAULT_BACKEND_URL = 'http://localhost:3000';

export const DEFAULT_SETTINGS: AppSettings = {
  backendUrl: DEFAULT_BACKEND_URL,
  guildId: '',
  screenId: 0,
  volume: 100,
  autoConnect: true,
  clickThrough: true,
  overlaySize: 960,
  overlayPosition: 'center',
  launchAtStartup: false,
  startMinimized: false,
  clientToken: '',
};

export const OVERLAY_POSITION_ALLOWLIST: readonly string[] = [
  'center',
  'top-left', 'top-center', 'top-right',
  'center-left', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

export const MIN_OVERLAY_SIZE = 320;
export const MAX_OVERLAY_SIZE = 3840;

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function assertHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError(`URL protocol must be http: or https:, got ${url.protocol}`);
  }
  return url;
}

export function clampVolume(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function clampOverlaySize(v: number): number {
  return Math.max(MIN_OVERLAY_SIZE, Math.min(MAX_OVERLAY_SIZE, Math.round(v)));
}

export function isPresenceEntry(x: unknown): x is PresenceEntry {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    o.id.length > 0 &&
    typeof o.displayName === 'string' &&
    typeof o.connectedAt === 'number' &&
    (o.avatarUrl === null || typeof o.avatarUrl === 'string')
  );
}

export function isPresenceArray(x: unknown): x is PresenceEntry[] {
  return Array.isArray(x) && x.every(isPresenceEntry);
}

export function normalizeSettings(candidate: Partial<AppSettings> | undefined): AppSettings {
  const rawPosition = candidate?.overlayPosition?.trim() ?? '';
  const rawBackendUrl = candidate?.backendUrl?.trim() ?? '';
  let backendUrl: string;
  try {
    assertHttpUrl(rawBackendUrl);
    backendUrl = rawBackendUrl;
  } catch {
    backendUrl = DEFAULT_BACKEND_URL;
  }
  return {
    backendUrl: backendUrl || DEFAULT_BACKEND_URL,
    guildId: candidate?.guildId?.trim() || '',
    screenId: Number.isFinite(candidate?.screenId as number) ? Number(candidate?.screenId) : DEFAULT_SETTINGS.screenId,
    volume: clampVolume(Number(candidate?.volume ?? DEFAULT_SETTINGS.volume)),
    autoConnect: Boolean(candidate?.autoConnect ?? DEFAULT_SETTINGS.autoConnect),
    clickThrough: true,
    overlaySize: Number.isFinite(candidate?.overlaySize as number)
      ? clampOverlaySize(Number(candidate?.overlaySize))
      : DEFAULT_SETTINGS.overlaySize,
    overlayPosition: OVERLAY_POSITION_ALLOWLIST.includes(rawPosition) ? rawPosition : DEFAULT_SETTINGS.overlayPosition,
    launchAtStartup: Boolean(candidate?.launchAtStartup ?? DEFAULT_SETTINGS.launchAtStartup),
    startMinimized: Boolean(candidate?.startMinimized ?? DEFAULT_SETTINGS.startMinimized),
    clientToken: candidate?.clientToken?.trim() || '',
  };
}
