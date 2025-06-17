import { render, cleanup, screen } from '@testing-library/svelte';
import { afterEach, expect, it } from 'vitest';
import { createStore, state } from 'ccstate';
import '@testing-library/jest-dom/vitest';
import Loadable from './Loadable.svelte';
import LastLoadable from './LastLoadable.svelte';
import { StoreKey } from '../provider';
import Resolved from './Resolved.svelte';
import LastResolved from './LastResolved.svelte';

function makeDefered<T>(): {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  promise: Promise<T>;
} {
  const deferred: {
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
    promise: Promise<T>;
  } = {} as {
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
    promise: Promise<T>;
  };

  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  return deferred;
}

afterEach(() => {
  cleanup();
});

it('simple loadable', async () => {
  const store = createStore();
  const promise$ = state(Promise.resolve('bar'));
  render(Loadable, {
    props: {
      promise$: () => promise$,
    },
    context: new Map([[StoreKey, store]]),
  });

  expect(screen.getByText('Loading')).toBeInTheDocument();
  await Promise.resolve();
  expect(screen.getByText('Result: bar')).toBeInTheDocument();
});

it('error loadable', async () => {
  const store = createStore();
  const promise$ = state(Promise.reject(new Error('INTEST')));
  render(Loadable, {
    props: {
      promise$: () => promise$,
    },
    context: new Map([[StoreKey, store]]),
  });

  expect(screen.getByText('Loading')).toBeInTheDocument();
  await Promise.resolve();
  expect(screen.getByText('Error: INTEST')).toBeInTheDocument();
});

it('switchMap', async () => {
  const store = createStore();
  const first = makeDefered<string>();

  const promise$ = state(first.promise, {
    debugLabel: 'promise$',
  });
  render(Loadable, {
    props: {
      promise$: () => promise$,
    },
    context: new Map([[StoreKey, store]]),
  });

  expect(screen.getByText('Loading')).toBeInTheDocument();

  store.set(promise$, Promise.resolve('second'));
  expect(await screen.findByText('Result: second')).toBeInTheDocument();

  first.resolve('first');
  await expect(screen.findByText('Result: first')).rejects.toThrow();
});

it('switchMap and throw', async () => {
  const store = createStore();
  const first = makeDefered<string>();

  const promise$ = state(first.promise, {
    debugLabel: 'promise$',
  });
  render(Loadable, {
    props: {
      promise$: () => promise$,
    },
    context: new Map([[StoreKey, store]]),
  });

  expect(screen.getByText('Loading')).toBeInTheDocument();

  store.set(promise$, Promise.resolve('second'));
  expect(await screen.findByText('Result: second')).toBeInTheDocument();

  first.reject(new Error('INTEST'));
  await expect(screen.findByText('Result: first')).rejects.toThrow();
});

it('update should change state to loading', async () => {
  const store = createStore();

  const promise$ = state(Promise.resolve('first'), {
    debugLabel: 'promise$',
  });
  render(Loadable, {
    props: {
      promise$: () => promise$,
    },
    context: new Map([[StoreKey, store]]),
  });

  expect(await screen.findByText('Result: first')).toBeInTheDocument();

  const deferred = makeDefered<string>();
  store.set(promise$, deferred.promise);
  expect(await screen.findByText('Loading')).toBeInTheDocument();
  deferred.resolve('second');
  expect(await screen.findByText('Result: second')).toBeInTheDocument();
});

it('use last loadable will keep latest resolved value', async () => {
  const store = createStore();

  const promise$ = state(Promise.resolve('first'), {
    debugLabel: 'promise$',
  });
  render(LastLoadable, {
    props: {
      promise$: () => promise$,
    },
    context: new Map([[StoreKey, store]]),
  });

  expect(await screen.findByText('Result: first')).toBeInTheDocument();

  const deferred = makeDefered<string>();
  store.set(promise$, deferred.promise);
  await expect(screen.findByText('Loading')).rejects.toThrow();
  deferred.resolve('second');
  expect(await screen.findByText('Result: second')).toBeInTheDocument();
});

it('simple resolved', async () => {
  const promise$ = state(Promise.resolve('bar'));
  render(Resolved, {
    props: {
      promise$: () => promise$,
    },
    context: new Map([[StoreKey, createStore()]]),
  });

  expect(screen.getByText('Loading')).toBeInTheDocument();
  await Promise.resolve();
  expect(screen.getByText('Result: bar')).toBeInTheDocument();
});

it('simple last resolved', async () => {
  const store = createStore();
  const promise$ = state(Promise.resolve('bar'));
  render(LastResolved, {
    props: {
      promise$: () => promise$,
    },
    context: new Map([[StoreKey, store]]),
  });

  expect(screen.getByText('Loading')).toBeInTheDocument();
  await Promise.resolve();
  expect(screen.getByText('Result: bar')).toBeInTheDocument();

  const deferred = makeDefered<string>();
  store.set(promise$, deferred.promise);
  await expect(screen.findByText('Loading')).rejects.toThrow();
  deferred.resolve('second');
  expect(await screen.findByText('Result: second')).toBeInTheDocument();
});
