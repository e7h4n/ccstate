import { bench, describe } from 'vitest';
import { setupStoreWithoutSub } from './case';
import { command } from 'ccstate';
import { ccstateStrategy } from './strategy/ccstate';
import { jotaiStrategy } from './strategy/jotai';

const isCI = typeof window === 'undefined' ? !!process.env.CI : false;
const beginScale = isCI ? 3 : 1;
const maxScale = isCI ? 3 : 4;
for (let depth = beginScale; depth <= maxScale; depth++) {
  describe(`sub & unsub top atom, ${String(Math.pow(10, depth))} atoms pyramid`, () => {
    const { atoms: atomsCCState, store: storeCCState } = setupStoreWithoutSub(depth, ccstateStrategy);
    bench('ccstate', () => {
      const unsub = storeCCState.sub(
        atomsCCState[atomsCCState.length - 1][0],
        command(() => void 0),
      );
      unsub();
    });

    const { atoms: atomsJotai, store: storeJotai } = setupStoreWithoutSub(depth, jotaiStrategy);
    bench.skipIf(isCI)('jotai', () => {
      const unsub = storeJotai.sub(atomsJotai[atomsJotai.length - 1][0], () => void 0);
      unsub();
    });
  });
}
