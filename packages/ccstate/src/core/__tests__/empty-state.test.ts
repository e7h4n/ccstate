import { expect, it, vi } from 'vitest';
import { createStore, state } from '..';

it('preserves undefined written before the first read', () => {
  const store = createStore();
  const source$ = state<number | undefined>(42);
  store.set(source$, undefined);
  expect(store.get(source$)).toBeUndefined();
});

it.each([null, undefined])('passes the current %s to an updater', (empty) => {
  const store = createStore();
  const source$ = state<number | null | undefined>(42);
  store.set(source$, empty);
  const updater = vi.fn((current: number | null | undefined) => (current === empty ? 9 : 0));
  store.set(source$, updater);
  expect(updater.mock.calls).toEqual([[empty]]);
  expect(store.get(source$)).toBe(9);
});
