import { expect, test } from 'vitest';
import { setupStore } from './case';
import type { Value } from '../src';
import type { PrimitiveAtom } from 'jotai/vanilla';
import { ccstateStrategy } from './strategy/ccstate';
import { jotaiStrategy } from './strategy/jotai';
import { signalStrategy } from './strategy/signals';

test('ccstate write scenario', () => {
  const { cleanup, atoms, store } = setupStore(2, ccstateStrategy);
  for (let i = 0; i < atoms[0].length / 10; i++) {
    const atom = atoms[0][i * 10] as Value<number>;
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
  const { cleanup, atoms: signals } = setupStore(2, signalStrategy);
  for (let i = 0; i < signals[0].length / 10; i++) {
    const signal = signals[0][i * 10];
    signal.value = signal.value + 1;
  }
  expect(signals[signals.length - 1][0].value).toBe(4960);
  cleanup();
});
