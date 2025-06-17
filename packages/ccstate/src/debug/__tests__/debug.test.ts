import { expect, it } from 'vitest';
import { computed, state } from '../../core';
import { createDebugStore } from '..';
import { nestedAtomToString } from '../../__tests__/util';

it('get all subscribed atoms', () => {
  const store = createDebugStore();
  const base = state(1, { debugLabel: 'base' });
  const derived = computed((get) => get(base) + 1, { debugLabel: 'derived' });
  store.watch((get) => {
    get(derived);
  });
  expect(store.isMounted(base)).toBe(true);
  expect(store.isMounted(derived)).toBe(true);
});

it('cant get read depts if atom is not subscribed', () => {
  const store = createDebugStore();
  const base$ = state(1, { debugLabel: 'base' });
  const derived$ = computed((get) => get(base$), { debugLabel: 'derived' });

  expect(store.get(derived$)).toBe(1);

  expect(store.getReadDependents(base$)).toEqual([base$]);
});

it('nestedAtomToString will print anonymous if no debugLabel is provided', () => {
  const base$ = state(1);
  expect(nestedAtomToString([base$])).toEqual(['anonymous']);
});
