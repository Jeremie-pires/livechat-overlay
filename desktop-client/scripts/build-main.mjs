import { build } from 'esbuild';

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['electron'],
  format: 'cjs',
  sourcemap: false,
  minify: false,
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: ['src/main.ts'],
    outfile: 'dist/main.js',
  }),
  build({
    ...sharedOptions,
    entryPoints: ['src/preload.ts'],
    outfile: 'dist/preload.js',
  }),
  build({
    ...sharedOptions,
    entryPoints: ['src/overlay-preload.ts'],
    outfile: 'dist/overlay-preload.js',
  }),
]);

console.log('Main process bundle complete.');
