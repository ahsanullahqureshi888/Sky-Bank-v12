import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const rootDist = resolve(root, 'dist');
const frontendDist = resolve(root, 'frontend', 'dist');

rmSync(rootDist, { recursive: true, force: true });
rmSync(frontendDist, { recursive: true, force: true });

const build = spawnSync('npm', ['run', 'build', '--prefix', 'frontend'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

mkdirSync(rootDist, { recursive: true });

if (!existsSync(frontendDist)) {
  console.error('Frontend build did not create frontend/dist.');
  process.exit(1);
}

cpSync(frontendDist, rootDist, { recursive: true });
console.log('Vite build and assets copy completed successfully.');
