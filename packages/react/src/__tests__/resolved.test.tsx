// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { state, createStore } from 'ccstate';
import { StoreProvider } from '../provider';
import { StrictMode } from 'react';
import { useLastResolved, useResolved } from '../useResolved';
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
  const App = () => {
    const ret = useResolved(base);
    return <div>{ret}</div>;
  };
  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

  expect(await screen.findByText('foo')).toBeTruthy();
});

it('loading state', async () => {
  const deferred = makeDefered<string>();
  const base = state(deferred.promise);
  const App = () => {
    const ret = useResolved(base);
    return <div>{String(ret ?? 'loading')}</div>;
  };

  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

  expect(await screen.findByText('loading')).toBeTruthy();
  deferred.resolve('foo');
  expect(await screen.findByText('foo')).toBeTruthy();
});

it('use lastLoadable should not update when new promise pending', async () => {
  const async$ = state(Promise.resolve(1));

  const store = createStore();
  function App() {
    const number = useLastResolved(async$);
    return <div>num{number}</div>;
  }

  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
  );

  expect(await screen.findByText('num1')).toBeInTheDocument();

  const defered = makeDefered();
  store.set(async$, defered.promise);

  await delay(0);
  expect(screen.getByText('num1')).toBeInTheDocument();
  defered.resolve(2);
  await delay(0);
  expect(screen.getByText('num2')).toBeInTheDocument();
});

it('useResolved accept sync computed', async () => {
  const base$ = state(0);
  function App() {
    const base = useResolved(base$);

    return <div>{base}</div>;
  }

  render(<App />);

  expect(await screen.findByText('0')).toBeInTheDocument();
});
