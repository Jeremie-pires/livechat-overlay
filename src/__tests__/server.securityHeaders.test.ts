import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';

const buildAppWithHeaders = async (appEnv: string) => {
  const app = Fastify({ logger: false });

  const isDeployed = appEnv === 'production' || appEnv === 'staging';

  app.addHook('onSend', (_req, reply, _payload, done) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://cdn.discordapp.com data:; connect-src 'self'; frame-ancestors 'none'",
    );
    if (isDeployed) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    done();
  });

  app.get('/test', async () => ({ ok: true }));
  await app.ready();
  return app;
};

describe('Security headers (I-02)', () => {
  let app: Awaited<ReturnType<typeof buildAppWithHeaders>>;

  afterEach(() => app?.close());

  it.each([
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
  ])('sets %s header on all responses', async (header, expected) => {
    app = await buildAppWithHeaders('development');
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers[header]).toBe(expected);
  });

  it('sets Content-Security-Policy header', async () => {
    app = await buildAppWithHeaders('development');
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('does NOT set HSTS in development', async () => {
    app = await buildAppWithHeaders('development');
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('sets HSTS in production', async () => {
    app = await buildAppWithHeaders('production');
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
  });

  it('sets HSTS in staging', async () => {
    app = await buildAppWithHeaders('staging');
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
  });
});
