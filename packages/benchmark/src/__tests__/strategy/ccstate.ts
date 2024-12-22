import type { Strategy } from './type';
import { createStore, computed, command, state } from 'ccstate';
import type { Computed, State } from 'ccstate';

export const ccstateStrategy: Strategy<State<number> | Computed<number>, ReturnType<typeof createStore>> = {
  createStore() {
    return createStore();
  },
  createValue(val: number) {
    return state(val);
  },
  createComputed(compute) {
    return computed((get) => compute(get));
  },
  sub(store, atom, callback) {
    return store.sub(
      atom,
      command(() => {
        callback();
      }),
    );
  },
  get(store, atom) {
    return store.get(atom);
  },
};
