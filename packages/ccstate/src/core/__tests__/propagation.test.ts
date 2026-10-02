import { afterEach, expect, it, vi } from 'vitest';
import { computed, createStore, state, type Getter } from '..';
import * as computedInternals from '../signal/computed';
import { StoreImpl } from '../store/store';

afterEach(() => {
  vi.restoreAllMocks();
});

it.each([4, 8, 12])('visits a mounted %i-layer diamond in linear work per write', (depth) => {
  class CountingStore extends StoreImpl {
    // Count all three propagation passes, including marking and snapshotting
    // which never enter tryGetCached. The spy preserves normal state access.
    readonly stateLookups = vi.spyOn(this.stateMap, 'get');
  }

  const store = new CountingStore();
  const cacheLookup = vi.spyOn(computedInternals, 'tryGetCached');
  const evaluate = vi.fn();
  const counted = (read: (get: Getter) => number) =>
    computed((get) => {
      evaluate();
      return read(get);
    });
  const source = state(1);
  let left = counted((get) => get(source));
  let right = counted((get) => get(source));
  for (let layer = 1; layer < depth; layer++) {
    const previousLeft = left;
    const previousRight = right;
    left = counted((get) => get(previousLeft) + get(previousRight));
    right = counted((get) => get(previousLeft) + get(previousRight));
  }
  const root = counted((get) => get(left) + get(right));
  const nodeCount = 2 * depth + 1;
  const values: number[] = [];
  store.watch(root, () => {
    values.push(store.get(root));
  });
  expect(store.get(root)).toBe(2 ** depth);
  expect(values).toEqual([]);
  expect(evaluate).toHaveBeenCalledTimes(nodeCount);

  for (const value of [2, 3]) {
    store.stateLookups.mockClear();
    cacheLookup.mockClear();
    evaluate.mockClear();
    store.set(source, value);

    expect(values).toEqual(Array.from({ length: value - 1 }, (_, index) => (index + 2) * 2 ** depth));
    expect(evaluate).toHaveBeenCalledTimes(nodeCount);
    // This graph has constant fan-in: reads and traversal must scale with nodes.
    expect(cacheLookup.mock.calls.length).toBeLessThanOrEqual(6 * (nodeCount + 1));
    expect(store.stateLookups.mock.calls.length).toBeLessThanOrEqual(16 * (nodeCount + 1));
  }
});

it('pulls dirty upstreams before visiting an unequal-path join only once', () => {
  const store = createStore();
  const source = state(1);
  const first = computed((get) => get(source) * 2);
  const second = computed((get) => get(first) * 3);
  const third = computed((get) => get(second) * 5);
  const evaluate = vi.fn((get: Getter) => get(source) + get(third));
  const join = computed(evaluate);
  const values: number[] = [];
  store.watch(join, () => {
    values.push(store.get(join));
  });
  evaluate.mockClear();

  store.set(source, 2);
  expect(store.get(join)).toBe(62);
  expect(values).toEqual([62]);
  expect(evaluate).toHaveBeenCalledTimes(1);
});

it('updates shared downstreams after switching mounted dependencies and bails out on equal values', () => {
  const store = createStore();
  const selectLeft = state(true);
  const left = state(1);
  const right = state(1);
  const selected = computed((get) => (get(selectLeft) ? get(left) : get(right)));
  const double = computed((get) => get(selected) * 2);
  const evaluate = vi.fn((get: Getter) => get(selected) + get(double));
  const join = computed(evaluate);
  const values: number[] = [];
  store.watch(join, () => {
    values.push(store.get(join));
  });
  evaluate.mockClear();

  store.set(selectLeft, false);
  store.set(left, 2);
  expect(store.get(join)).toBe(3);
  expect(values).toEqual([]);
  expect(evaluate).not.toHaveBeenCalled();

  store.set(right, 2);
  expect(values).toEqual([6]);
  expect(evaluate).toHaveBeenCalledTimes(1);

  store.set(selectLeft, true);
  store.set(right, 3);
  expect(values).toEqual([6]);
  expect(evaluate).toHaveBeenCalledTimes(1);

  store.set(left, 3);
  expect(values).toEqual([6, 9]);
  expect(evaluate).toHaveBeenCalledTimes(2);
});
