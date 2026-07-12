import { resolve, sep } from 'node:path';
import { describe, it, expect } from 'vitest';
import { resolveWithinDir } from '../../components/client/clientRoutes';

const BASE = resolve('/fake', 'img');

describe('resolveWithinDir — legitimate filenames', () => {
  it('accepts logo.png', () => {
    const result = resolveWithinDir(BASE, 'logo.png');
    expect(result).not.toBeNull();
    expect(result!.startsWith(BASE + sep)).toBe(true);
  });

  it('accepts image.jpg', () => {
    expect(resolveWithinDir(BASE, 'image.jpg')).not.toBeNull();
  });

  it('accepts photo.jpeg', () => {
    expect(resolveWithinDir(BASE, 'photo.jpeg')).not.toBeNull();
  });

  it('accepts icon.svg', () => {
    expect(resolveWithinDir(BASE, 'icon.svg')).not.toBeNull();
  });

  it('accepts banner.webp', () => {
    expect(resolveWithinDir(BASE, 'banner.webp')).not.toBeNull();
  });

  it('accepts filenames with dots and dashes: my-file.v2.png', () => {
    expect(resolveWithinDir(BASE, 'my-file.v2.png')).not.toBeNull();
  });

  it('returns path strictly inside baseDir', () => {
    const result = resolveWithinDir(BASE, 'logo.png');
    expect(result).toBe(resolve(BASE, 'logo.png'));
  });
});

describe('resolveWithinDir — path traversal payloads', () => {
  it('blocks ../services/env.ts', () => {
    expect(resolveWithinDir(BASE, '../services/env.ts')).toBeNull();
  });

  it('blocks ..\\..\\passwd', () => {
    expect(resolveWithinDir(BASE, '..\\..\\passwd')).toBeNull();
  });

  it('blocks forward slash in filename', () => {
    expect(resolveWithinDir(BASE, 'sub/logo.png')).toBeNull();
  });

  it('blocks backslash in filename', () => {
    expect(resolveWithinDir(BASE, 'sub\\logo.png')).toBeNull();
  });

  it('blocks NUL byte in filename', () => {
    expect(resolveWithinDir(BASE, 'logo\0.png')).toBeNull();
  });

  it('blocks absolute path /etc/passwd', () => {
    expect(resolveWithinDir(BASE, '/etc/passwd')).toBeNull();
  });

  it('blocks encoded traversal %2e%2e%2f', () => {
    expect(resolveWithinDir(BASE, '%2e%2e%2fenv.ts')).toBeNull();
  });

  it('blocks empty filename', () => {
    expect(resolveWithinDir(BASE, '')).toBeNull();
  });
});

describe('resolveWithinDir — extension allow-list', () => {
  it('blocks .ts files', () => {
    expect(resolveWithinDir(BASE, 'env.ts')).toBeNull();
  });

  it('blocks .js files', () => {
    expect(resolveWithinDir(BASE, 'script.js')).toBeNull();
  });

  it('blocks .html files', () => {
    expect(resolveWithinDir(BASE, 'index.html')).toBeNull();
  });

  it('blocks .exe files', () => {
    expect(resolveWithinDir(BASE, 'virus.exe')).toBeNull();
  });

  it('blocks files with no extension', () => {
    expect(resolveWithinDir(BASE, 'Makefile')).toBeNull();
  });

  it('accepts .PNG (case-insensitive)', () => {
    expect(resolveWithinDir(BASE, 'logo.PNG')).not.toBeNull();
  });

  it('accepts .SVG (case-insensitive)', () => {
    expect(resolveWithinDir(BASE, 'icon.SVG')).not.toBeNull();
  });
});
