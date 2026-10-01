import { expect, it, vi } from 'vitest';
import { command, computed, createStore, state } from '..';
import type { Getter, Setter } from '..';

it('computes once and notifies once for three synchronous writes without intermediate reads', () => {
  const store = createStore();
  const source = state(0);
  const read = vi.fn((get: Getter) => get(source) * 2);
  const target = computed(read);
  const seen: number[] = [];
  const stop = store.watch(target, () => seen.push(store.get(target)));
  read.mockClear();
  store.set(
    command(({ set }) => {
      set(source, 1);
      set(source, 2);
      set(source, 3);
    }),
  );
  expect(read).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([6]);
  stop();
});

it('returns fresh intermediate values but notifies only once', () => {
  const store = createStore();
  const source = state(0);
  const read = vi.fn((get: Getter) => get(source) * 2);
  const target = computed(read);
  const seen: number[] = [];
  const intermediate: number[] = [];
  const stop = store.watch(target, () => seen.push(store.get(target)));
  read.mockClear();
  store.set(
    command(({ get, set }) => {
      set(source, 1);
      intermediate.push(get(target));
      set(source, 2);
      intermediate.push(get(target));
      set(source, 3);
    }),
  );
  expect(read).toHaveBeenCalledTimes(3);
  expect(intermediate).toEqual([2, 4]);
  expect(seen).toEqual([6]);
  stop();
});

it('also keeps a captured public store.get fresh inside a command', () => {
  const store = createStore();
  const source = state(0);
  const target = computed((get) => get(source) * 2);
  const seen: number[] = [];
  const stop = store.watch(target, () => seen.push(store.get(target)));
  store.set(
    command(({ set }) => {
      set(source, 1);
      expect(store.get(target)).toBe(2);
      set(source, 2);
    }),
  );
  expect(seen).toEqual([4]);
  stop();
});

it('shares the synchronous internal write boundary with nested commands', () => {
  const store = createStore();
  const source = state(0);
  const read = vi.fn((get: Getter) => get(source));
  const target = computed(read);
  const seen: number[] = [];
  const stop = store.watch(target, () => seen.push(store.get(target)));
  const inner = command(({ set }) => {
    set(source, 2);
    set(source, 3);
  });
  read.mockClear();
  store.set(
    command(({ set }) => {
      set(source, 1);
      set(inner);
      set(source, 4);
    }),
  );
  expect(read).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([4]);
  stop();
});

it('flushes an escaped setter after the command invocation returned', () => {
  const store = createStore();
  const source = state(0);
  const seen: number[] = [];
  const stop = store.watch(source, () => seen.push(store.get(source)));
  const escaped: Setter = store.set(command(({ set }) => set));
  escaped(source, 1);
  escaped(source, 2);
  expect(seen).toEqual([1, 2]);
  stop();
});

it('flushes the synchronous prefix before await and each later setter separately', async () => {
  const store = createStore();
  const source = state(0);
  const seen: number[] = [];
  const stop = store.watch(source, () => seen.push(store.get(source)));
  const pending = store.set(
    command(async ({ set }) => {
      set(source, 1);
      set(source, 2);
      await Promise.resolve();
      set(source, 3);
      set(source, 4);
    }),
  );
  expect(seen).toEqual([2]);
  await pending;
  expect(seen).toEqual([2, 3, 4]);
  stop();
});

it('flushes every write of a nested async command after its synchronous prefix', async () => {
  const store = createStore();
  const source = state(0);
  const seen: number[] = [];
  const stop = store.watch(source, () => seen.push(store.get(source)));
  let pending: Promise<void> | undefined;
  const inner = command(async ({ set }) => {
    set(source, 1);
    await Promise.resolve();
    set(source, 3);
  });
  store.set(
    command(({ set }) => {
      pending = set(inner);
      set(source, 2);
    }),
  );
  expect(seen).toEqual([2]);
  await pending;
  expect(seen).toEqual([2, 3]);
  stop();
});

it('flushes all outstanding sources at a nested public set boundary', () => {
  const store = createStore();
  const first = state(0);
  const second = state(0);
  const target = computed((get) => get(first) + get(second));
  const seen: number[] = [];
  const stop = store.watch(target, () => seen.push(store.get(target)));
  store.set(
    command(({ set }) => {
      set(first, 1);
      store.set(second, 1);
      set(first, 2);
    }),
  );
  expect(seen).toEqual([2, 3]);
  stop();
});

