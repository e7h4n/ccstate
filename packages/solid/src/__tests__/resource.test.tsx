import '@testing-library/jest-dom/vitest';
import { render, cleanup, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { computed, createStore, state } from 'ccstate';
import type { Computed, State } from 'ccstate';
import { StoreProvider, useSet, useResource } from '..';
import { delay } from 'signal-timers';
import { onMount } from 'solid-js';
import { Show } from 'solid-js/web';

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

it('convert promise to resource', async () => {
  const base = state(Promise.resolve('foo'));
  const App = () => {
    const data = useResource(base);
    return <div>{!data.loading && !data.error ? data() : 'loading'}</div>;
  };
  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <App />
    </StoreProvider>
  ));

  expect(screen.getByText('loading')).toBeTruthy();
  expect(await screen.findByText('foo')).toBeTruthy();
});

it('reset promise atom will reset loadable', async () => {
  const base = state(Promise.resolve('foo'));
  const App = () => {
    const data = useResource(base);
    return <div>{!data.loading && !data.error ? data() : 'loading'}</div>;
  };
  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <App />
    </StoreProvider>
  ));

  expect(await screen.findByText('foo')).toBeTruthy();

  const [, promise] = (() => {
    let ret;
    const promise = new Promise((r) => (ret = r));
    return [ret, promise];
  })();

  store.set(base, promise);
  expect(await screen.findByText('loading')).toBeTruthy();
});

it('switchMap', async () => {
  const base = state(Promise.resolve('foo'));
  const App = () => {
    const data = useResource(base);
    return <div>{!data.loading && !data.error ? data() : 'loading'}</div>;
  };
  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <App />
    </StoreProvider>
  ));

  expect(await screen.findByText('foo')).toBeTruthy();

  const defered = makeDefered();

  store.set(base, defered.promise);
  expect(await screen.findByText('loading')).toBeTruthy();

  store.set(base, Promise.resolve('bar'));
  expect(await screen.findByText('bar')).toBeTruthy();

  defered.resolve('baz');
  await delay(0);
  expect(() => screen.getByText('baz')).toThrow();
});

it('loadable turns suspense into values', async () => {
  let resolve: (x: number) => void = () => void 0;
  const asyncAtom = computed(() => {
    return new Promise<number>((r) => (resolve = r));
  });

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <LoadableComponent asyncAtom={asyncAtom} />
    </StoreProvider>
  ));

  await screen.findByText('Loading...');
  resolve(5);
  await screen.findByText('Data: 5');
});

it('loadable turns errors into values', async () => {
  const deferred = makeDefered<number>();

  const asyncAtom = state(deferred.promise);

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <LoadableComponent asyncAtom={asyncAtom} />
    </StoreProvider>
  ));

  await screen.findByText('Loading...');
  deferred.reject(new Error('An error occurred'));
  await screen.findByText('Error: An error occurred');
});

it('loadable turns primitive throws into values', async () => {
  const deferred = makeDefered<number>();

  const asyncAtom = state(deferred.promise);

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <LoadableComponent asyncAtom={asyncAtom} />
    </StoreProvider>
  ));

  await screen.findByText('Loading...');
  deferred.reject('An error occurred');
  await screen.findByText('Error: An error occurred');
});

it('loadable goes back to loading after re-fetch', async () => {
  let resolve: (x: number) => void = () => void 0;
  const refreshAtom = state(0);
  const asyncAtom = computed((get) => {
    get(refreshAtom);
    return new Promise<number>((r) => (resolve = r));
  });

  const Refresh = () => {
    const setRefresh = useSet(refreshAtom);
    return (
      <>
        <button
          onClick={() => {
            setRefresh((value) => {
              return value + 1;
            });
          }}
        >
          refresh
        </button>
      </>
    );
  };

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <Refresh />
      <LoadableComponent asyncAtom={asyncAtom} />
    </StoreProvider>
  ));

  screen.getByText('Loading...');
  resolve(5);
  await screen.findByText('Data: 5');
  await userEvent.click(screen.getByText('refresh'));
  await screen.findByText('Loading...');
  resolve(6);
  await screen.findByText('Data: 6');
});

