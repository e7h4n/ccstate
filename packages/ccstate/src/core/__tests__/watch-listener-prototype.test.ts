import LeakDetector from 'jest-leak-detector';
import { expect, it, vi } from 'vitest';
import { command, computed, createStore, state } from '..';
import type { Getter, State } from '..';

it('computes on subscription without calling the listener, and skips equal results', () => {
  const store = createStore();
  const source = state(0);
  const read = vi.fn((get: Getter) => get(source) % 2);
  const target = computed(read);
  const listener = vi.fn();
  const unsubscribe = store.watch(target, listener);
  expect(read).toHaveBeenCalledTimes(1);
  expect(listener).not.toHaveBeenCalled();
  store.set(source, 2);
  expect(read).toHaveBeenCalledTimes(2);
  expect(listener).not.toHaveBeenCalled();
  store.set(source, 3);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(store.get(target)).toBe(1);
  unsubscribe();
});

it('subscribes directly to a state without a computed wrapper', () => {
  const store = createStore();
  const primitive = state(0);
  const listener = vi.fn();
  const stop = store.watch(primitive, listener);
  expect(listener).not.toHaveBeenCalled();
  store.set(primitive, 1);
  expect(listener).toHaveBeenCalledTimes(1);
  store.set(primitive, 1);
  expect(listener).toHaveBeenCalledTimes(1);
  stop();
  store.set(primitive, 2);
  expect(listener).toHaveBeenCalledTimes(1);
});

it('deduplicates a callback shared by a directly observed state and computed', () => {
  const store = createStore();
  const source = state(0);
  const derived = computed((get) => get(source) % 2);
  const observed: number[][] = [];
  const listener = () => {
    observed.push([store.get(source), store.get(derived)]);
  };
  const stopState = store.watch(source, listener);
  const stopDerived = store.watch(derived, listener);
  store.set(source, 1);
  store.set(source, 3);
  expect(observed).toEqual([
    [1, 1],
    [3, 1],
  ]);
  stopState();
  stopDerived();
});

it('keeps direct state subscriptions isolated between stores', () => {
  const first = createStore();
  const second = createStore();
  const source = state(0);
  const firstListener = vi.fn();
  const secondListener = vi.fn();
  const stopFirst = first.watch(source, firstListener);
  const stopSecond = second.watch(source, secondListener);
  first.set(source, 1);
  expect(firstListener).toHaveBeenCalledTimes(1);
  expect(secondListener).not.toHaveBeenCalled();
  expect(second.get(source)).toBe(0);
  stopFirst();
  second.set(source, 2);
  expect(secondListener).toHaveBeenCalledTimes(1);
  stopSecond();
});

it('rejects a write-only command as a subscription target', () => {
  const store = createStore();
  const target = command(() => undefined);
  expect(() => store.watch(target as unknown as ReturnType<typeof computed>, () => undefined)).toThrow(
    'watch requires a state or computed',
  );
});

it('keeps a root mounted until its last distinct listener unsubscribes', () => {
  const store = createStore();
  const source = state(0);
  const read = vi.fn((get: Getter) => get(source));
  const target = computed(read);
  const first = vi.fn();
  const second = vi.fn();
  const stopFirst = store.watch(target, first);
  const stopSecond = store.watch(target, second);
  stopFirst();
  stopFirst();
  store.set(source, 1);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  stopSecond();
  store.set(source, 2);
  expect(read).toHaveBeenCalledTimes(2);
  expect(second).toHaveBeenCalledTimes(1);
  expect(store.get(target)).toBe(2);
  expect(read).toHaveBeenCalledTimes(3);
});

it('updates an unequal-path diamond before notifying a shared root', () => {
  const store = createStore();
  const source = state(0);
  const short = computed((get) => get(source));
  const middle = computed((get) => get(source) + 1);
  const long = computed((get) => get(middle) + 1);
  const join = computed((get) => [get(short), get(long)]);
  const observed: unknown[] = [];
  const stop = store.watch(join, () => observed.push(store.get(join)));
  store.set(source, 1);
  expect(observed).toEqual([[1, 3]]);
  stop();
});

it('deduplicates one callback observing two roots in the same propagation', () => {
  const store = createStore();
  const source = state(0);
  const first = computed((get) => get(source));
  const second = computed((get) => get(source) * 2);
  const listener = vi.fn(() => {
    expect(store.get(first)).toBe(1);
    expect(store.get(second)).toBe(2);
  });
  const stopFirst = store.watch(first, listener);
  const stopSecond = store.watch(second, listener);
  store.set(source, 1);
  expect(listener).toHaveBeenCalledTimes(1);
  stopFirst();
  stopSecond();
});

it('batches synchronous command writes and notifies their final value', () => {
  const store = createStore();
  const source = state(0);
  const target = computed((get) => get(source));
  const observed: number[] = [];
  const stop = store.watch(target, () => observed.push(store.get(target)));
  store.set(
    command(({ set }) => {
      set(source, 1);
      set(source, 2);
      set(source, 3);
    }),
  );
  expect(observed).toEqual([3]);
  stop();
});

