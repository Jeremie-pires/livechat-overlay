import fetch from 'node-fetch';
import { resolveVideoProxy } from '../../services/video-proxy-cache';

function videoProxyPlugin(fastify: FastifyCustomInstance): void {
  fastify.get<{ Querystring: { t?: string } }>('/video', async (req, reply) => {
    const token = req.query.t;
    if (!token) return reply.status(400).send({ error: 'missing token' });

    const entry = resolveVideoProxy(token);
    if (!entry) return reply.status(404).send({ error: 'expired or unknown token' });

    const rangeHeader = req.headers['range'];
    const upstreamRes = await fetch(entry.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LiveChatCCB/1.0)',
        ...entry.headers,
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });

    const ct = upstreamRes.headers.get('content-type') ?? 'video/mp4';
    const cl = upstreamRes.headers.get('content-length');
    const cr = upstreamRes.headers.get('content-range');

    reply.status(upstreamRes.status === 206 ? 206 : 200);
    reply.header('Content-Type', ct);
    reply.header('Accept-Ranges', 'bytes');
    if (cl) reply.header('Content-Length', cl);
    if (cr) reply.header('Content-Range', cr);

    return reply.send(upstreamRes.body);
  });
}

export const VideoProxyRoute = () => videoProxyPlugin;
