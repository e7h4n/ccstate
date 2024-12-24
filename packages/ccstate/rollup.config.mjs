// @ts-check
import * as fs from 'node:fs';
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

/**
 * @param {{input:string, targetCJS:string, targetES:string}} param0
 * @returns {import('rollup').RollupOptions[]}
 */
function generateTarget({ input, targetCJS, targetES }) {
  return [
    {
      input,
      onwarn: (warning) => {
        throw new Error(warning?.message);
      },
      external,
      plugins: [
        nodeResolve({
          extensions: ['.ts'],
        }),
        babel({
          exclude: 'node_modules/**',
          extensions: ['.ts'],
          babelHelpers: 'bundled',
          configFile: path.resolve(projectRootDir, './babel.config.json'),
        }),
      ],
      output: [
        {
          file: targetCJS,
          format: 'cjs',
          sourcemap: true,
        },
        {
          file: targetES,
          format: 'es',
          sourcemap: true,
        },
      ],
    },
    {
      input,
      onwarn: (warning) => {
        throw new Error(warning?.message);
      },
      external,
      plugins: [
        dts({
          respectExternal: true,
          tsconfig: path.resolve(projectRootDir, './tsconfig.json'),
          // https://github.com/Swatinem/rollup-plugin-dts/issues/143
          compilerOptions: { preserveSymlinks: false },
        }),
      ],
      output: [
        {
          file: targetCJS.replace(/\.cjs$/, '.d.cts'),
          sourcemap: true,
        },
        {
          file: targetES.replace(/\.js$/, '.d.ts'),
          sourcemap: true,
        },
      ],
    },
  ];
}

/** @type { Array<import('rollup').RollupOptions> } */
export default [
  ...generateTarget({
    input: './src/index.ts',
    targetCJS: './dist/index.cjs',
    targetES: './dist/index.js',
  }),

  ...generateTarget({
    input: './src/core/index.ts',
    targetCJS: './dist/core/index.cjs',
    targetES: './dist/core/index.js',
  }),

  ...generateTarget({
    input: './src/debug/index.ts',
    targetCJS: './dist/debug/index.cjs',
    targetES: './dist/debug/index.js',
  }),
];
