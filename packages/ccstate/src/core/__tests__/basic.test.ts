import { expect, it, vi } from 'vitest';
import { computed, command, state, createStore } from '..';

it('creates atoms', () => {
  // primitive atom
  const countAtom = state(0);
  const anotherCountAtom = state(1);
  // read-only derived atom
  const doubledCountAtom = computed((get) => get(countAtom) * 2);
  // read-write derived atom
  const sumAtom = computed((get) => get(countAtom) + get(anotherCountAtom));

  const setSumAtom = command(({ get, set }, num: number) => {
    set(countAtom, get(countAtom) + num / 2);
    set(anotherCountAtom, get(anotherCountAtom) + num / 2);
  });

  // write-only derived atom
  const decrementCountAtom = command(({ get, set }) => {
    set(countAtom, get(countAtom) - 1);
  });

  expect(countAtom).toHaveProperty('init', 0);
  expect(doubledCountAtom).toHaveProperty('read');
  expect(setSumAtom).toHaveProperty('write');
  expect(decrementCountAtom).toHaveProperty('write');
  expect(sumAtom).toHaveProperty('read');
});

it('should catch error when computed throw exception', () => {
  const base$ = state(0);

  const cmptWithError$ = computed((get) => {
    const num = get(base$);
    if (num !== 0) {
      throw new Error();
    }
    return num;
  });

  const store = createStore();
  const trace = vi.fn();
  store.sub(cmptWithError$, command(trace));

  expect(trace).not.toHaveBeenCalled();

  store.set(base$, 1);

  expect(trace).toBeCalledTimes(1);

  expect(() => {
    store.get(cmptWithError$);
  }).toThrow();

  const normalComputed$ = computed((get) => {
    return get(base$) + 1;
  });
  store.sub(normalComputed$, command(trace));
  expect(trace).toBeCalledTimes(1);

  store.set(base$, 2);
  expect(trace).toBeCalledTimes(2);
});
