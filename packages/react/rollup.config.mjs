// @ts-check
import * as path from 'node:path';
import { babel } from '@rollup/plugin-babel';
import { dts } from 'rollup-plugin-dts';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const projectRootDir = path.resolve(__dirname);

/**
 * @param {string} id
 * @returns {boolean}
 */
function external(id) {
  return !id.startsWith('.') && !id.startsWith(projectRootDir);
}

const babelPlugin = babel({
  exclude: 'node_modules/**',
  extensions: ['.ts'],
  babelHelpers: 'bundled',
  configFile: path.resolve(projectRootDir, './babel.config.json'),
});

/** @type { Array<import('rollup').RollupOptions> } */
export default [
  // ESM with code splitting so provider.ts is shared between index and experimental
  {
    input: {
      index: './src/index.ts',
      experimental: './src/experimental.ts',
    },
    onwarn: (warning) => {
      throw new Error(warning?.message);
    },
    external,
    plugins: [nodeResolve({ extensions: ['.ts'] }), babelPlugin],
    output: {
      dir: './dist',
      format: 'es',
      entryFileNames: '[name].js',
      chunkFileNames: '[name].js',
    },
  },
  // CJS with code splitting
  {
    input: {
      index: './src/index.ts',
      experimental: './src/experimental.ts',
    },
    onwarn: (warning) => {
      throw new Error(warning?.message);
    },
    external,
    plugins: [nodeResolve({ extensions: ['.ts'] }), babelPlugin],
    output: {
      dir: './dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      chunkFileNames: '[name].cjs',
    },
  },
  // Type declarations
  {
    input: './src/index.ts',
    onwarn: (warning) => {
      throw new Error(warning?.message);
    },
    external,
    plugins: [
      dts({
        respectExternal: true,
        tsconfig: path.resolve(projectRootDir, './tsconfig.json'),
        compilerOptions: { preserveSymlinks: false },
      }),
    ],
    output: [{ file: './dist/index.d.cts' }, { file: './dist/index.d.ts' }],
  },
  {
    input: './src/experimental.ts',
    onwarn: (warning) => {
      throw new Error(warning?.message);
    },
    external,
    plugins: [
      dts({
        respectExternal: true,
        tsconfig: path.resolve(projectRootDir, './tsconfig.json'),
        compilerOptions: { preserveSymlinks: false },
      }),
    ],
    output: [{ file: './dist/experimental.d.cts' }, { file: './dist/experimental.d.ts' }],
  },
];
