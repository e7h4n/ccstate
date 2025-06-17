import { render } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { computed, command, state, createDebugStore, getDefaultStore } from 'ccstate';
import { StoreProvider, useGet, useSet } from '..';
import { createSignal } from 'solid-js';
import '@testing-library/jest-dom/vitest';

it('using ccstate in solid', async () => {
  const base$ = state(0);

  function App() {
    const ret = useGet(base$);
    return <div>{ret()}</div>;
  }

  const screen = render(() => <App />);

  expect(screen.getByText('0')).toBeInTheDocument();
  getDefaultStore().set(base$, 1);
  expect(await screen.findByText('1')).toBeInTheDocument();
});

it('computed should re-render', async () => {
  const base$ = state(0);
  const derived$ = computed((get) => get(base$) * 2);

  function App() {
    const ret = useGet(derived$);
    return <div>{ret()}</div>;
  }

  const screen = render(() => <App />);

  expect(screen.getByText('0')).toBeInTheDocument();
  getDefaultStore().set(base$, 1);
  expect(await screen.findByText('2')).toBeInTheDocument();
});

it('user click counter should increment', async () => {
  const count$ = state(0);
  const onClick$ = command(({ get, set }) => {
    const ret = get(count$);
    set(count$, ret + 1);
  });

  function App() {
    const ret = useGet(count$);
    const onClick = useSet(onClick$);

    return <button onClick={onClick}>{ret()}</button>;
  }

  const screen = render(() => <App />);
  const button = screen.getByText('0');
  expect(button).toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(button);
  expect(screen.getByText('1')).toBeInTheDocument();
  await user.click(button);
  expect(screen.getByText('2')).toBeInTheDocument();
});

it('two atom changes should re-render once', async () => {
  const state1$ = state(0);
  const state2$ = state(0);

  function App() {
    const ret1 = useGet(state1$);
    const ret2 = useGet(state2$);
    return <div>{ret1() + ret2()}</div>;
  }

  const screen = render(() => <App />);
  expect(screen.getByText('0')).toBeInTheDocument();

  getDefaultStore().set(state1$, 1);
  getDefaultStore().set(state2$, 2);
  await Promise.resolve();
  expect(screen.getByText('3')).toBeInTheDocument();
});

it('async callback will trigger rerender', async () => {
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
        {val()}
      </button>
    );
  }

  const screen = render(() => <App />);
  const button = screen.getByText('0');
  expect(button).toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(button);
  expect(screen.getByText('1')).toBeInTheDocument();
});

it('floating promise trigger rerender', async () => {
  const count$ = state(0);
  const onClick$ = command(({ get, set }) => {
    void Promise.resolve().then(() => {
      set(count$, get(count$) + 1);
    });
  });

  function App() {
    const val = useGet(count$);
    const onClick = useSet(onClick$);
    return <button onClick={onClick}>{val()}</button>;
  }

  const screen = render(() => <App />);
  const button = screen.getByText('0');
  expect(button).toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(button);
  expect(await screen.findByText('1')).toBeInTheDocument();
});

it('should use default store if no provider', () => {
  const count$ = state(0);
  getDefaultStore().set(count$, 10);

  function App() {
    const count = useGet(count$);
    return <div>{count()}</div>;
  }

  const screen = render(() => <App />);
  expect(screen.getByText('10')).toBeInTheDocument();
});

it('will unmount when component cleanup', async () => {
  const base$ = state(0);

  function App() {
    const ret = useGet(base$);
    return <div>{ret()}</div>;
  }

  function Container() {
    const [show, setShow] = createSignal(true);

    return (
      <div>
        {show() ? <App /> : <div>unmounted</div>}
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

  const store = createDebugStore();
  const screen = render(() => (
    <StoreProvider value={store}>
      <Container />
    </StoreProvider>
  ));

  const user = userEvent.setup();
  expect(store.isMounted(base$)).toBeTruthy();
  const button = screen.getByText('hide');
  await user.click(button);
  expect(await screen.findByText('unmounted')).toBeInTheDocument();
  expect(store.isMounted(base$)).toBeFalsy();
});
