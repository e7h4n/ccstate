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
  const statuses: string[] = [];

  store.watch(
    (get) => {
      statuses.push(get(user.status$));
    },
    { signal: controller.signal },
  );

  expect(store.get(user.status$)).toBe('loading');
  expect(store.get(user.data$)).toBeUndefined();
  expect(store.get(user.status$)).toBe('loading');

  first.resolve('Ada');
  await flushPromises();

  expect(store.get(user.data$)).toBe('Ada');
  expect(store.get(user.status$)).toBe('success');

  store.set(requestId$, 1);

  expect(store.get(user.data$)).toBe('Ada');
  expect(store.get(user.status$)).toBe('loading');

  second.resolve('Grace');
  await flushPromises();

  expect(store.get(user.data$)).toBe('Grace');
  expect(statuses).toEqual(['loading', 'success', 'loading', 'success']);

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
    get(user.status$);
  });

  store.set(requestId$, 1);
  first.resolve('stale');
  await flushPromises();

  expect(store.get(user.status$)).toBe('loading');
  expect(store.get(user.data$)).toBeUndefined();

  second.resolve('current');
  await flushPromises();

  expect(store.get(user.status$)).toBe('success');
  expect(store.get(user.data$)).toBe('current');
});

it('resource retains data when a refresh fails', async () => {
  const requestId$ = state(0);
  const first = deferred<string>();
  const second = deferred<string>();
  const source$ = computed((get) => (get(requestId$) === 0 ? first.promise : second.promise));
  const user = resource(source$);
  const store = createStore();

  store.watch((get) => {
    get(user.status$);
  });

  first.resolve('Ada');
  await flushPromises();
  store.set(requestId$, 1);

  const error = new Error('Request failed');
  second.reject(error);
  await flushPromises();

  expect(store.get(user.status$)).toBe('error');
  expect(store.get(user.data$)).toBe('Ada');
  expect(store.get(user.error$)).toBe(error);
});
