import { describe, expect, it, vi } from 'vitest';
import { command, computed, state } from '../signal/factory';
import { createStore } from '../store/store';

describe('subscription and explicit effect ownership', () => {
  it('batches the synchronous async-command prefix and notifies later writes separately', async () => {
    const base$ = state(0);
    const action$ = command(async ({ set }) => {
      set(base$, 1);
      set(base$, 2);
      await Promise.resolve();
      set(base$, 3);
      set(base$, 4);
    });
    const trace = vi.fn();
    const store = createStore();
    const unsubscribe = store.watch(base$, () => {
      trace(store.get(base$));
    });
    expect(trace).not.toHaveBeenCalled();
    const ret = store.set(action$);
    expect(trace).toHaveBeenCalledTimes(1);
    expect(trace).toHaveBeenLastCalledWith(2);
    await ret;
    expect(trace.mock.calls).toEqual([[2], [3], [4]]);
    unsubscribe();
  });

  it('reads the initial value separately and does not invoke the listener initially', () => {
    const base$ = state(0);
    const trace = vi.fn();
    const store = createStore();
    const unsubscribe = store.watch(base$, () => {
      trace(store.get(base$));
    });
    expect(store.get(base$)).toBe(0);
    expect(trace).not.toHaveBeenCalled();
    store.set(base$, 1);
    expect(trace.mock.calls).toEqual([[1]]);
    unsubscribe();
  });

  it('allows the task owner to compose an external cancellation signal explicitly', async () => {
    const trace = vi.fn();
    const store = createStore();
    const owner = new AbortController();
    const source = state(0);
    const task = computed(async (get, options) => {
      get(source);
      const signal = AbortSignal.any([owner.signal, options.signal]);
      await Promise.resolve();
      if (signal.aborted) trace('aborted');
    });
    const listener = vi.fn();
    const unsubscribe = store.watch(task, listener);
    const pending = store.get(task);
    unsubscribe();
    owner.abort();
    await pending;
    expect(trace.mock.calls).toEqual([['aborted']]);
    store.set(source, 1);
    expect(listener).not.toHaveBeenCalled();
    expect(trace).toHaveBeenCalledTimes(1);
  });

  it('notifies synchronously when the observed value changes', () => {
    const base$ = state(0);
    const trace = vi.fn();
    const store = createStore();
    const unsubscribe = store.watch(base$, () => {
      trace(store.get(base$));
    });
    expect(trace).not.toHaveBeenCalled();
    store.set(base$, 1);
    expect(trace.mock.calls).toEqual([[1]]);
    unsubscribe();
  });

  it('cancels an observed computation old async work on reevaluation', async () => {
    const base$ = state(0);
    const trace = vi.fn();
    const store = createStore();
    const task = computed(async (get, { signal }) => {
      get(base$);
      await Promise.resolve();
      if (signal.aborted) trace('aborted');
    });
    const unsubscribe = store.watch(task, () => undefined);
    const first = store.get(task);
    store.set(base$, 1);
    const second = store.get(task);
    await Promise.all([first, second]);
    expect(trace.mock.calls).toEqual([['aborted']]);
    unsubscribe();
  });
});

it('notifies for each independent value-changing public write', () => {
  const base$ = state(0);
  const trace = vi.fn();
  const store = createStore();
  const unsubscribe = store.watch(base$, () => {
    trace(store.get(base$));
  });
  expect(trace).not.toHaveBeenCalled();
  store.set(base$, (x) => x + 1);
  store.set(base$, (x) => x + 1);
  store.set(base$, (x) => x + 1);
  store.set(base$, (x) => x + 1);
  expect(trace.mock.calls).toEqual([[1], [2], [3], [4]]);
  unsubscribe();
});
