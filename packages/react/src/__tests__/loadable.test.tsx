// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';
import { render, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computed, createStore, state } from 'ccstate';
import type { Computed, State } from 'ccstate';
import { StrictMode, useEffect } from 'react';
import { StoreProvider, useSet, useLoadable } from '..';
import { delay } from 'signal-timers';
import { useLastLoadable } from '../useLoadable';

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

it('convert promise to loadable', async () => {
  const base = state(Promise.resolve('foo'));
  const App = () => {
    const ret = useLoadable(base);
    if (ret.state === 'loading' || ret.state === 'hasError') {
      return <div>loading</div>;
    }
    return <div>{ret.data}</div>;
  };
  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

  expect(screen.getByText('loading')).toBeTruthy();
  expect(await screen.findByText('foo')).toBeTruthy();
});

it('reset promise atom will reset loadable', async () => {
  const base = state(Promise.resolve('foo'));
  const App = () => {
    const ret = useLoadable(base);
    if (ret.state === 'loading' || ret.state === 'hasError') {
      return <div>loading</div>;
    }
    return <div>{ret.data}</div>;
  };
  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

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
    const ret = useLoadable(base);
    if (ret.state === 'loading' || ret.state === 'hasError') {
      return <div>loading</div>;
    }
    return <div>{ret.data}</div>;
  };
  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

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
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <LoadableComponent asyncAtom={asyncAtom} />
      </StoreProvider>
    </StrictMode>,
  );

  await screen.findByText('Loading...');
  resolve(5);
  await screen.findByText('Data: 5');
});

it('loadable turns errors into values', async () => {
  const deferred = makeDefered<number>();

  const asyncAtom = state(deferred.promise);

  const store = createStore();
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <LoadableComponent asyncAtom={asyncAtom} />
      </StoreProvider>
    </StrictMode>,
  );

  await screen.findByText('Loading...');
  deferred.reject(new Error('An error occurred'));
  await screen.findByText('Error: An error occurred');
});

it('loadable turns primitive throws into values', async () => {
  const deferred = makeDefered<number>();

  const asyncAtom = state(deferred.promise);

  const store = createStore();
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <LoadableComponent asyncAtom={asyncAtom} />
      </StoreProvider>
    </StrictMode>,
  );

  await screen.findByText('Loading...');
  deferred.reject('An error occurred');
  await screen.findByText('An error occurred');
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
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <Refresh />
        <LoadableComponent asyncAtom={asyncAtom} />
      </StoreProvider>
    </StrictMode>,
  );

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
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <Refresh />
        <LoadableComponent asyncAtom={asyncAtom} />
      </StoreProvider>
    </StrictMode>,
  );

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
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <Trigger />
        <LoadableComponent asyncAtom={asyncAtom} />
      </StoreProvider>
    </StrictMode>,
  );

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
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <LoadableComponent asyncAtom={asyncAtom} />
      </StoreProvider>
    </StrictMode>,
  );

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
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <LoadableComponent asyncAtom={derivedAtom} />
      </StoreProvider>
    </StrictMode>,
  );

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
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <LoadableComponent asyncAtom={syncAtom} />
      </StoreProvider>
    </StrictMode>,
  );

  await screen.findByText('Error: thrown in syncAtom');
});

interface LoadableComponentProps {
  asyncAtom: State<Promise<number | string>> | Computed<Promise<number | string>>;
  effectCallback?: (loadableValue: unknown) => void;
}

const LoadableComponent = ({ asyncAtom, effectCallback }: LoadableComponentProps) => {
  const value = useLoadable(asyncAtom);

  useEffect(() => {
    if (effectCallback) {
      effectCallback(value);
    }
  }, [value, effectCallback]);

  if (value.state === 'loading') {
    return <>Loading...</>;
  }

  if (value.state === 'hasError') {
    return <>{String(value.error)}</>;
  }

  // this is to ensure correct typing
  const data: number | string = value.data;

  return <>Data: {data}</>;
};

