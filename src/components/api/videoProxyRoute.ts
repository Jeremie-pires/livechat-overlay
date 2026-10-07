import fetch from 'node-fetch';
import { resolveVideoProxy } from '../../services/video-proxy-cache';

function videoProxyPlugin(fastify: FastifyCustomInstance): void {
  fastify.get<{ Querystring: { t?: string } }>('/video', async (req, reply) => {
    const token = req.query.t;
    if (!token) return reply.status(400).send({ error: 'missing token' });

    const entry = resolveVideoProxy(token);
    if (!entry) return reply.status(404).send({ error: 'expired or unknown token' });

    const rangeHeader = req.headers['range'];

    let upstreamRes: Awaited<ReturnType<typeof fetch>>;
    try {
      upstreamRes = await fetch(entry.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LiveChatCCB/1.0)',
          ...entry.headers,
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
      });
    } catch (err) {
      logger.warn({ err, url: entry.url }, 'video-proxy: CDN fetch failed');
      return reply.status(502).send({ error: 'upstream fetch failed' });
    }

    if (upstreamRes.status >= 400) {
      logger.warn({ status: upstreamRes.status, url: entry.url }, 'video-proxy: CDN returned error status');
      return reply.status(502).send({ error: `upstream error: ${upstreamRes.status}` });
    }

    const ct = upstreamRes.headers.get('content-type') ?? 'video/mp4';
    const cl = upstreamRes.headers.get('content-length');
    const cr = upstreamRes.headers.get('content-range');

    reply.status(upstreamRes.status === 206 ? 206 : 200);
    reply.header('Content-Type', ct);
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Cache-Control', 'no-store');
    if (cl) reply.header('Content-Length', cl);
    if (cr) reply.header('Content-Range', cr);

    return reply.send(upstreamRes.body);
  });
}

export const VideoProxyRoute = () => videoProxyPlugin;
