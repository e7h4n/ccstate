import { describe, expect, it, vi } from 'vitest';
import { delay } from 'signal-timers';
import { createStore, computed, state } from '..';

it('computed should accept abort signal', async () => {
  const store = createStore();
  const trace = vi.fn();
  const refresh = state(0);
  const atom = computed(async (get, { signal }) => {
    const ret = get(refresh);
    await delay(0, { signal });
    trace();
    return ret;
  });

  const ret1 = store.get(atom);
  store.set(refresh, (x) => x + 1);
  const ret2 = store.get(atom);
  await expect(ret1).rejects.toThrow('abort anonymous atom');
  await expect(ret2).resolves.toBe(1);
  expect(trace).toHaveBeenCalledTimes(1);
});

describe.each([false, true])('computed signals (mounted=%s)', (mounted) => {
  it('returns the same signal throughout one evaluation', () => {
    const store = createStore();
    const source = state(0);
    const invocations: { signal: AbortSignal }[] = [];
    const value = computed((get, options) => {
      get(source);
      invocations.push(options);
      const signal = options.signal;
      expect(options.signal).toBe(signal);
      expect(signal.aborted).toBe(false);
      return signal;
    });
    if (mounted) store.watch(value, () => undefined);

    const first = store.get(value);
    expect(invocations[0]?.signal).toBe(first);
    expect(first.aborted).toBe(false);
    store.set(source, 1);
    const second = store.get(value);
    expect(second).not.toBe(first);
    expect(first.aborted).toBe(true);
    expect(invocations[0]?.signal).toBe(first);
    expect(invocations[1]?.signal).toBe(second);
    expect(second.aborted).toBe(false);
  });

  it.each([false, true])(
    'an old async continuation cannot cancel the current signal (read before await=%s)',
    async (readBeforeAwait) => {
      const store = createStore();
      const source = state(0);
      let current: AbortSignal | undefined;
      const value = computed(async (get, options) => {
        const revision = get(source);
        const initial = readBeforeAwait || revision > 0 ? options.signal : undefined;
        if (revision > 0) current = initial;
        await Promise.resolve();
        const signal = options.signal;
        if (initial) expect(signal).toBe(initial);
        expect(options.signal).toBe(signal);
        return signal;
      });
      if (mounted) store.watch(value, () => undefined);

      const first = store.get(value);
      store.set(source, 1);
      const second = store.get(value);
      expect(current?.aborted).toBe(false);
      const [oldSignal, newSignal] = await Promise.all([first, second]);
      expect(oldSignal.aborted).toBe(true);
      expect(newSignal).toBe(current);
      expect(newSignal.aborted).toBe(false);
    },
  );

  it('invalidates only on reevaluation, even when the new branch does not read signal', () => {
    const store = createStore();
    const source = state(0);
    const unrelated = state(0);
    let signal: AbortSignal | undefined;
    const value = computed((get, options) => {
      const result = get(source);
      if (result === 0) signal = options.signal;
      return result;
    });
    if (mounted) store.watch(value, () => undefined);

    expect(store.get(value)).toBe(0);
    expect(store.get(value)).toBe(0);
    expect(signal?.aborted).toBe(false);
    store.set(unrelated, 1);
    expect(store.get(value)).toBe(0);
    expect(signal?.aborted).toBe(false);
    store.set(source, 0);
    expect(store.get(value)).toBe(0);
    expect(signal?.aborted).toBe(false);
    store.set(source, 1);
    expect(signal?.aborted).toBe(mounted);
    expect(store.get(value)).toBe(1);
    expect(signal?.aborted).toBe(true);
  });

  it('keeps signals isolated between stores', () => {
    const firstStore = createStore();
    const secondStore = createStore();
    const source = state(0);
    const value = computed((get, { signal }) => {
      get(source);
      return signal;
    });
    if (mounted) {
      firstStore.watch(value, () => undefined);
      secondStore.watch(value, () => undefined);
    }

    const firstSignal = firstStore.get(value);
    const secondSignal = secondStore.get(value);
    expect(firstSignal).not.toBe(secondSignal);
    firstStore.set(source, 1);
    const nextFirstSignal = firstStore.get(value);
    expect(firstSignal.aborted).toBe(true);
    expect(nextFirstSignal.aborted).toBe(false);
    expect(secondStore.get(value)).toBe(secondSignal);
    expect(secondSignal.aborted).toBe(false);
    secondStore.set(source, 1);
    expect(secondStore.get(value)).not.toBe(secondSignal);
    expect(secondSignal.aborted).toBe(true);
    expect(nextFirstSignal.aborted).toBe(false);
  });

  it('invalidates the previous signal when reevaluation throws before reading signal', () => {
    const store = createStore();
    const source = state(0);
    const error = new Error('failed');
    let signal: AbortSignal | undefined;
    const value = computed((get, options) => {
      const result = get(source);
      if (result === 1) throw error;
      signal = options.signal;
      return result;
    });
    const caught = computed((get) => {
      try {
        return get(value);
      } catch (error) {
        return error;
      }
    });
    if (mounted) store.watch(caught, () => undefined);

    expect(store.get(caught)).toBe(0);
    const firstSignal = signal;
    store.set(source, 1);
    expect(store.get(caught)).toBe(error);
    expect(firstSignal?.aborted).toBe(true);
    store.set(source, 2);
    expect(store.get(caught)).toBe(2);
    expect(signal).not.toBe(firstSignal);
    expect(signal?.aborted).toBe(false);
  });

  it('keeps returned Promises unchanged and lets old reads finish despite an aborted signal', async () => {
    const store = createStore();
    const source = state(0);
    const signals: AbortSignal[] = [];
    let resolveFirst!: (value: number) => void;
    let resolveSecond!: (value: number) => void;
    const first = new Promise<number>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<number>((resolve) => {
      resolveSecond = resolve;
    });
    const value = computed((get, { signal }) => {
      signals.push(signal);
      return get(source) === 0 ? first : second;
    });
    const unsubscribe = mounted ? store.watch(value, () => undefined) : () => undefined;

    expect(store.get(value)).toBe(first);
    store.set(source, 1);
    expect(store.get(value)).toBe(second);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    resolveSecond(2);
    await expect(second).resolves.toBe(2);
    resolveFirst(1);
    await expect(first).resolves.toBe(1);
    expect(store.get(value)).toBe(second);
    unsubscribe();
  });
});

