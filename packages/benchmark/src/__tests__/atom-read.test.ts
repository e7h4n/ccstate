import { vi, expect, test } from 'vitest';
import { setupStore, setupStoreWithoutSub } from './case';
import { type State } from 'ccstate';
import type { PrimitiveAtom } from 'jotai/vanilla';
import { ccstateStrategy } from './strategy/ccstate';
import { jotaiStrategy } from './strategy/jotai';
import { preactSignalStrategy } from './strategy/preact-signals';

test('ccstate write scenario', () => {
  const { cleanup, atoms, store } = setupStore(2, ccstateStrategy);
  for (let i = 0; i < atoms[0].length / 10; i++) {
    const atom = atoms[0][i * 10] as State<number>;
    const val = store.get(atom);
    store.set(atom, val + 1);
  }
  expect(store.get(atoms[atoms.length - 1][0])).toBe(4960);
  cleanup();
});

test('jotai write scenario', () => {
  const { cleanup, atoms, store } = setupStore(2, jotaiStrategy);
  for (let i = 0; i < atoms[0].length / 10; i++) {
    const atom = atoms[0][i * 10] as PrimitiveAtom<number>;
    const val = store.get(atom);
    store.set(atom, val + 1);
  }
  expect(store.get(atoms[atoms.length - 1][0])).toBe(4960);
  cleanup();
});

test('signals write scenario', () => {
  const { cleanup, atoms: signals } = setupStore(2, preactSignalStrategy);
  for (let i = 0; i < signals[0].length / 10; i++) {
    const signal = signals[0][i * 10];
    signal.value = signal.value + 1;
  }
  expect(signals[signals.length - 1][0].value).toBe(4960);
  cleanup();
});

test('ccstate sub scenerio', () => {
  const { atoms, store } = setupStoreWithoutSub(1, ccstateStrategy);

  const topComputed = atoms[atoms.length - 1][0];
  const trace = vi.fn();
  store.watch((get) => {
    get(topComputed);
    trace();
  });
  const bottomAtom = atoms[0][0] as State<number>;
  store.set(bottomAtom, (x) => x + 1);
  expect(trace).toHaveBeenCalledTimes(2);
});
