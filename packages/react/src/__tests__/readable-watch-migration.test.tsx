import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Profiler, StrictMode } from 'react';
import { computed, createStore, state } from 'ccstate';
import type { State } from 'ccstate';
import { StoreProvider, useGet, useLoadable } from '..';
import { useLastLoadable } from '../useLoadable';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

it('does not miss a value written between render and subscription in either component', () => {
  const store = createStore();
  const value = state(0);
  const originalWatch = store.watch;
  let changed = false;
  vi.spyOn(store, 'watch').mockImplementation((target, listener) => {
    if (target === value && !changed) {
      changed = true;
      store.set(value, 1);
    }
    return originalWatch(target, listener);
  });
  function Counter({ name }: { name: string }) {
    return (
      <div>
        {name}: {useGet(value)}
      </div>
    );
  }
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <Counter name="A" />
        <Counter name="B" />
      </StoreProvider>
    </StrictMode>,
  );
  expect(screen.getByText('A: 1')).toBeInTheDocument();
  expect(screen.getByText('B: 1')).toBeInTheDocument();
});

it('turns synchronous computed read errors into loadable errors and recovers', () => {
  const store = createStore();
  const broken = state(true);
  const value = computed((get) => {
    if (get(broken)) throw new Error('sync failure');
    return 42;
  });
  function App() {
    const result = useLoadable(value);
    return <div>{result.state === 'hasData' ? `data: ${String(result.data)}` : result.state}</div>;
  }
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <App />
      </StoreProvider>
    </StrictMode>,
  );
  expect(screen.getByText('hasError')).toBeInTheDocument();
  act(() => {
    store.set(broken, false);
  });
  expect(screen.getByText('data: 42')).toBeInTheDocument();
  act(() => {
    store.set(broken, true);
  });
  expect(screen.getByText('hasError')).toBeInTheDocument();
});

it('ignores a rejection from the old store after switching providers', async () => {
  const first = deferred<number>();
  const second = deferred<number>();
  const value = state(first.promise);
  const firstStore = createStore();
  const secondStore = createStore();
  secondStore.set(value, second.promise);
  const onRender = vi.fn();
  function App() {
    const result = useLoadable(value);
    return <div>{result.state === 'hasData' ? `data: ${String(result.data)}` : result.state}</div>;
  }
  function Tree({ store }: { store: typeof firstStore }) {
    return (
      <StrictMode>
        <StoreProvider value={store}>
          <Profiler id="result" onRender={onRender}>
            <App />
          </Profiler>
        </StoreProvider>
      </StrictMode>
    );
  }
  const { rerender } = render(<Tree store={firstStore} />);
  expect(screen.getByText('loading')).toBeInTheDocument();
  rerender(<Tree store={secondStore} />);
  await act(async () => {
    second.resolve(2);
    await second.promise;
  });
  expect(screen.getByText('data: 2')).toBeInTheDocument();
  onRender.mockClear();
  await act(async () => {
    first.reject(new Error('obsolete'));
    await first.promise.catch(() => undefined);
  });
  expect(screen.getByText('data: 2')).toBeInTheDocument();
  expect(onRender).not.toHaveBeenCalled();
});

it('does not process a late resolution after unmounting a last-loadable subscription', async () => {
  const store = createStore();
  const pending = deferred<number>();
  const value = state<number | Promise<number>>(1);
  const equalityFn = vi.fn((first: number, second: number) => Object.is(first, second));
  function App() {
    const result = useLastLoadable(value, { equalityFn });
    return <div>{result.state === 'hasData' ? `data: ${String(result.data)}` : result.state}</div>;
  }
  const { unmount } = render(
    <StrictMode>
      <StoreProvider value={store}>
        <App />
      </StoreProvider>
    </StrictMode>,
  );
  expect(screen.getByText('data: 1')).toBeInTheDocument();
  act(() => {
    store.set(value, pending.promise);
  });
  expect(screen.getByText('data: 1')).toBeInTheDocument();
  unmount();
  equalityFn.mockClear();
  await act(async () => {
    pending.resolve(2);
    await pending.promise;
  });
  expect(equalityFn).not.toHaveBeenCalled();
});

it('only accepts the current subscription when two targets share a Promise in StrictMode', async () => {
  const store = createStore();
  const pending = deferred<number>();
  const first = state(pending.promise);
  const second = state(pending.promise);
  const equalityFn = vi.fn((a: number, b: number) => Object.is(a, b));
  const onRender = vi.fn();
  function App({ target }: { target: State<Promise<number>> }) {
    const result = useLastLoadable(target, { equalityFn });
    return <div>{result.state === 'hasData' ? `data: ${String(result.data)}` : result.state}</div>;
  }
  function Tree({ target }: { target: State<Promise<number>> }) {
    return (
      <StrictMode>
        <StoreProvider value={store}>
          <Profiler id="shared" onRender={onRender}>
            <App target={target} />
          </Profiler>
        </StoreProvider>
      </StrictMode>
    );
  }
  const { rerender } = render(<Tree target={first} />);
  rerender(<Tree target={second} />);
  onRender.mockClear();
  equalityFn.mockClear();
  await act(async () => {
    pending.resolve(7);
    await pending.promise;
  });
  expect(screen.getByText('data: 7')).toBeInTheDocument();
  expect(onRender).toHaveBeenCalledTimes(1);
  expect(equalityFn).not.toHaveBeenCalled();
});
