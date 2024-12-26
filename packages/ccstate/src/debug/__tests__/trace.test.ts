import { expect, it } from 'vitest';
import { computed, state } from '../../core';
import { createDebugStore } from '../console-inspector';

it('get derived graph', () => {
  const count$ = state(0, { debugLabel: 'count$' });
  const derived$ = computed((get) => get(count$) + 1, {
    debugLabel: 'derived$',
  });
  const store = createDebugStore();
  store.set(count$, (x) => x + 1);
  store.set(count$, (x) => x + 1);
  store.get(derived$);
  expect(store.getDependenciesGraph(derived$)).toEqual([
    [
      {
        epoch: 0,
        signal: {
          debugLabel: 'derived$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 3,
      },
      {
        epoch: 1,
        signal: {
          debugLabel: 'count$',
          id: expect.any(Number) as number,
          init: 0,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 2,
      },
      1,
    ],
  ]);

  store.set(count$, (x) => x + 1);
  store.get(derived$);
  expect(store.getDependenciesGraph(derived$)).toEqual([
    [
      {
        epoch: 1,
        signal: {
          debugLabel: 'derived$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 4,
      },
      {
        epoch: 2,
        signal: {
          debugLabel: 'count$',
          id: expect.any(Number) as number,
          init: 0,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 3,
      },
      2,
    ],
  ]);
});

it('branch trace', () => {
  const count$ = state(0, { debugLabel: 'count$' });
  const base$ = computed((get) => get(count$), {
    debugLabel: 'base$',
  });
  const mid$ = computed((get) => get(base$) + 1, {
    debugLabel: 'mid$',
  });
  const branch$ = state(true, {
    debugLabel: 'branch$',
  });
  const top$ = computed(
    (get) => {
      if (get(branch$)) {
        return get(mid$);
      }

      return get(base$);
    },
    {
      debugLabel: 'top$',
    },
  );

  const store = createDebugStore();
  store.get(top$);
  expect(store.getDependenciesGraph(top$)).toEqual([
    [
      {
        epoch: 0,
        signal: {
          debugLabel: 'top$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 1,
      },
      {
        epoch: 0,
        signal: {
          debugLabel: 'branch$',
          id: expect.any(Number) as number,
          init: true,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: true,
      },
      0,
    ],
    [
      {
        epoch: 0,
        signal: {
          debugLabel: 'top$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 1,
      },
      {
        epoch: 0,
        signal: {
          debugLabel: 'mid$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 1,
      },
      0,
    ],
    [
      {
        epoch: 0,
        signal: {
          debugLabel: 'mid$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 1,
      },
      {
        epoch: 0,
        signal: {
          debugLabel: 'base$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 0,
      },
      0,
    ],
    [
      {
        epoch: 0,
        signal: {
          debugLabel: 'base$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 0,
      },
      {
        epoch: 0,
        signal: {
          debugLabel: 'count$',
          id: expect.any(Number) as number,
          init: 0,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 0,
      },
      0,
    ],
  ]);

  store.set(branch$, false);
  store.get(top$);
  expect(store.getDependenciesGraph(top$)).toEqual([
    [
      {
        epoch: 1,
        signal: {
          debugLabel: 'top$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 0,
      },
      {
        epoch: 1,
        signal: {
          debugLabel: 'branch$',
          id: expect.any(Number) as number,
          init: true,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: false,
      },
      1,
    ],
    [
      {
        epoch: 1,
        signal: {
          debugLabel: 'top$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 0,
      },
      {
        epoch: 0,
        signal: {
          debugLabel: 'base$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 0,
      },
      0,
    ],
    [
      {
        epoch: 0,
        signal: {
          debugLabel: 'base$',
          id: expect.any(Number) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          read: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 0,
      },
      {
        epoch: 0,
        signal: {
          debugLabel: 'count$',
          id: expect.any(Number) as number,
          init: 0,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          toString: expect.any(Function),
        },
        val: 0,
      },
      0,
    ],
  ]);
});
