import { atom, createStore } from 'jotai/vanilla';
import type { Strategy } from './type';
import type { Atom } from 'jotai/vanilla';

export const jotaiStrategy: Strategy<Atom<number>, ReturnType<typeof createStore>> = {
  createStore() {
    return createStore();
  },
  createValue(val: number) {
    return atom(val);
  },
  createComputed(compute) {
    return atom((get) => compute(get));
  },
  sub(store, atom, callback) {
    return store.sub(atom, callback);
  },
  get(store, atom) {
    return store.get(atom);
  },
};
