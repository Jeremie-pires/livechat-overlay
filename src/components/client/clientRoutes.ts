import fs from 'fs';
import { join } from 'path';

export const ClientRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/', async function (req, reply) {
      const stream = fs.createReadStream(join(__dirname, 'client.html'));

      reply.type('text/html');
      return stream;
    });

    fastify.get('/vidstack.js', async function (req, reply) {
      const stream = fs.createReadStream(join(__dirname, 'vidstack.js'));

      reply.type('application/javascript');
      return stream;
    });

    fastify.get('/vidstack.theme.css', async function (req, reply) {
      const stream = fs.createReadStream(join(__dirname, 'vidstack.theme.css'));

      reply.type('text/css');
      return stream;
    });

    fastify.get('/vidstack.video.css', async function (req, reply) {
      const stream = fs.createReadStream(join(__dirname, 'vidstack.video.css'));

      reply.type('text/css');
      return stream;
    });

    fastify.get('/img/:filename', async function (req, reply) {
      const { filename } = req.params as { filename: string };
      const filePath = join(__dirname, 'img', filename);
      
      if (fs.existsSync(filePath)) {
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
      }
      
      reply.status(404).send('Not Found');
    });
  };
