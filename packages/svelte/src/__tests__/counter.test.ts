import { render, cleanup, screen } from '@testing-library/svelte';
import { afterEach, expect, it } from 'vitest';
import { createStore } from 'ccstate';
import '@testing-library/jest-dom/vitest';
import App from './App.svelte';
import { count$ } from './store';
import { userEvent } from '@testing-library/user-event';

afterEach(() => {
  cleanup();
});

const user = userEvent.setup();

it('simple counter', async () => {
  const store = createStore();
  render(App, { props: { store } });

  expect(screen.getByText('count: 0')).toBeInTheDocument();
  store.set(count$, 1);

  expect(await screen.findByText('count: 1')).toBeInTheDocument();

  const button = screen.getByText('Increment');

  await user.click(button);
  await user.click(button);
  expect(await screen.findByText('count: 3')).toBeInTheDocument();

  await user.click(button);
  expect(await screen.findByText('count: 4')).toBeInTheDocument();

  const doubleButton = screen.getByText('Double Increase');
  await user.click(doubleButton);
  expect(await screen.findByText('count: 24')).toBeInTheDocument();
});

it('useStore custom store', async () => {
  const store = createStore();
  store.set(count$, 100);

  render(App, {
    props: {
      store,
    },
  });

  expect(screen.getByText('count: 100')).toBeInTheDocument();

  const button = screen.getByText('Increment');

  await user.click(button);

  expect(store.get(count$)).toBe(101);
});
