import fs from 'fs';
import { resolve, sep } from 'path';

const IMG_DIR = resolve(__dirname, 'img');

const ALLOWED_IMG_EXT = /\.(svg|png|jpe?g|webp)$/i;
const SAFE_FILENAME = /^[\w.-]+$/;

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

    fastify.get('/vidstack.js', async function (req, reply) {
      const stream = fs.createReadStream(resolve(__dirname, 'vidstack.js'));

      reply.type('application/javascript');
      return stream;
    });

    fastify.get('/vidstack.theme.css', async function (req, reply) {
      const stream = fs.createReadStream(resolve(__dirname, 'vidstack.theme.css'));

      reply.type('text/css');
      return stream;
    });

    fastify.get('/vidstack.video.css', async function (req, reply) {
      const stream = fs.createReadStream(resolve(__dirname, 'vidstack.video.css'));

      reply.type('text/css');
      return stream;
    });

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