it('flushes writes that happened before a command throws', () => {
  const store = createStore();
  const source = state(0);
  const target = computed((get) => get(source));
  const listener = vi.fn();
  const stop = store.watch(target, listener);
  expect(() =>
    store.set(
      command(({ set }) => {
        set(source, 1);
        throw new Error('command failed');
      }),
    ),
  ).toThrow('command failed');
  expect(listener).toHaveBeenCalledTimes(1);
  stop();
});

it('supports synchronous reentrant writes from a listener', () => {
  const store = createStore();
  const source = state(0);
  const target = computed((get) => get(source));
  const observed: number[] = [];
  const stop = store.watch(target, () => {
    const value = store.get(target);
    observed.push(value);
    if (value < 3) store.set(source, value + 1);
  });
  store.set(source, 1);
  expect(observed).toEqual([1, 2, 3]);
  stop();
});

it('runs remaining callbacks and throws listener errors as AggregateError', () => {
  const store = createStore();
  const source = state(0);
  const target = computed((get) => get(source));
  const stopFirst = store.watch(target, () => {
    throw new Error('listener failed');
  });
  const second = vi.fn();
  const stopSecond = store.watch(target, second);
  let thrown: unknown;
  try {
    store.set(source, 1);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).name).toBe('AggregateError');
  expect(second).toHaveBeenCalledTimes(1);
  stopFirst();
  stopSecond();
});

it('notifies error/value transitions but bails out on the same error', () => {
  const store = createStore();
  const source = state(0);
  const error = new Error('computed failed');
  const target = computed((get) => {
    if (get(source) > 0) throw error;
    return 42;
  });
  const listener = vi.fn();
  const stop = store.watch(target, listener);
  store.set(source, 1);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(() => store.get(target)).toThrow(error);
  store.set(source, 2);
  expect(listener).toHaveBeenCalledTimes(1);
  store.set(source, 0);
  expect(listener).toHaveBeenCalledTimes(2);
  expect(store.get(target)).toBe(42);
  stop();
});

it('does not notify after unsubscribing during a callback', () => {
  const store = createStore();
  const source = state(0);
  const target = computed((get) => get(source));
  const listener = vi.fn(() => {
    stop();
  });
  const stop = store.watch(target, listener);
  store.set(source, 1);
  store.set(source, 2);
  expect(listener).toHaveBeenCalledTimes(1);
});

it('releases an obsolete branch while the direct root subscription remains alive', async () => {
  const store = createStore();
  const branch = state(false);
  let old: State<{ value: number }> | undefined = state({ value: 1 });
  const signalDetector = new LeakDetector(old);
  const payloadDetector = new LeakDetector(store.get(old));
  const current = state({ value: 2 });
  const target = computed((get) => (get(branch) ? get(current).value : old && get(old).value));
  const stop = store.watch(target, () => undefined);
  store.set(branch, true);
  expect(store.get(target)).toBe(2);
  old = undefined;
  expect(await signalDetector.isLeaking()).toBe(false);
  expect(await payloadDetector.isLeaking()).toBe(false);
  store.set(current, { value: 3 });
  expect(store.get(target)).toBe(3);
  stop();
});

it('tracks dependencies first read after await while the root remains subscribed', async () => {
  const store = createStore();
  const source = state(0);
  let reads = 0;
  const target = computed(async (get) => {
    reads += 1;
    await Promise.resolve();
    return get(source);
  });
  const listener = vi.fn();
  const stop = store.watch(target, listener);
  expect(await store.get(target)).toBe(0);
  store.set(source, 1);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(await store.get(target)).toBe(1);
  expect(reads).toBe(2);
  stop();
});

it('does not let an obsolete async evaluation reattach an old dependency or notify', async () => {
  const store = createStore();
  const branch = state(false);
  const old = state(1);
  const current = state(2);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = () => {
      resolve();
    };
  });
  let reads = 0;
  const target = computed(async (get) => {
    reads += 1;
    if (get(branch)) return get(current);
    await gate;
    return get(old);
  });
  const listener = vi.fn();
  const stop = store.watch(target, listener);
  const obsoletePromise = store.get(target);
  store.set(branch, true);
  const currentPromise = store.get(target);
  expect(await currentPromise).toBe(2);
  release();
  expect(await obsoletePromise).toBe(1);
  store.set(old, 99);
  expect(reads).toBe(2);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(store.get(target)).toBe(currentPromise);
  store.set(current, 3);
  expect(await store.get(target)).toBe(3);
  expect(listener).toHaveBeenCalledTimes(2);
  stop();
});

it('preserves computed AbortSignal ownership independently of listener lifetime', () => {
  const store = createStore();
  const source = state(0);
  const signals: AbortSignal[] = [];
  const target = computed((get, options) => {
    signals.push(options.signal);
    return get(source);
  });
  const stop = store.watch(target, () => undefined);
  store.set(source, 1);
  expect(signals[0]?.aborted).toBe(true);
  expect(signals[1]?.aborted).toBe(false);
  stop();
  expect(signals[1]?.aborted).toBe(false);
});
