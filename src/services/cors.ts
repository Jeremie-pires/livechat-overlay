import type { FastifyCorsOptionsDelegateCallback } from '@fastify/cors';

// The desktop client's OBS browser source is served from this origin and needs to read /api/video (token-protected).
export const LOCAL_OVERLAY_ORIGIN = 'http://localhost:3001';
export const VIDEO_PROXY_PATH = '/api/video';

export const corsAllowedHeaders = [
  'Origin',
  'X-Requested-With',
  'Content-Type',
  'Accept',
  'Authorization',
  'forest-context-url',
  'Set-Cookie',
  'set-cookie',
  'Cookie',
];

export const createCorsOrigin =
  (allowedOrigin: string) => (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
    if (!origin || origin === allowedOrigin) {
      callback(null, true);
    } else {
      logger.warn({ origin, allowedOrigin }, '[CORS] Rejected origin');
      callback(null, false);
    }
  };

export const createCorsDelegator = (allowedOrigin: string): FastifyCorsOptionsDelegateCallback => {
  const corsOrigin = createCorsOrigin(allowedOrigin);

  return (req, callback) => {
    const isLocalOverlayVideo =
      req.headers.origin === LOCAL_OVERLAY_ORIGIN && req.url.split('?')[0] === VIDEO_PROXY_PATH;
    if (isLocalOverlayVideo) {
      callback(null, {
        methods: ['GET', 'OPTIONS'],
        origin: LOCAL_OVERLAY_ORIGIN,
        allowedHeaders: ['Range'],
        exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
      });
      return;
    }
    callback(null, {
      methods: ['GET', 'PUT', 'DELETE', 'POST', 'OPTIONS', 'PATCH'],
      allowedHeaders: corsAllowedHeaders,
      origin: corsOrigin,
      credentials: true,
    });
  };
};
