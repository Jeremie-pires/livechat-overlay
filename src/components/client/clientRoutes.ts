import fs from 'fs';
import { resolve, sep } from 'path';

const IMG_DIR = resolve(__dirname, 'img');

const ALLOWED_IMG_EXT = /\.(svg|png|jpe?g|webp)$/i;
const SAFE_FILENAME = /^[\w.-]+$/;

const STATIC_ASSETS: Record<string, string> = {
  'vidstack.js': 'application/javascript',
  'playerVolume.js': 'application/javascript',
  'vidstack.theme.css': 'text/css',
  'vidstack.video.css': 'text/css',
};

export function resolveWithinDir(baseDir: string, filename: string): string | null {
  if (!SAFE_FILENAME.test(filename)) return null;
  if (!ALLOWED_IMG_EXT.test(filename)) return null;
  const target = resolve(baseDir, filename);
  if (!target.startsWith(baseDir + sep)) return null;
  return target;
}

export const ClientRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/', async function (req, reply) {
      const stream = fs.createReadStream(resolve(__dirname, 'client.html'));

      reply.type('text/html');
      return stream;
    });

    for (const [filename, contentType] of Object.entries(STATIC_ASSETS)) {
      fastify.get(`/${filename}`, async function (req, reply) {
        reply.type(contentType);
        return fs.createReadStream(resolve(__dirname, filename));
      });
    }

    fastify.get('/img/:filename', async function (req, reply) {
      const { filename } = req.params as { filename: string };
      const filePath = resolveWithinDir(IMG_DIR, filename);

      if (filePath === null) {
        reply.status(400).send('Bad Request');
        return;
      }

      if (!fs.existsSync(filePath)) {
        reply.status(404).send('Not Found');
        return;
      }

      const stream = fs.createReadStream(filePath);
      if (filename.endsWith('.svg')) {
        reply.type('image/svg+xml');
      } else if (filename.endsWith('.png')) {
        reply.type('image/png');
      } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        reply.type('image/jpeg');
      } else if (filename.endsWith('.webp')) {
        reply.type('image/webp');
      }
      return stream;
    });
  };
