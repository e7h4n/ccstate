import { bench, describe } from 'vitest';
import { setupStoreWithoutSub } from './case';
import { type State } from 'ccstate';
import type { PrimitiveAtom } from 'jotai/vanilla';
import { ccstateStrategy } from './strategy/ccstate';
import { jotaiStrategy } from './strategy/jotai';
import { signalStrategy } from './strategy/signals';

const isCI = typeof window === 'undefined' ? !!process.env.CI : false;

for (let depth = 1; depth <= 4; depth++) {
  describe(`set without subscription, ${String(Math.pow(10, depth))} atom pyramid`, () => {
    const { store: storeWithoutSubCCState, atoms: atomsWithoutSubCCState } = setupStoreWithoutSub(
      depth,
      ccstateStrategy,
    );
    bench('ccstate', () => {
      const atoms = atomsWithoutSubCCState;
      const store = storeWithoutSubCCState;
      for (let i = 0; i < atoms[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * atoms[0].length);
        store.set(atoms[0][idx] as State<number>, (x) => x + 1);
      }
    });

    const { store: storeWithoutSubJotai, atoms: atomsWithoutSubJotai } = setupStoreWithoutSub(depth, jotaiStrategy);
    bench.skipIf(isCI)('jotai', () => {
      const atoms = atomsWithoutSubJotai;
      const store = storeWithoutSubJotai;
      for (let i = 0; i < atoms[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * atoms[0].length);
        store.set(atoms[0][idx] as PrimitiveAtom<number>, (x) => x + 1);
      }
    });

    const { atoms: signals } = setupStoreWithoutSub(depth, signalStrategy);
    bench.skipIf(isCI).skip('signals', () => {
      for (let i = 0; i < signals[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * signals[0].length);
        const signal = signals[0][idx];
        signal.value = signal.value + 1;
      }
    });
  });
}
