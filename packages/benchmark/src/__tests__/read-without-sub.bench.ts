import { bench, describe } from 'vitest';
import { setupStoreWithoutSub } from './case';
import { type State } from 'ccstate';
import type { PrimitiveAtom } from 'jotai/vanilla';
import { ccstateStrategy } from './strategy/ccstate';
import { jotaiStrategy } from './strategy/jotai';
import { preactSignalStrategy } from './strategy/preact-signals';
import { alienSignalStrategy } from './strategy/alien-signals';
import type { Signal } from 'alien-signals';

const isCI = typeof window === 'undefined' ? !!process.env.CI : false;
const isBrowser = typeof window !== 'undefined';

const beginScale = isCI ? 3 : 1;
const maxScale = isCI ? 3 : 4;
for (let depth = beginScale; depth <= maxScale; depth++) {
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
    bench.skipIf(isCI || isBrowser)('jotai', () => {
      const atoms = atomsWithoutSubJotai;
      const store = storeWithoutSubJotai;
      for (let i = 0; i < atoms[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * atoms[0].length);
        store.set(atoms[0][idx] as PrimitiveAtom<number>, (x) => x + 1);
      }
    });

    const { atoms: pSignals } = setupStoreWithoutSub(depth, preactSignalStrategy);
    bench.skipIf(isCI || isBrowser).skip('preact-signals', () => {
      for (let i = 0; i < pSignals[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * pSignals[0].length);
        const signal = pSignals[0][idx];
        signal.value = signal.value + 1;
      }
    });

    const { atoms: aSignals } = setupStoreWithoutSub(depth, alienSignalStrategy);
    bench.skipIf(isCI || isBrowser).skip('alien-signals', () => {
      for (let i = 0; i < aSignals[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * aSignals[0].length);
        const signal = aSignals[0][idx] as Signal<number>;
        signal.set(signal.get() + 1);
      }
    });
  });
}
