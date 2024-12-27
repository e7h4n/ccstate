import { computed, createDebugStore, createStore } from 'ccstate';
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