it('observed computed signals stay stable within an evaluation and belong to that evaluation', () => {
  const store = createStore();
  const source = state(0);
  const invocations: { signal: AbortSignal }[] = [];
  const observed = computed((get, options) => {
    const value = get(source);
    invocations.push(options);
    return value;
  });
  const unsubscribe = store.watch(observed, () => undefined);

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
  unsubscribe();
});

it('a late first read of an observed computed signal cannot cancel the current evaluation', () => {
  const store = createStore();
  const source = state(0);
  const invocations: { signal: AbortSignal }[] = [];
  const observed = computed((get, options) => {
    const value = get(source);
    invocations.push(options);
    return value;
  });
  const unsubscribe = store.watch(observed, () => undefined);

  store.set(source, 1);
  const current = invocations[1]?.signal;
  expect(invocations[0]?.signal.aborted).toBe(true);
  expect(current.aborted).toBe(false);
  unsubscribe();
});

it('unsubscribing stops notification without taking ownership of a computed signal', () => {
  const store = createStore();
  const source = state(0);
  const signals: AbortSignal[] = [];
  const observed = computed((get, { signal }) => {
    signals.push(signal);
    return get(source);
  });
  const listener = vi.fn();
  const unsubscribe = store.watch(observed, listener);
  unsubscribe();
  expect(signals[0]?.aborted).toBe(false);
  store.set(source, 1);
  expect(signals).toHaveLength(1);
  expect(listener).not.toHaveBeenCalled();
  expect(store.get(observed)).toBe(1);
  expect(signals[0]?.aborted).toBe(true);
  expect(signals[1]?.aborted).toBe(false);
});
