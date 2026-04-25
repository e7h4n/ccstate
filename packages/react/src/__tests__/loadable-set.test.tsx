// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';
import { render, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { delay } from 'signal-timers';
import { command, createStore, state } from 'ccstate';
import { StrictMode } from 'react';
import { StoreProvider } from '..';
import { useLoadableSet } from '../experimental';

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

it('convert a async command to loadable', async () => {
  const deferred = makeDefered<string>();
  const setFoo$ = command(async () => {
    return await deferred.promise;
  });
  const App = () => {
    const [ret, setFoo] = useLoadableSet(setFoo$);
    if (ret.state === 'loading') {
      return <div>loading</div>;
    } else if (ret.state === 'hasData') {
      return <div>{ret.data}</div>;
    }
    return (
      <button
        onClick={() => {
          void setFoo();
        }}
      >
        Click
      </button>
    );
  };
  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

  expect(screen.getByText('Click')).toBeTruthy();

  const btn = await screen.findByText('Click');
  await userEvent.click(btn);

  expect(await screen.findByText('loading')).toBeTruthy();

  deferred.resolve('foo');
  expect(await screen.findByText('foo')).toBeTruthy();
});

it('async command reject turns into hasError', async () => {
  const deferred = makeDefered<string>();
  const setFoo$ = command(async () => {
    return await deferred.promise;
  });
  const App = () => {
    const [ret, setFoo] = useLoadableSet(setFoo$);
    if (ret.state === 'loading') {
      return <div>loading</div>;
    } else if (ret.state === 'hasError') {
      return <div>{String(ret.error)}</div>;
    }
    return (
      <button
        onClick={() => {
          void setFoo();
        }}
      >
        Click
      </button>
    );
  };
  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

  await userEvent.click(await screen.findByText('Click'));
  expect(await screen.findByText('loading')).toBeTruthy();

  deferred.reject(new Error('oops'));
  expect(await screen.findByText('Error: oops')).toBeTruthy();
});

it('sync command resolves immediately to hasData', async () => {
  const setFoo$ = command(() => 42);
  const App = () => {
    const [ret, setFoo] = useLoadableSet(setFoo$);
    if (ret.state === 'hasData') {
      return <div>{String(ret.data)}</div>;
    }
    return (
      <button
        onClick={() => {
          void setFoo();
        }}
      >
        Click
      </button>
    );
  };
  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

  await userEvent.click(await screen.findByText('Click'));
  expect(await screen.findByText('42')).toBeTruthy();
});

it('state atom setter transitions to hasData', async () => {
  const count$ = state(0);
  const App = () => {
    const [ret, setCount] = useLoadableSet(count$);
    if (ret.state === 'hasData') {
      return <div>done</div>;
    }
    return (
      <button
        onClick={() => {
          setCount(1);
        }}
      >
        Click
      </button>
    );
  };
  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

  await userEvent.click(await screen.findByText('Click'));
  expect(await screen.findByText('done')).toBeTruthy();
});

it('state atom setter writes to a new atom when the signal argument changes', async () => {
  const store = createStore();
  const atomA = state('A0');
  const atomB = state('B0');

  function App({ atom }: { atom: typeof atomA }) {
    const [, setValue] = useLoadableSet(atom);
    return (
      <button
        onClick={() => {
          setValue('updated');
        }}
      >
        update
      </button>
    );
  }

  const { rerender } = render(
    <StoreProvider value={store}>
      <App atom={atomA} />
    </StoreProvider>,
  );

  rerender(
    <StoreProvider value={store}>
      <App atom={atomB} />
    </StoreProvider>,
  );

  await userEvent.click(await screen.findByText('update'));

  expect(store.get(atomA)).toBe('A0');
  expect(store.get(atomB)).toBe('updated');
});

it('command setter invokes a new command when the signal argument changes', async () => {
  const store = createStore();
  const atomA = state('A0');
  const atomB = state('B0');
  const commandA = command(({ set }, value: string) => {
    set(atomA, value);
  });
  const commandB = command(({ set }, value: string) => {
    set(atomB, value);
  });

  function App({ cmd }: { cmd: typeof commandA }) {
    const [, setValue] = useLoadableSet(cmd);
    return (
      <button
        onClick={() => {
          setValue('updated');
        }}
      >
        update
      </button>
    );
  }

  const { rerender } = render(
    <StoreProvider value={store}>
      <App cmd={commandA} />
    </StoreProvider>,
  );

  rerender(
    <StoreProvider value={store}>
      <App cmd={commandB} />
    </StoreProvider>,
  );

  await userEvent.click(await screen.findByText('update'));

  expect(store.get(atomA)).toBe('A0');
  expect(store.get(atomB)).toBe('updated');
});

it('second invoke cancels first pending promise', async () => {
  const deferred1 = makeDefered<string>();
  const deferred2 = makeDefered<string>();
  let counter = 0;

  const setFoo$ = command(async () => {
    const deferred = counter === 0 ? deferred1 : deferred2;
    counter++;
    return await deferred.promise;
  });

  const App = () => {
    const [ret, setFoo] = useLoadableSet(setFoo$);
    if (ret.state === 'hasData') {
      return <div>data:{String(ret.data)}</div>;
    }
    return (
      <button
        onClick={() => {
          void setFoo();
        }}
      >
        Click
      </button>
    );
  };

  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

  await userEvent.click(await screen.findByText('Click'));
  // button still visible during loading — second invoke aborts the first
  await userEvent.click(await screen.findByText('Click'));

  deferred2.resolve('second');
  expect(await screen.findByText('data:second')).toBeTruthy();

  deferred1.resolve('first');
  await delay(0);
  expect(screen.queryByText('data:first')).toBeNull();
});

it('invoke return value is identical to command return value', async () => {
  const deferred = makeDefered<string>();
  const setFoo$ = command(async () => {
    return await deferred.promise;
  });

  let invokeResult: Promise<string> | undefined;

  const App = () => {
    const [, setFoo] = useLoadableSet(setFoo$);
    return (
      <button
        onClick={() => {
          invokeResult = setFoo();
        }}
      >
        Click
      </button>
    );
  };

  const store = createStore();
  render(
    <StoreProvider value={store}>
      <App />
    </StoreProvider>,
    { wrapper: StrictMode },
  );

  await userEvent.click(await screen.findByText('Click'));
  deferred.resolve('foo');
  expect(await invokeResult).toBe('foo');
});
