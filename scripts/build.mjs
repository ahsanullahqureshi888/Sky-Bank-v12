import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const rootDist = resolve(root, 'dist');
const frontendDir = resolve(root, 'frontend');
const frontendDist = resolve(root, 'frontend', 'dist');

rmSync(rootDist, { recursive: true, force: true });
rmSync(frontendDist, { recursive: true, force: true });

// Ensure frontend dependencies are installed if missing
if (!existsSync(resolve(frontendDir, 'node_modules'))) {
  console.log('Installing frontend dependencies...');
  const install = spawnSync('npm', ['install'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: true,
  });
  if (install.status !== 0) {
    console.error('Failed to install frontend dependencies.');
    process.exit(install.status ?? 1);
  }
}

console.log('Building frontend application...');
const build = spawnSync('npm', ['run', 'build'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true,
});

if (build.status !== 0) {
  console.error('Frontend build failed.');
  process.exit(build.status ?? 1);
}

mkdirSync(rootDist, { recursive: true });

if (!existsSync(frontendDist)) {
  console.error('Frontend build did not create frontend/dist.');
  process.exit(1);
}

cpSync(frontendDist, rootDist, { recursive: true });
console.log('Vite build and assets copy completed successfully.');
