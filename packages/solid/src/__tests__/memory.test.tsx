// @vitest-environment happy-dom

import LeakDetector from 'jest-leak-detector';
import { expect, it } from 'vitest';
import { state, createStore } from 'ccstate';
import type { State } from 'ccstate';
import { useGet, StoreProvider, useResource } from '../';
import { cleanup, render } from '@solidjs/testing-library';
import '@testing-library/jest-dom/vitest';
import { delay } from 'signal-timers';

it('should release memory after component unmount', async () => {
  const store = createStore();
  let base: State<{ foo: string }> | undefined = state({
    foo: 'bar',
  });

  const detector = new LeakDetector(store.get(base));

  function App() {
    const ret = useGet(base as State<{ foo: string }>);
    return <div>{ret().foo}</div>;
  }

  render(() => (
    <StoreProvider value={store}>
      <App />
    </StoreProvider>
  ));

  base = undefined;
  cleanup();

  expect(await detector.isLeaking()).toBe(false);
});

it('should release memory for promise & loadable', async () => {
  const store = createStore();
  let base$: State<Promise<string>> | undefined = state(Promise.resolve('bar'));

  const detector = new LeakDetector(store.get(base$));

  function App() {
    if (!base$) {
      return null;
    }
    const ret = useResource(base$);
    return <div>{ret()}</div>;
  }

  render(() => (
    <StoreProvider value={store}>
      <App />
    </StoreProvider>
  ));

  base$ = undefined;
  cleanup();
  await delay(0); // wait promise reject to free promise callback

  expect(await detector.isLeaking()).toBe(false);
});
