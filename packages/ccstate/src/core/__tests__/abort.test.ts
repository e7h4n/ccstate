import { expect, expectTypeOf, it, vi } from 'vitest';
import { createStore, computed, state, type Getter, type Read } from '..';

it('computed callbacks receive only the tracked getter', () => {
  expectTypeOf<Parameters<Read<number>>>().toEqualTypeOf<[Getter]>();
  const store = createStore();
  const source = state(1);
  const read = vi.fn((get: Getter) => get(source));

  expect(store.get(computed(read))).toBe(1);
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith(expect.any(Function));
});

it.each([false, true])(
  'computed keeps returned Promises unchanged and lets old reads finish (mounted=%s)',
  async (mounted) => {
    const store = createStore();
    const source = state(0);
    let resolveFirst!: (value: number) => void;
    let resolveSecond!: (value: number) => void;
    const first = new Promise<number>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<number>((resolve) => {
      resolveSecond = resolve;
    });
    const value = computed((get) => (get(source) === 0 ? first : second));
    const controller = new AbortController();
    if (mounted)
      store.watch(
        (get) => {
          void get(value);
        },
        { signal: controller.signal },
      );

    expect(store.get(value)).toBe(first);
    store.set(source, 1);
    expect(store.get(value)).toBe(second);
    resolveSecond(2);
    await expect(second).resolves.toBe(2);
    resolveFirst(1);
    await expect(first).resolves.toBe(1);
    expect(store.get(value)).toBe(second);
    controller.abort();
  },
);

it('watch signals stay stable within an invocation and belong to that invocation', () => {
  const store = createStore();
  const source = state(0);
  const invocations: { signal: AbortSignal }[] = [];
  store.watch((get, options) => {
    get(source);
    invocations.push(options);
  });

  const first = invocations[0]?.signal;
  expect(first.aborted).toBe(false);
  expect(invocations[0]?.signal).toBe(first);

  store.set(source, 1);
  // Re-running a watch cancels its previous side effects even when this
  // invocation has not requested its signal yet.
  expect(first.aborted).toBe(true);
  const second = invocations[1]?.signal;
  expect(second.aborted).toBe(false);
  expect(invocations[1]?.signal).toBe(second);
});

it('a late first read of an old watch signal cannot cancel the current invocation', () => {
  const store = createStore();
  const source = state(0);
  const invocations: { signal: AbortSignal }[] = [];
  store.watch((get, options) => {
    get(source);
    invocations.push(options);
  });

  store.set(source, 1);
  const current = invocations[1]?.signal;
  expect(invocations[0]?.signal.aborted).toBe(true);
  expect(current.aborted).toBe(false);
});

it('an external signal still cancels watch side effects and unsubscribes', () => {
  const store = createStore();
  const source = state(0);
  const controller = new AbortController();
  const signals: AbortSignal[] = [];
  store.watch(
    (get, { signal }) => {
      get(source);
      signals.push(signal);
    },
    { signal: controller.signal },
  );

  controller.abort();
  expect(signals[0]?.aborted).toBe(true);
  store.set(source, 1);
  expect(signals).toHaveLength(1);
});
