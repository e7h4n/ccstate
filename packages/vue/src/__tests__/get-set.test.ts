// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, cleanup, screen } from '@testing-library/vue';
import { afterEach, expect, it } from 'vitest';
import { command, createStore, getDefaultStore, state } from 'ccstate';
import { provideStore } from '../provider';
import { useGet, useSet } from '..';

afterEach(() => {
  cleanup();
});

it('increments value on click', async () => {
  const count$ = state(0);

  const Component = {
    setup() {
      const count = useGet(count$);
      const setCount = useSet(count$);
      return { count, setCount };
    },
    template: `
    <div>
      <p>Times clicked: {{ count }}</p>
      <button @click="setCount((prev) => prev + 1)">increment</button>
    </div>
  `,
  };

  render({
    components: { Component },
    setup() {
      provideStore(createStore());
    },
    template: `<div><Component /></div>`,
  });

  expect(screen.getByText('Times clicked: 0')).toBeInTheDocument();

  const button = screen.getByText('increment');

  await fireEvent.click(button);
  await fireEvent.click(button);
  expect(screen.getByText('Times clicked: 2')).toBeInTheDocument();

  await fireEvent.click(button);
  expect(screen.getByText('Times clicked: 3')).toBeInTheDocument();
});

it('call command by useSet', async () => {
  const count$ = state(0);
  const increase$ = command(({ get, set }, count: number) => {
    set(count$, get(count$) + count);
  });

  const Component = {
    setup() {
      const count = useGet(count$);
      const increase = useSet(increase$);
      return { count, increase };
    },
    template: `
    <div>
      <p>Times clicked: {{ count }}</p>
      <button @click="increase(10)">increment</button>
    </div>
  `,
  };

  render({
    components: { Component },
    setup() {
      provideStore(createStore());
    },
    template: `<div><Component /></div>`,
  });

  expect(screen.getByText('Times clicked: 0')).toBeInTheDocument();

  const button = screen.getByText('increment');

  await fireEvent.click(button);
  await fireEvent.click(button);
  expect(screen.getByText('Times clicked: 20')).toBeInTheDocument();

  await fireEvent.click(button);
  expect(screen.getByText('Times clicked: 30')).toBeInTheDocument();
});

it('should use default store if no provider', () => {
  const count$ = state(0);
  getDefaultStore().set(count$, 10);

  const Component = {
    setup() {
      const count = useGet(count$);
      return { count };
    },
    template: `
    <div>
      <p>{{ count }}</p>
    </div>
  `,
  };

  render({
    components: { Component },
    template: `<div><Component /></div>`,
  });

  expect(screen.getByText('10')).toBeInTheDocument();
});
