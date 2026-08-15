import { expect, it } from 'vitest';
import { computed, createStore, resource, state } from '..';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

it('resource exposes async state and retains data while refreshing', async () => {
  const requestId$ = state(0);
  const first = deferred<string>();
  const second = deferred<string>();
  const source$ = computed((get) => (get(requestId$) === 0 ? first.promise : second.promise));
  const user = resource(source$);
  const store = createStore();
  const controller = new AbortController();
  const snapshots: unknown[] = [];

  store.watch(
    (get) => {
      snapshots.push(get(user.snapshot$));
    },
    { signal: controller.signal },
  );

  expect(store.get(user.status$)).toBe('loading');
  expect(store.get(user.data$)).toBeUndefined();
  expect(store.get(user.loading$)).toBe(true);

  first.resolve('Ada');
  await flushPromises();

  expect(store.get(user.snapshot$)).toEqual({ status: 'success', data: 'Ada', error: undefined });
  expect(store.get(user.loading$)).toBe(false);

  store.set(requestId$, 1);

  expect(store.get(user.snapshot$)).toEqual({ status: 'loading', data: 'Ada', error: undefined });
  expect(store.get(user.loading$)).toBe(true);

  second.resolve('Grace');
  await flushPromises();

  expect(store.get(user.snapshot$)).toEqual({ status: 'success', data: 'Grace', error: undefined });
  expect(snapshots).toEqual([
    { status: 'loading', data: undefined, error: undefined },
    { status: 'success', data: 'Ada', error: undefined },
    { status: 'loading', data: 'Ada', error: undefined },
    { status: 'success', data: 'Grace', error: undefined },
  ]);

  controller.abort();
});

it('resource ignores a stale promise result', async () => {
  const requestId$ = state(0);
  const first = deferred<string>();
  const second = deferred<string>();
  const source$ = computed((get) => (get(requestId$) === 0 ? first.promise : second.promise));
  const user = resource(source$);
  const store = createStore();

  store.watch((get) => {
    get(user.snapshot$);
  });

  store.set(requestId$, 1);
  first.resolve('stale');
  await flushPromises();

  expect(store.get(user.snapshot$)).toEqual({ status: 'loading', data: undefined, error: undefined });

  second.resolve('current');
  await flushPromises();

  expect(store.get(user.snapshot$)).toEqual({ status: 'success', data: 'current', error: undefined });
});

it('resource retains data when a refresh fails', async () => {
  const requestId$ = state(0);
  const first = deferred<string>();
  const second = deferred<string>();
  const source$ = computed((get) => (get(requestId$) === 0 ? first.promise : second.promise));
  const user = resource(source$);
  const store = createStore();

  store.watch((get) => {
    get(user.snapshot$);
  });

  first.resolve('Ada');
  await flushPromises();
  store.set(requestId$, 1);

  const error = new Error('Request failed');
  second.reject(error);
  await flushPromises();

  expect(store.get(user.snapshot$)).toEqual({ status: 'error', data: 'Ada', error });
  expect(store.get(user.error$)).toBe(error);
});
