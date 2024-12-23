// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import LeakDetector from 'jest-leak-detector';
import { render, cleanup, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import { computed, getDefaultStore, type Computed } from 'ccstate';
import Memory from './Memory.svelte';
import AsyncMemory from './AsyncMemory.svelte';

it('should release memory after view cleanup', async () => {
  let obj$: Computed<{ foo: string }> | undefined = computed(() => {
    return { foo: 'bar' };
  });
  const store = getDefaultStore();
  const leakDetector = new LeakDetector(store.get(obj$ as Computed<{ foo: string }>));

  render(Memory, {
    props: {
      obj$,
    },
  });

  expect(screen.getByText('obj: bar')).toBeInTheDocument();

  obj$ = undefined;
  cleanup();

  expect(await leakDetector.isLeaking()).toBe(false);
});

it('should release promise memory after view cleanup', async () => {
  let obj$: Computed<Promise<{ foo: string }>> | undefined = computed(() => {
    return Promise.resolve({ foo: 'bar' });
  });
  const store = getDefaultStore();
  const leakDetector = new LeakDetector(await store.get(obj$ as Computed<Promise<{ foo: string }>>));

  render(AsyncMemory, {
    props: {
      obj$: () => obj$ as Computed<Promise<{ foo: string }>>,
    },
  });

  expect(await screen.findByText('obj: bar')).toBeInTheDocument();

  obj$ = undefined;
  cleanup();

  expect(await leakDetector.isLeaking()).toBe(false);
});
