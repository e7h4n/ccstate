import { bench, describe } from 'vitest';
import { setupStore } from './case';
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
  describe(`set with subscription, ${String(Math.pow(10, depth))} atoms pyramid`, () => {
    const { atoms: atomsCCState, store: storeCCState } = setupStore(depth, ccstateStrategy);
    bench('ccstate', () => {
      const atoms = atomsCCState;
      const store = storeCCState;
      for (let i = 0; i < atoms[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * atoms[0].length);
        store.set(atoms[0][idx] as State<number>, (x) => x + 1);
      }
    });

    const { atoms: atomsJotai, store: storeJotai } = setupStore(depth, jotaiStrategy);
    bench.skipIf(isCI || isBrowser)('jotai', () => {
      const atoms = atomsJotai;
      const store = storeJotai;
      for (let i = 0; i < atoms[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * atoms[0].length);
        store.set(atoms[0][idx] as PrimitiveAtom<number>, (x) => x + 1);
      }
    });

    const { atoms: pSignals } = setupStore(depth, preactSignalStrategy);
    bench.skipIf(isCI || isBrowser)('preact-signals', () => {
      for (let i = 0; i < pSignals[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * pSignals[0].length);
        const signal = pSignals[0][idx];
        signal.value = signal.value + 1;
      }
    });

    const { atoms: aSignals } = setupStore(depth, alienSignalStrategy);
    bench.skipIf(isCI || isBrowser)('alien-signals', () => {
      for (let i = 0; i < aSignals[0].length / 10; i++) {
        const idx = Math.floor(Math.random() * aSignals[0].length);
        const signal = aSignals[0][idx] as Signal<number>;
        signal.set(signal.get() + 1);
      }
    });
  });
}
