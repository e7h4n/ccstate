// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import LeakDetector from 'jest-leak-detector';
import { render, cleanup, screen } from '@testing-library/vue';
import { expect, it } from 'vitest';
import { computed, createStore, type Computed } from '../../core';
import { provideStore } from '../provider';
import { useGet } from '..';
import { useLastResolved } from '../useResolved';
import { delay } from 'signal-timers';

it('should release memory after view cleanup', async () => {
  let base$:
    | Computed<{
        foo: string;
      }>
    | undefined = computed(() => {
    return {
      foo: 'bar',
    };
  });

  const Component = {
    setup() {
      const base = useGet(
        base$ as Computed<{
          foo: string;
        }>,
      );
      return { foo: base.value.foo };
    },
    template: `
      <div>
        <p>foo: {{ foo }}</p>
      </div>
    `,
  };

  const store = createStore();
  const leakDetector = new LeakDetector(store.get(base$));
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(screen.getByText('foo: bar')).toBeInTheDocument();

  base$ = undefined;
  cleanup();

  expect(await leakDetector.isLeaking()).toBe(false);
});

it('should release memory for promise & loadable', async () => {
  let base$: Computed<Promise<string>> | undefined = computed(() => {
    return Promise.resolve('bar');
  });

  const Component = {
    setup() {
      if (!base$) {
        return {};
      }
      const base = useLastResolved(base$);
      return { base };
    },
    template: `
        <div>
          <p>{{ base }}</p>
        </div>
      `,
  };

  const store = createStore();
  const leakDetector = new LeakDetector(store.get(base$));
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  base$ = undefined;
  cleanup();
  await delay(0);

  expect(await leakDetector.isLeaking()).toBe(false);
});
