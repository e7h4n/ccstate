import { render, cleanup, screen } from '@testing-library/svelte';
import { afterEach, expect, it } from 'vitest';
import { createDebugStore } from 'ccstate';
import '@testing-library/jest-dom/vitest';
import { count$ } from './store';
import Prop from './Prop.svelte';
import { StoreKey } from '../provider';

afterEach(() => {
  cleanup();
});

it('prop takes same atom', async () => {
  const store = createDebugStore([/./]);

  render(Prop, {
    props: {
      count$,
    },
    context: new Map([[StoreKey, store]]),
  });

  expect(await screen.findByText('100')).toBeInTheDocument();
  expect(store.get(count$)).toBe(100);
});
