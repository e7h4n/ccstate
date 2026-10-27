import { rollup, type OutputOptions, type RollupOptions } from 'rollup';
import { expect, test } from 'vitest';

const FACTORIES = ['state', 'computed', 'command'];

// Consumer bundlers such as Rollup and Rolldown only drop unused signal
// declarations when the published factories keep @__NO_SIDE_EFFECTS__.
test('published ESM and CJS bundles keep @__NO_SIDE_EFFECTS__ on signal factories', async () => {
  const configUrl = new URL('../../rollup.config.mjs', import.meta.url).href;
  const { default: configs } = (await import(configUrl)) as { default: RollupOptions[] };
  const targets = configs.filter((config) => {
    return !Array.isArray(config.output) && config.input !== './src/debug/index.ts';
  });
  expect(targets).toHaveLength(4);

  const missing: string[] = [];
  for (const { output, ...options } of targets) {
    const { file, ...outputOptions } = output as OutputOptions;
    const input = new URL(`../../${String(options.input)}`, import.meta.url).pathname;
    const bundle = await rollup({ ...options, input });
    const { output: chunks } = await bundle.generate(outputOptions);
    await bundle.close();

    for (const factory of FACTORIES) {
      if (!new RegExp(`/\\* @__NO_SIDE_EFFECTS__ \\*/\\s*function ${factory}\\(`).test(chunks[0].code)) {
        missing.push(`${String(file)} ${factory}`);
      }
    }
  }
  expect(missing).toEqual([]);
}, 30_000);
