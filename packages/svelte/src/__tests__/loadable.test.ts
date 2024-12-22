import { render, cleanup, screen } from '@testing-library/svelte';
import { afterEach, expect, it } from 'vitest';
import { createDebugStore, state } from 'ccstate';
import '@testing-library/jest-dom/vitest';
import Loadable from './Loadable.svelte';
import { delay } from 'signal-timers';
import { StoreKey } from '../provider';

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
  const promise$ = state(Promise.resolve('bar'));
  render(Loadable, {
    props: {
      promise$,
    },
  });

  expect(screen.getByText('Loading')).toBeInTheDocument();
  await Promise.resolve();
  expect(screen.getByText('Result: bar')).toBeInTheDocument();
});

it('error loadable', async () => {
  const promise$ = state(Promise.reject(new Error('INTEST')));
  render(Loadable, {
    props: {
      promise$,
    },
  });

  expect(screen.getByText('Loading')).toBeInTheDocument();
  await Promise.resolve();
  expect(screen.getByText('Error: INTEST')).toBeInTheDocument();
});

it('switchMap', async () => {
  const store = createDebugStore([/./]);
  const first = makeDefered<string>();

  const promise$ = state(first.promise, {
    debugLabel: 'promise$',
  });
  render(Loadable, {
    props: {
      promise$,
    },
    context: new Map([[StoreKey, store]]),
  });

  expect(screen.getByText('Loading')).toBeInTheDocument();

  console.log(store.getSubscribeGraph());
  store.set(promise$, Promise.resolve('second'));
  await delay(0);
  expect(screen.getByText('Result: second')).toBeInTheDocument();
});
