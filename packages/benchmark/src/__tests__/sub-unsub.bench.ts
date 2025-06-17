import { bench, describe } from 'vitest';
import { setupStoreWithoutSub } from './case';
import { ccstateStrategy } from './strategy/ccstate';
import { jotaiStrategy } from './strategy/jotai';
import { alienSignalStrategy } from './strategy/alien-signals';
import { effect as aEffect } from 'alien-signals';
import { effect as pEffect } from '@preact/signals';
import { preactSignalStrategy } from './strategy/preact-signals';

const isCI = typeof window === 'undefined' ? !!process.env.CI : false;
const isBrowser = typeof window !== 'undefined';

const beginScale = isCI ? 3 : 1;
const maxScale = isCI ? 3 : 4;
for (let depth = beginScale; depth <= maxScale; depth++) {
  describe(`sub & unsub top atom, ${String(Math.pow(10, depth))} atoms pyramid`, () => {
    const { atoms: atomsCCState, store: storeCCState } = setupStoreWithoutSub(depth, ccstateStrategy);
    bench('ccstate', () => {
      const controller = new AbortController();
      storeCCState.watch((get) => get(atomsCCState[atomsCCState.length - 1][0]), {
        signal: controller.signal,
      });
      controller.abort();
    });

    const { atoms: atomsJotai, store: storeJotai } = setupStoreWithoutSub(depth, jotaiStrategy);
    bench.skipIf(isCI || isBrowser)('jotai', () => {
      const unsub = storeJotai.sub(atomsJotai[atomsJotai.length - 1][0], () => void 0);
      unsub();
    });

    const { atoms: pSignals } = setupStoreWithoutSub(depth, preactSignalStrategy);
    bench.skipIf(isCI || isBrowser).skip('preact-signals', () => {
      const unsub = pEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        pSignals[pSignals.length - 1][0].value;
      });
      unsub();
    });

    const { atoms: aSignals } = setupStoreWithoutSub(depth, alienSignalStrategy);
    bench.skipIf(isCI || isBrowser).skip('alien-signals', () => {
      const e = aEffect(() => {
        aSignals[aSignals.length - 1][0].get();
      });
      e.stop();
    });
  });
}
