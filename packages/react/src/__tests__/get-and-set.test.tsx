// @vitest-environment happy-dom
import { render, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createStore, command, state, createDebugStore } from 'ccstate';
import { StoreProvider, useGet, useSet } from '..';
import { StrictMode, useState } from 'react';
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

  it('will throw error if no provider', () => {
    const count$ = state(0);

    function App() {
      const count = useGet(count$);
      return <div>{count}</div>;
    }

    // suppress react render error message in console
    const mock = vi.spyOn(console, 'error').mockImplementation(() => void 0);
    expect(() =>
      render(
        <StrictMode>
          <App />
        </StrictMode>,
      ),
    ).toThrow();

    mock.mockRestore();
  });

  it('will unmount when component cleanup', async () => {
    const store = createDebugStore();
    const base$ = state(0);

    function App() {
      const ret = useGet(base$);
      return <div>{ret}</div>;
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
    expect(store.getSubscribeGraph()).toHaveLength(1);
    const button = screen.getByText('hide');
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(await screen.findByText('unmounted')).toBeInTheDocument();
    expect(store.getSubscribeGraph()).toHaveLength(0);
  });
});
