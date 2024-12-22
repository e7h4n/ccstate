// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, expect, it } from 'vitest';
import { createStore, state } from 'ccstate';
import { provideStore } from '../provider';
import { useResolved, useLastResolved } from '../useResolved';
import { delay } from 'signal-timers';

afterEach(() => {
  cleanup();
});

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

it('convert promise to awaited value', async () => {
  const base = state(Promise.resolve('foo'));

  const Component = {
    setup() {
      const ret = useResolved(base);
      return { ret };
    },
    template: `<div>{{ ret }}</div>`,
  };

  const store = createStore();
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(await screen.findByText('foo')).toBeInTheDocument();
});

it('loading state', async () => {
  const deferred = makeDefered<string>();
  const base = state(deferred.promise);

  const Component = {
    setup() {
      const ret = useResolved(base);
      return { ret };
    },
    template: `<div>{{ ret ?? 'loading' }}</div>`,
  };

  const store = createStore();
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(await screen.findByText('loading')).toBeInTheDocument();
  deferred.resolve('foo');
  expect(await screen.findByText('foo')).toBeInTheDocument();
});

it('use lastResolved should not update when new promise pending', async () => {
  const async$ = state(Promise.resolve(1));

  const Component = {
    setup() {
      const number = useLastResolved(async$);
      return { number };
    },
    template: `<div>num{{ number }}</div>`,
  };

  const store = createStore();
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(await screen.findByText('num1')).toBeInTheDocument();

  const defered = makeDefered();
  store.set(async$, defered.promise);

  await delay(0);
  expect(screen.getByText('num1')).toBeInTheDocument();
  defered.resolve(2);
  await delay(0);
  expect(screen.getByText('num2')).toBeInTheDocument();
});
