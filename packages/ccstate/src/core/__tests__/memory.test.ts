import LeakDetector from 'jest-leak-detector';
import { expect, it } from 'vitest';
import { state, computed, createStore } from '..';
import { createDebugStore } from '../../debug';
import type { Computed, State } from '..';

it('should release memory after delete value', async () => {
  const store = createStore();
  let base: State<object> | undefined = state({});

  const detector = new LeakDetector(store.get(base));
  base = undefined;

  expect(await detector.isLeaking()).toBe(false);
});

it('should release memory after base value & derived computed is deleted', async () => {
  const store = createStore();
  let base: State<object> | undefined = state({});
  let derived: Computed<object> | undefined = computed((get) => ({
    obj: base && get(base),
  }));
  const detector1 = new LeakDetector(store.get(base));
  const detector2 = new LeakDetector(store.get(derived));

  base = undefined;
  derived = undefined;

  expect(await detector1.isLeaking()).toBe(false);
  expect(await detector2.isLeaking()).toBe(false);
});

it('with a long-lived base value', async () => {
  const store = createStore();
  const base = state({});

  let cmpt: Computed<object> | undefined = computed((get) => ({
    obj: get(base),
  }));

  const detector = new LeakDetector(store.get(cmpt));
  cmpt = undefined;
  expect(await detector.isLeaking()).toBe(false);
});

it('should not hold onto dependent atoms that are not mounted', async () => {
  const store = createStore();
  const base = state({});
  let cmpt: Computed<unknown> | undefined = computed((get) => get(base));
  const detector = new LeakDetector(cmpt);
  store.get(cmpt);
  cmpt = undefined;
  await expect(detector.isLeaking()).resolves.toBe(false);
});

it('a retained disposed unsubscribe releases both its target and captured listener payload', async () => {
  const store = createStore();
  function subscribe() {
    const payload = {};
    const source = state(payload);
    const detector = new LeakDetector(payload);
    const unsubscribe = store.watch(source, () => payload);
    return { detector, unsubscribe };
  }
  const { detector, unsubscribe } = subscribe();
  unsubscribe();
  unsubscribe();
  expect(await detector.isLeaking()).toBe(false);
});

it('unsubscribe on atom should release memory', async () => {
  const store = createStore();
  let objAtom: State<object> | undefined = state({});
  const detector = new LeakDetector(store.get(objAtom));

  const unsubscribeWatch1 = store.watch(objAtom, () => undefined);

  unsubscribeWatch1();

  objAtom = undefined;
  expect(await detector.isLeaking()).toBe(false);
});

it('unsubscribe on computed should release memory', async () => {
  const store = createStore();
  let objAtom: State<object> | undefined = state({});
  const detector1 = new LeakDetector(store.get(objAtom));
  let derivedAtom: Computed<object> | undefined = computed((get) => ({
    obj: objAtom && get(objAtom),
  }));
  const detector2 = new LeakDetector(store.get(derivedAtom));

  const unsubscribeWatch2 = store.watch(objAtom, () => undefined);
  unsubscribeWatch2();

  objAtom = undefined;
  derivedAtom = undefined;
  expect(await detector1.isLeaking()).toBe(false);
  expect(await detector2.isLeaking()).toBe(false);
});

it('unsubscribe a long-lived base atom', async () => {
  const store = createStore();
  const base = state({});
  let cmpt: Computed<object> | undefined = computed((get) => ({
    obj: get(base),
  }));
  const detector = new LeakDetector(store.get(cmpt));

  const unsubscribeWatch3 = store.watch(base, () => undefined);
  unsubscribeWatch3();
  cmpt = undefined;
  expect(await detector.isLeaking()).toBe(false);
});

it('unsubscribe a computed atom', async () => {
  const store = createDebugStore();
  const base = state({}, { debugLabel: 'base' });
  let cmpt: Computed<object> | undefined = computed(
    (get) => ({
      obj: get(base),
    }),
    { debugLabel: 'cmpt' },
  );
  const detector = new LeakDetector(store.get(cmpt));

  const unsubscribeWatch4 = store.watch(cmpt, () => undefined);

  unsubscribeWatch4();
  cmpt = undefined;
  expect(await detector.isLeaking()).toBe(false);
});
