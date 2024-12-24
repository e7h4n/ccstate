import { computed, effect, signal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { Strategy } from './type';

export const preactSignalStrategy: Strategy<
  Signal<number>,
  { set: (signal: Signal<number>, value: number) => void }
> = {
  createStore() {
    return {
      get: (signal: Signal<number>) => signal.value,
      set: (signal: Signal<number>, value: number) => (signal.value = value),
    };
  },
  createValue(val: number) {
    return signal(val);
  },
  createComputed(compute) {
    return computed(() => compute((signal) => signal.value));
  },
  sub(store, signal, callback) {
    return effect(() => {
      const a = signal.value;
      void a;
      callback();
    });
  },
  get(store, signal) {
    return signal.value;
  },
};
