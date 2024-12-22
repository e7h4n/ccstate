// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import LeakDetector from 'jest-leak-detector';
import { render, cleanup, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import { computed, getDefaultStore, type Computed } from 'ccstate';
import Memory from './Memory.svelte';

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
