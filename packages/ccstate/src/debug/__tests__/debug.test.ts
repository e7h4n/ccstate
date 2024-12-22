import { expect, it } from 'vitest';
import { computed, command, state } from '../../core';
import { createDebugStore } from '..';
import { nestedAtomToString } from '../../__tests__/util';

it('get all subscribed atoms', () => {
  const store = createDebugStore();
  const base = state(1, { debugLabel: 'base' });
  const derived = computed((get) => get(base) + 1, { debugLabel: 'derived' });
  store.sub(
    [base, derived],
    command(
      () => {
        void 0;
      },
      { debugLabel: 'sub' },
    ),
  );
  expect(nestedAtomToString(store.getSubscribeGraph())).toEqual([
    ['base', 'sub'],
    ['derived', 'sub'],
  ]);
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

it('correctly process unsub decount', () => {
  const store = createDebugStore();
  const controller = new AbortController();
  const base$ = state(1);
  const callback$ = command(() => void 0);
  store.sub(base$, callback$, { signal: controller.signal });

  expect(store.getSubscribeGraph()).toEqual([[base$, callback$]]);

  controller.abort();

  expect(store.getSubscribeGraph()).toEqual([]);
});
