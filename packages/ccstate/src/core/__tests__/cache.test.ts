import { afterEach, expect, it, vi } from 'vitest';
import { computed, createStore, state, type Getter } from '..';
import * as computedInternals from '../signal/computed';

afterEach(() => {
  vi.restoreAllMocks();
});

it('does not repeatedly traverse shared unmounted dependencies', () => {
  // Every computed read enters tryGetCached, even when no read function reruns.
  const cacheLookup = vi.spyOn(computedInternals, 'tryGetCached');
  const evaluate = vi.fn();
  const counted = (read: (get: Getter) => number) =>
    computed((get) => {
      evaluate();
      return read(get);
    });
  const store = createStore();
  const source = state(1);
  const unrelated = state(0);
  const depth = 8;
  const nodeCount = 2 * depth + 1;
  let left = counted((get) => get(source));
  let right = counted((get) => get(source));
  for (let layer = 1; layer < depth; layer++) {
    const previousLeft = left;
    const previousRight = right;
    left = counted((get) => get(previousLeft) + get(previousRight));
    right = counted((get) => get(previousLeft) + get(previousRight));
  }
  const root = counted((get) => get(left) + get(right));

  expect(store.get(root)).toBe(2 ** depth);
  expect(evaluate).toHaveBeenCalledTimes(nodeCount);
  // Fixed fan-in bounds the dependency edges, so traversal must stay linear.
  expect(cacheLookup.mock.calls.length).toBeLessThanOrEqual(2 * nodeCount);

  cacheLookup.mockClear();
  expect(store.get(root)).toBe(2 ** depth);
  expect(cacheLookup).toHaveBeenCalledTimes(1);
  expect(evaluate).toHaveBeenCalledTimes(nodeCount);

  store.set(unrelated, 1);
  cacheLookup.mockClear();
  expect(store.get(root)).toBe(2 ** depth);
  expect(cacheLookup.mock.calls.length).toBeLessThanOrEqual(2 * nodeCount);
  expect(evaluate).toHaveBeenCalledTimes(nodeCount);

  cacheLookup.mockClear();
  expect(store.get(root)).toBe(2 ** depth);
  expect(cacheLookup).toHaveBeenCalledTimes(1);

  store.set(source, 2);
  cacheLookup.mockClear();
  expect(store.get(root)).toBe(2 ** (depth + 1));
  // Changed dependencies can be visited during both validation and computation.
  expect(cacheLookup.mock.calls.length).toBeLessThanOrEqual(3 * nodeCount);
  expect(evaluate).toHaveBeenCalledTimes(2 * nodeCount);

  cacheLookup.mockClear();
  expect(store.get(root)).toBe(2 ** (depth + 1));
  expect(cacheLookup).toHaveBeenCalledTimes(1);
});

it('keeps multiple unmounted root caches valid after a write', () => {
  const cacheLookup = vi.spyOn(computedInternals, 'tryGetCached');
  const store = createStore();
  const source = state(1);
  const shared = computed((get) => get(source));
  const first = computed((get) => get(shared) + 1);
  const second = computed((get) => get(shared) + 2);

  expect(store.get(first)).toBe(2);
  expect(store.get(second)).toBe(3);

  store.set(source, 2);
  expect(store.get(first)).toBe(3);
  expect(store.get(second)).toBe(4);

  cacheLookup.mockClear();
  expect(store.get(first)).toBe(3);
  expect(cacheLookup).toHaveBeenCalledTimes(1);

  cacheLookup.mockClear();
  expect(store.get(second)).toBe(4);
  expect(cacheLookup).toHaveBeenCalledTimes(1);
});
