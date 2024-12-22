// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, expect, it } from 'vitest';
import { createStore, state } from 'ccstate';
import { provideStore } from '../provider';
import { useLoadable, useLastLoadable } from '../useLoadable';
import { delay } from 'signal-timers';

afterEach(() => {
  cleanup();
});

function makeDefered<T>(): {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  promise: Promise<T>;
} {
  const deferred: {
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
    promise: Promise<T>;
  } = {} as {
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
    promise: Promise<T>;
  };

  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  return deferred;
}

it('convert promise to loadable', async () => {
  const base = state(Promise.resolve('foo'));

  const Component = {
    setup() {
      const ret = useLoadable(base);
      return { ret };
    },
    template: `
      <div>
        <p v-if="ret.state === 'loading'">loading</p>
        <p v-else-if="ret.state === 'hasData'">{{ ret.data }}</p>
      </div>
    `,
  };

  const store = createStore();
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(screen.getByText('loading')).toBeInTheDocument();
  expect(await screen.findByText('foo')).toBeInTheDocument();
});

it('reset promise atom will reset loadable', async () => {
  const base = state(Promise.resolve('foo'));

  const Component = {
    setup() {
      const ret = useLoadable(base);
      return { ret };
    },
    template: `
      <div>
        <p v-if="ret.state === 'loading'">loading</p>
        <p v-else-if="ret.state === 'hasData'">{{ ret.data }}</p>
      </div>
    `,
  };

  const store = createStore();
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(await screen.findByText('foo')).toBeInTheDocument();

  const [, promise] = (() => {
    let ret;
    const promise = new Promise((r) => (ret = r));
    return [ret, promise];
  })();

  store.set(base, promise);
  expect(await screen.findByText('loading')).toBeInTheDocument();
});

it('switchMap', async () => {
  const base = state(Promise.resolve('foo'));

  const Component = {
    setup() {
      const ret = useLoadable(base);
      return { ret };
    },
    template: `
      <div>
        <p v-if="ret.state === 'loading'">loading</p>
        <p v-else-if="ret.state === 'hasData'">{{ ret.data }}</p>
      </div>
    `,
  };

  const store = createStore();
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(await screen.findByText('foo')).toBeInTheDocument();

  const defered = makeDefered();

  store.set(base, defered.promise);
  expect(await screen.findByText('loading')).toBeInTheDocument();

  store.set(base, Promise.resolve('bar'));
  expect(await screen.findByText('bar')).toBeInTheDocument();

  defered.resolve('baz');
  await delay(0);
  expect(screen.queryByText('baz')).not.toBeInTheDocument();
});

it('switchMap catch error', async () => {
  const base = state(Promise.resolve('foo'));

  const Component = {
    setup() {
      const ret = useLoadable(base);
      return { ret };
    },
    template: `
      <div>
        <p v-if="ret.state === 'loading'">loading</p>
        <p v-else-if="ret.state === 'hasError'">{{ String(ret.error) }}</p>
        <p v-else-if="ret.state === 'hasData'">{{ ret.data }}</p>
      </div>
    `,
  };

  const store = createStore();
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(await screen.findByText('foo')).toBeInTheDocument();

  const defered = makeDefered();

  store.set(base, defered.promise);
  expect(await screen.findByText('loading')).toBeInTheDocument();

  store.set(base, Promise.resolve('bar'));
  expect(await screen.findByText('bar')).toBeInTheDocument();

  defered.reject(new Error('error'));
  await delay(0);
  expect(screen.queryByText('Error: error')).not.toBeInTheDocument();
});

it('use lastLoadable should not update when new promise pending', async () => {
  const async$ = state(Promise.resolve(1));

  const Component = {
    setup() {
      const number = useLastLoadable(async$);
      return { number };
    },
    template: `
      <div>
        <p v-if="number.state === 'loading'">loading</p>
        <p v-else-if="number.state === 'hasData'">num{{ number.data }}</p>
      </div>
    `,
  };

  const store = createStore();
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(await screen.findByText('num1')).toBeInTheDocument();

  const defered = makeDefered();
  store.set(async$, defered.promise);

  await delay(0);
  expect(screen.getByText('num1')).toBeInTheDocument();
  defered.resolve(2);
  await delay(0);
  expect(screen.getByText('num2')).toBeInTheDocument();
});

it('use lastLoadable should keep error', async () => {
  const async$ = state(Promise.reject(new Error('error')));

  const Component = {
    setup() {
      const number = useLastLoadable(async$);
      return { number };
    },
    template: `
      <div>
        <p v-if="number.state === 'loading'">loading</p>
        <p v-else-if="number.state === 'hasError'">{{ String(number.error) }}</p>
        <p v-else-if="number.state === 'hasData'">num{{ number.data }}</p>
      </div>
    `,
  };

  const store = createStore();
  render({
    components: { Component },
    setup() {
      provideStore(store);
    },
    template: `<div><Component /></div>`,
  });

  expect(await screen.findByText('Error: error')).toBeInTheDocument();

  const defered = makeDefered();
  store.set(async$, defered.promise);

  await delay(0);
  expect(screen.getByText('Error: error')).toBeInTheDocument();
  defered.resolve(2);
  await delay(0);
  expect(screen.getByText('num2')).toBeInTheDocument();
});
