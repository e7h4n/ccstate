import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const [filter, ...publishArgs] = process.argv.slice(2);

if (!filter) {
  console.error('Usage: node scripts/pnpm-pack-and-npm-publish.mjs <pnpm-filter> [npm-publish-args...]');
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const packDir = mkdtempSync(join(tmpdir(), 'ccstate-pack-'));

try {
  run('pnpm', ['--filter', filter, 'pack', '--pack-destination', packDir]);

  const tarballs = readdirSync(packDir).filter((file) => file.endsWith('.tgz'));

  if (tarballs.length !== 1) {
    console.error(`Expected one tarball in ${packDir}, found ${tarballs.length}.`);
    process.exit(1);
  }

  run('npm', ['publish', join(packDir, tarballs[0]), ...publishArgs]);
} finally {
  rmSync(packDir, { recursive: true, force: true });
}
