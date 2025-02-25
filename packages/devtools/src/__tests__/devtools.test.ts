import { computed, createDebugStore, createStore, state } from 'ccstate';
import { createDevtools, type ComputedWatch } from '../devtools';
import { it, expect } from 'vitest';

it('should have null selected watch initially', () => {
  const store = createStore();
  const devtools = createDevtools();
  expect(store.get(devtools.currentWatch$)).toBe(null);

  const targetStore = createDebugStore();
  store.set(devtools.setDebugStore$, targetStore);

  expect(store.get(devtools.currentWatch$)).toBe(null);

  const signal$ = computed(() => 0);
  const watch: ComputedWatch = {
    target: signal$,
  };

  store.set(devtools.pushComputedWatch$, watch);
  expect(store.get(devtools.currentWatch$)).toBe(watch);

  const signal2$ = computed(() => 1);
  const watch2: ComputedWatch = {
    target: signal2$,
  };
  store.set(devtools.pushComputedWatch$, watch2);
  expect(store.get(devtools.currentWatch$)).toBe(watch);

  store.set(devtools.selectWatch$, watch2);
  expect(store.get(devtools.currentWatch$)).toBe(watch2);
});

it('should compute graph', () => {
  const store = createStore();
  const devtools = createDevtools();

  const base$ = state(0, {
    debugLabel: 'base$',
  });
  const derived$ = computed((get) => 1 + get(base$), {
    debugLabel: 'derived$',
  });

  expect(store.get(devtools.graph$)).toBeNull();

  const targetStore = createDebugStore();
  store.set(devtools.setDebugStore$, targetStore);
  expect(store.get(devtools.graph$)).toBeNull();

  store.set(devtools.pushComputedWatch$, {
    target: derived$,
  });

  expect(store.get(devtools.graph$)).toEqual({
    title: derived$.toString(),
    edges: [],
    nodes: new Map(),
  });

  expect(targetStore.get(derived$)).toBe(1);
  expect(store.get(devtools.graph$)).toEqual({
    title: derived$.toString(),
    edges: [],
    nodes: new Map(),
  });

  store.set(devtools.refreshGraph$);
  expect(store.get(devtools.graph$)).toEqual({
    title: derived$.toString(),
    edges: [[derived$.id, base$.id, 0]],
    nodes: new Map([
      [
        derived$.id,
        {
          label: derived$.toString(),
          shape: 'circle',
          data: {
            epoch: 0,
            value: 1,
          },
        },
      ],
      [base$.id, { label: base$.toString(), shape: 'square', data: { epoch: 0, value: 0 } }],
    ]),
  });
});