it('loadable can recover from error', async () => {
  let resolve: (x: number) => void = () => void 0;
  let reject: (error: unknown) => void = () => void 0;
  const refreshAtom = state(0);
  const asyncAtom = computed((get) => {
    get(refreshAtom);
    return new Promise<number>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  });

  const Refresh = () => {
    const setRefresh = useSet(refreshAtom);
    return (
      <>
        <button
          onClick={() => {
            setRefresh((value) => value + 1);
          }}
        >
          refresh
        </button>
      </>
    );
  };

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <Refresh />
      <LoadableComponent asyncAtom={asyncAtom} />
    </StoreProvider>
  ));

  screen.getByText('Loading...');
  reject(new Error('An error occurred'));
  await screen.findByText('Error: An error occurred');
  await userEvent.click(screen.getByText('refresh'));
  await screen.findByText('Loading...');
  resolve(6);
  await screen.findByText('Data: 6');
});

it('loadable of a derived async atom does not trigger infinite loop (#1114)', async () => {
  let resolve: (x: number) => void = () => void 0;
  const baseAtom = state(0);
  const asyncAtom = computed((get) => {
    get(baseAtom);
    return new Promise<number>((r) => (resolve = r));
  });

  const Trigger = () => {
    const trigger = useSet(baseAtom);
    return (
      <>
        <button
          onClick={() => {
            trigger((value) => value);
          }}
        >
          trigger
        </button>
      </>
    );
  };

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <Trigger />
      <LoadableComponent asyncAtom={asyncAtom} />
    </StoreProvider>
  ));

  screen.getByText('Loading...');
  await userEvent.click(screen.getByText('trigger'));
  resolve(5);
  await screen.findByText('Data: 5');
});

it('loadable of a derived async atom with error does not trigger infinite loop (#1330)', async () => {
  const baseAtom = computed(() => {
    throw new Error('thrown in baseAtom');
  });
  // eslint-disable-next-line @typescript-eslint/require-await
  const asyncAtom = computed(async (get) => {
    get(baseAtom);
    return '';
  });

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <LoadableComponent asyncAtom={asyncAtom} />
    </StoreProvider>
  ));

  screen.getByText('Loading...');
  await screen.findByText('Error: thrown in baseAtom');
});

it('does not repeatedly attempt to get the value of an unresolved promise atom wrapped in a loadable (#1481)', async () => {
  const baseAtom = state(new Promise<number>(() => void 0));

  let callsToGetBaseAtom = 0;
  const derivedAtom = computed((get) => {
    callsToGetBaseAtom++;
    return get(baseAtom);
  });

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <LoadableComponent asyncAtom={derivedAtom} />
    </StoreProvider>
  ));

  // we need a small delay to reproduce the issue
  await new Promise((r) => setTimeout(r, 10));
  // depending on provider-less mode or versioned-write mode, there will be
  // either 2 or 3 calls.
  expect(callsToGetBaseAtom).toBeLessThanOrEqual(3);
});

it('should handle async error', async () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  const syncAtom = computed(async () => {
    throw new Error('thrown in syncAtom');
  });

  const store = createStore();
  render(() => (
    <StoreProvider value={store}>
      <LoadableComponent asyncAtom={syncAtom} />
    </StoreProvider>
  ));

  await screen.findByText('Error: thrown in syncAtom');
});

interface LoadableComponentProps {
  asyncAtom: State<Promise<number | string>> | Computed<Promise<number | string>>;
  effectCallback?: (loadableValue: unknown) => void;
}

const LoadableComponent = ({ asyncAtom, effectCallback }: LoadableComponentProps) => {
  const data = useResource(asyncAtom);

  if (effectCallback) {
    onMount(() => {
      effectCallback(data);
    });
  }

  return <>{data.loading ? 'Loading...' : data.error ? String(data.error) : `Data: ${String(data())}`}</>;
};

it('use lastLoadable should not update when new promise pending', async () => {
  const async$ = state(Promise.resolve(1));

  const store = createStore();
  function App() {
    const data = useResource(async$);

    return (
      <Show
        when={data.latest}
        fallback={
          <Show when={!data.loading} fallback={<div>loading</div>}>
            <div>num{data()}</div>
          </Show>
        }
      >
        <div>num{data.latest}</div>
      </Show>
    );
  }

  render(() => (
    <StoreProvider value={store}>
      <App />
    </StoreProvider>
  ));

  expect(await screen.findByText('num1')).toBeInTheDocument();

  const defered = makeDefered();
  store.set(async$, defered.promise);

  await delay(0);
  expect(screen.getByText('num1')).toBeInTheDocument(); // keep num1 instead 'Loading...'
  defered.resolve(2);
  await delay(0);
  expect(screen.getByText('num2')).toBeInTheDocument();
});