it('use lastLoadable should not update when new promise pending', async () => {
  const async$ = state(Promise.resolve(1));

  const store = createStore();
  function App() {
    const number = useLastLoadable(async$);
    if (number.state !== 'hasData') {
      return <div>loading</div>;
    }
    return <div>num{number.data}</div>;
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
  expect(screen.getByText('num1')).toBeInTheDocument(); // keep num1 instead 'Loading...'
  defered.resolve(2);
  await delay(0);
  expect(screen.getByText('num2')).toBeInTheDocument();
});

it('use lastLoadable should keep error', async () => {
  const async$ = state(Promise.reject(new Error('error')));

  const store = createStore();
  function App() {
    const number = useLastLoadable(async$);
    if (number.state === 'loading') {
      return <div>loading</div>;
    }
    if (number.state === 'hasError') {
      return <div>{String(number.error)}</div>;
    }

    return <div>num{number.data}</div>;
  }

  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
  );

  expect(await screen.findByText('Error: error')).toBeInTheDocument();

  const defered = makeDefered();
  store.set(async$, defered.promise);

  await delay(0);
  expect(screen.getByText('Error: error')).toBeInTheDocument(); // keep num1 instead 'Loading...'
  defered.resolve(2);
  await delay(0);
  expect(screen.getByText('num2')).toBeInTheDocument();
});

it('use lastLoadable will will not use old promise value if new promise is made', async () => {
  const oldDefered = makeDefered<number>();
  const async$ = state(oldDefered.promise);

  const store = createStore();
  function App() {
    const number = useLastLoadable(async$);
    if (number.state !== 'hasData') {
      return <div>loading</div>;
    }

    return <div>num{number.data}</div>;
  }

  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
  );

  expect(await screen.findByText('loading')).toBeInTheDocument();

  const newDefered = makeDefered<number>();
  store.set(async$, newDefered.promise);
  oldDefered.resolve(1);

  await delay(0);
  expect(screen.getByText('loading')).toBeInTheDocument(); // keep num1 instead 'Loading...'
  newDefered.resolve(2);
  await delay(0);
  expect(screen.getByText('num2')).toBeInTheDocument();
});

it('use lastLoadable will will not use old promise error if new promise is made', async () => {
  const oldDefered = makeDefered<number>();
  const async$ = state(oldDefered.promise);

  const store = createStore();
  function App() {
    const number = useLastLoadable(async$);
    if (number.state !== 'hasData') {
      return <div>loading</div>;
    }

    return <div>num{number.data}</div>;
  }

  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
  );

  expect(await screen.findByText('loading')).toBeInTheDocument();

  const newDefered = makeDefered<number>();
  store.set(async$, newDefered.promise);
  oldDefered.reject(new Error('error'));

  await delay(0);
  expect(screen.getByText('loading')).toBeInTheDocument(); // keep num1 instead 'Loading...'
  newDefered.resolve(2);
  await delay(0);
  expect(screen.getByText('num2')).toBeInTheDocument();
});

it('useLoadable accept sync computed', async () => {
  const base$ = state(0);
  function App() {
    const base = useLoadable(base$);

    return <div>{base.state}</div>;
  }

  render(<App />);

  expect(await screen.findByText('hasData')).toBeInTheDocument();
});

describe('works with AbortError', () => {
  let abortController: AbortController;
  let promise: Promise<void>;

  beforeEach(() => {
    abortController = new AbortController();
  });

  afterEach(async () => {
    abortController.abort();

    try {
      await promise;
    } catch {}
  });

  it('should not throw abortError', () => {
    const store = createStore();
    const signal = abortController.signal;

    promise = new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(signal.reason as Error);
      });
    });

    const reload$ = state(0);
    const promise$ = computed(async (get) => {
      get(reload$);
      await promise;
    });

    function App() {
      useLoadable(promise$);

      return <div>Test</div>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );

    expect(screen.getByText('Test')).toBeInTheDocument();

    store.set(reload$, (x) => x + 1);
    store.set(reload$, (x) => x + 1);
  });
});