it('does not prematurely flush a nested public set whose changed-source size is unchanged', () => {
  const store = createStore();
  const source = state(0);
  const seen: number[] = [];
  const stop = store.watch(source, () => seen.push(store.get(source)));
  store.set(
    command(({ set }) => {
      set(source, 1);
      store.set(source, 2);
    }),
  );
  expect(seen).toEqual([2]);
  stop();
});

it('initializes a new subscription against pending values without an initial notification', () => {
  const store = createStore();
  const source = state(0);
  const target = computed((get) => get(source));
  const seen: number[] = [];
  let stop: () => void = () => undefined;
  store.set(
    command(({ set }) => {
      set(source, 1);
      stop = store.watch(target, () => seen.push(store.get(target)));
      expect(store.get(target)).toBe(1);
      expect(seen).toEqual([]);
      set(source, 2);
    }),
  );
  expect(seen).toEqual([2]);
  stop();
});

it('refreshes conditional dependency edges after an eager read in a command', () => {
  const store = createStore();
  const enabled = state(false);
  const source = state(0);
  const target = computed((get) => (get(enabled) ? get(source) : undefined));
  const seen: (number | undefined)[] = [];
  const stop = store.watch(target, () => seen.push(store.get(target)));
  store.set(
    command(({ get, set }) => {
      set(enabled, true);
      expect(get(target)).toBe(0);
      set(source, 1);
    }),
  );
  expect(seen).toEqual([1]);
  store.set(source, 2);
  expect(seen).toEqual([1, 2]);
  stop();
});

it('does not lose a changed branch when another branch returns the same result', () => {
  const store = createStore();
  const first = state([0]);
  const second = state([0]);
  const a = computed((get) => get(first)[0]);
  const b = computed((get) => get(second)[0]);
  const target = computed((get) => [get(a), get(b)]);
  const seen: unknown[] = [];
  const stop = store.watch(target, () => seen.push(store.get(target)));
  store.set(
    command(({ set }) => {
      set(first, [0]);
      set(second, [1]);
    }),
  );
  expect(seen).toEqual([[0, 1]]);
  stop();
});

it('deduplicates the same listener across multiple changed sources in one command', () => {
  const store = createStore();
  const first = state(0);
  const second = state(0);
  const seen: number[][] = [];
  const listener = () => {
    seen.push([store.get(first), store.get(second)]);
  };
  const stopFirst = store.watch(first, listener);
  const stopSecond = store.watch(second, listener);
  store.set(
    command(({ set }) => {
      set(first, 1);
      set(second, 1);
    }),
  );
  expect(seen).toEqual([[1, 1]]);
  stopFirst();
  stopSecond();
});

it('flushes final values even if a command throws after several writes', () => {
  const store = createStore();
  const source = state(0);
  const seen: number[] = [];
  const stop = store.watch(source, () => seen.push(store.get(source)));
  expect(() => {
    store.set(
      command(({ set }) => {
        set(source, 1);
        set(source, 2);
        throw new Error('write failed');
      }),
    );
  }).toThrow('write failed');
  expect(seen).toEqual([2]);
  stop();
});

it('preserves a listener mounted by a state updater before that updater returns', () => {
  const store = createStore();
  const source = state(0);
  const seen: number[] = [];
  let stop: () => void = () => undefined;
  store.set(source, (current) => {
    stop = store.watch(source, () => seen.push(store.get(source)));
    return current + 1;
  });
  expect(seen).toEqual([1]);
  stop();
});

it('keeps a retained computed getter reactive across reused write work buffers', () => {
  const store = createStore();
  const stable = state(0);
  const changing = state(0);
  const closure = computed((get) => (value: number) => value + get(stable));
  const upstream = computed((get) => get(closure)(get(changing)));
  const downstream = computed((get) => get(upstream) * 2);
  const seen: number[] = [];
  const stop = store.watch(downstream, () => seen.push(store.get(downstream)));
  store.set(changing, 1);
  store.set(changing, 2);
  store.set(stable, 10);
  expect(seen).toEqual([2, 4, 24]);
  stop();
});

it('handles a signal abort handler writing during graph recomputation before notification', () => {
  const store = createStore();
  const source = state(0);
  const other = state(0);
  const primary = computed((get, options) => {
    const value = get(source);
    if (value === 0)
      options.signal.addEventListener('abort', () => {
        store.set(other, 1);
      });
    return value;
  });
  const target = computed((get) => get(primary) + get(other));
  const seen: number[] = [];
  const stop = store.watch(target, () => seen.push(store.get(target)));
  store.set(source, 1);
  expect(seen).toEqual([2]);
  stop();
});
