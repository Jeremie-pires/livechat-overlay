import fs from 'fs/promises';
import path from 'path';
import url from 'url';

const currentFile = url.fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const sourceDir = path.join(rootDir, 'src', 'renderer');
const targetDir = path.join(rootDir, 'dist', 'renderer');

async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

await fs.rm(targetDir, { recursive: true, force: true });
await copyDirectory(sourceDir, targetDir);
