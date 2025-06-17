import { afterEach, expect, it } from 'vitest';
import { StoreProvider, useGet, useSet } from '..';
import '@testing-library/jest-dom/vitest';
import { screen, cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { useCCState, useCommand, useComputed } from '../experimental';
import { createStore } from 'ccstate';

afterEach(() => {
  cleanup();
});
const user = userEvent.setup();

it('use atom in React component', async () => {
  function Counter() {
    const count$ = useCCState(0, {
      debugLabel: 'count$',
    });
    const double$ = useComputed(
      (get) => {
        return get(count$) * 2;
      },
      {
        debugLabel: 'double$',
      },
    );
    const incrementTriple$ = useCommand(
      ({ get, set }, diff: number) => {
        set(count$, get(count$) + diff * 3);
      },
      {
        debugLabel: 'incrementTriple$',
      },
    );

    const count = useGet(count$);
    const double = useGet(double$);

    const setCount = useSet(count$);
    const incrementTriple = useSet(incrementTriple$);

    return (
      <>
        <div>count: {String(count)}</div>
        <div>double: {String(double)}</div>
        <button
          onClick={() => {
            setCount((prev) => prev + 1);
          }}
        >
          Increment
        </button>
        <button
          onClick={() => {
            incrementTriple(1);
          }}
        >
          Increment Triple
        </button>
      </>
    );
  }

  const store = createStore();
  render(
    <StrictMode>
      <StoreProvider value={store}>
        <Counter />
      </StoreProvider>
    </StrictMode>,
  );
  expect(screen.getByText('count: 0')).toBeInTheDocument();

  const button = screen.getByText('Increment');
  await user.click(button);
  expect(screen.getByText('count: 1')).toBeInTheDocument();
  expect(screen.getByText('double: 2')).toBeInTheDocument();

  const incrementTripleButton = screen.getByText('Increment Triple');
  await user.click(incrementTripleButton);
  expect(screen.getByText('count: 4')).toBeInTheDocument();
  expect(screen.getByText('double: 8')).toBeInTheDocument();
});
