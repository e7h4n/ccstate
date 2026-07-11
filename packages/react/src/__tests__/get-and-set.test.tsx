import { render, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createStore, command, state, createDebugStore } from 'ccstate';
import { StoreProvider, useGet, useSet } from '..';
import { Profiler, StrictMode, useState } from 'react';
import '@testing-library/jest-dom/vitest';

describe('react', () => {
  afterEach(() => {
    cleanup();
  });

  it('using ccstate in react', async () => {
    const store = createStore();
    const base = state(0);

    const trace = vi.fn();
    function App() {
      trace();
      const ret = useGet(base);
      return <div>{ret}</div>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    expect(trace).toHaveBeenCalledTimes(1);

    expect(screen.getByText('0')).toBeInTheDocument();
    store.set(base, 1);
    expect(screen.getByText('0')).toBeInTheDocument();
    await Promise.resolve();
    expect(trace).toHaveBeenCalledTimes(2);
    expect(screen.getByText('1')).toBeInTheDocument();
    await Promise.resolve();
    expect(trace).toHaveBeenCalledTimes(2);
  });

  it('computed should re-render', async () => {
    const store = createStore();
    const base = state(0);
    const derived = computed((get) => get(base) * 2);

    const trace = vi.fn();
    function App() {
      const ret = useGet(derived);
      trace();
      return <div>{ret}</div>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    expect(trace).toHaveBeenCalledTimes(1);

    trace.mockClear();
    expect(screen.getByText('0')).toBeInTheDocument();
    store.set(base, 1);
    expect(trace).not.toBeCalled();

    await Promise.resolve();
    expect(trace).toBeCalledTimes(1);
    expect(screen.getByText('2')).toBeInTheDocument();

    trace.mockClear();
    store.set(base, 1);
    await Promise.resolve();
    expect(trace).not.toBeCalled();
  });

  it('useGet skips commits when equalityFn considers a new value equal', async () => {
    const store = createStore();
    const value$ = state({ count: 1 });
    const onRender = vi.fn();

    function App() {
      const value = useGet(value$, {
        equalityFn: (previous, next) => previous.count === next.count,
      });
      return <div>{value.count}</div>;
    }

    render(
      <StoreProvider value={store}>
        <Profiler id="app" onRender={onRender}>
          <App />
        </Profiler>
      </StoreProvider>,
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    onRender.mockClear();

    store.set(value$, { count: 1 });
    await Promise.resolve();
    expect(onRender).not.toHaveBeenCalled();

    store.set(value$, { count: 2 });
    await Promise.resolve();
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('user click counter should increment', async () => {
    const store = createStore();
    const count$ = state(0);
    const onClick$ = command(({ get, set }) => {
      const ret = get(count$);
      set(count$, ret + 1);
    });

    const trace = vi.fn();
    function App() {
      trace();
      const ret = useGet(count$);
      const onClick = useSet(onClick$);

      return <button onClick={onClick}>{ret}</button>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    const button = screen.getByText('0');
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);
    expect(screen.getByText('1')).toBeInTheDocument();
    await user.click(button);
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(trace).toHaveBeenCalledTimes(3);
  });

  it('two atom changes should re-render once', async () => {
    const store = createStore();
    const state1 = state(0);
    const state2 = state(0);
    const trace = vi.fn();
    function App() {
      trace();
      const ret1 = useGet(state1);
      const ret2 = useGet(state2);
      return <div>{ret1 + ret2}</div>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(trace).toHaveBeenCalledTimes(1);

    store.set(state1, 1);
    store.set(state2, 2);
    await Promise.resolve();
    expect(trace).toHaveBeenCalledTimes(2);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('subscribes to a new atom when the useGet atom argument changes', async () => {
    const store = createStore();
    const atomA = state('A0');
    const atomB = state('B0');

    function App({ atom }: { atom: typeof atomA }) {
      const value = useGet(atom);
      return <div>{value}</div>;
    }

    const { rerender } = render(
      <StoreProvider value={store}>
        <App atom={atomA} />
      </StoreProvider>,
    );
    expect(screen.getByText('A0')).toBeInTheDocument();

    rerender(
      <StoreProvider value={store}>
        <App atom={atomB} />
      </StoreProvider>,
    );
    expect(screen.getByText('B0')).toBeInTheDocument();

    store.set(atomB, 'B1');
    await Promise.resolve();

    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('subscribes to a new computed when the useGet atom argument changes', async () => {
    const store = createStore();
    const sourceA = state('A0');
    const sourceB = state('B0');
    const computedA = computed((get) => get(sourceA));
    const computedB = computed((get) => get(sourceB));

    function App({ atom }: { atom: typeof computedA }) {
      const value = useGet(atom);
      return <div>{value}</div>;
    }

    const { rerender } = render(
      <StoreProvider value={store}>
        <App atom={computedA} />
      </StoreProvider>,
    );
    expect(screen.getByText('A0')).toBeInTheDocument();

    rerender(
      <StoreProvider value={store}>
        <App atom={computedB} />
      </StoreProvider>,
    );
    expect(screen.getByText('B0')).toBeInTheDocument();

    store.set(sourceB, 'B1');
    await Promise.resolve();

    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('useSet writes to a new state when the signal argument changes', async () => {
    const store = createStore();
    const atomA = state('A0');
    const atomB = state('B0');

    function App({ atom }: { atom: typeof atomA }) {
      const setValue = useSet(atom);
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

    const user = userEvent.setup();
    await user.click(screen.getByText('update'));

    expect(store.get(atomA)).toBe('A0');
    expect(store.get(atomB)).toBe('updated');
  });

  it('useSet invokes a new command when the signal argument changes', async () => {
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
      const setValue = useSet(cmd);
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

    const user = userEvent.setup();
    await user.click(screen.getByText('update'));

    expect(store.get(atomA)).toBe('A0');
    expect(store.get(atomB)).toBe('updated');
  });

  it('async callback will trigger rerender', async () => {
    const store = createStore();
    const count$ = state(0);
    const onClick$ = command(({ get, set }) => {
      return Promise.resolve().then(() => {
        set(count$, get(count$) + 1);
      });
    });

    function App() {
      const val = useGet(count$);
      const onClick = useSet(onClick$);
      return (
        <button
          onClick={() => {
            void onClick();
          }}
        >
          {val}
        </button>
      );
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    const button = screen.getByText('0');
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('floating promise trigger rerender', async () => {
    const store = createStore();
    const count$ = state(0);
    const onClick$ = command(({ get, set }) => {
      void Promise.resolve().then(() => {
        set(count$, get(count$) + 1);
      });
    });

    function App() {
      const val = useGet(count$);
      const onClick = useSet(onClick$);
      return <button onClick={onClick}>{val}</button>;
    }

    render(
      <StoreProvider value={store}>
        <App />
      </StoreProvider>,
    );
    const button = screen.getByText('0');
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);
    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('throw error if no store provide', () => {
    const count$ = state(0);

    function App() {
      const count = useGet(count$);
      return <div>{count}</div>;
    }

    expect(() => {
      render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    }).toThrowError('useStore must be used within a StoreProvider');
  });

  it('will unmount when component cleanup', async () => {
    const store = createDebugStore();
    const base$ = state(0);

    function App() {
      const ret = useGet(base$);
      return <div>ret:{ret}</div>;
    }

    function Container() {
      const [show, setShow] = useState(true);
      if (show) {
        return (
          <div>
            <App />
            <button
              onClick={() => {
                setShow(false);
              }}
            >
              hide
            </button>
          </div>
        );
      }
      return <div>unmounted</div>;
    }

    render(
      <StrictMode>
        <StoreProvider value={store}>
          <Container />
        </StoreProvider>
      </StrictMode>,
    );

    const user = userEvent.setup();

    expect(screen.getByText('ret:0')).toBeInTheDocument();
    const button = screen.getByText('hide');

    expect(store.getReadDependents(base$)).toHaveLength(2);

    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(await screen.findByText('unmounted')).toBeInTheDocument();
    expect(store.getReadDependents(base$)).toHaveLength(1);
  });
});

it('useSet should be stable', () => {
  const count$ = state(0);

  function Container() {
    const count = useGet(count$);
    return <Foo count={count} />;
  }

  function Foo({ count }: { count: number }) {
    const setCount = useSet(count$);

    return (
      <>
        count: {count}
        <RenderCounter setCount={setCount} />
      </>
    );
  }

  const trace = vi.fn();
  function RenderCounter({ setCount }: { setCount: (val: number) => void }) {
    trace(setCount);
    setCount(1);
    return <div>Render</div>;
  }

  const store = createStore();
  render(
    <StoreProvider value={store}>
      <Container />
    </StoreProvider>,
  );

  expect(trace).toHaveBeenCalledTimes(2);
  expect(trace.mock.calls[0][0]).toBe(trace.mock.calls[1][0]);
});
