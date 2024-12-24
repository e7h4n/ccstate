import { computed, effect, signal } from 'alien-signals';
import type { Computed, Signal } from 'alien-signals';
import type { Strategy } from './type';

export const alienSignalStrategy: Strategy<
  Signal<number> | Computed<number>,
  { set: (signal: Signal<number>, value: number) => void }
> = {
  createStore() {
    return {
      get: (signal: Signal<number>) => signal.get(),
      set: (signal: Signal<number>, value: number) => {
        signal.set(value);
      },
    };
  },
  createValue(val: number) {
    return signal(val);
  },
  createComputed(compute) {
    return computed(() => compute((signal) => signal.get()));
  },
  sub(store, signal, callback) {
    const e = effect(() => {
      const a = signal.get();
      void a;
      callback();
    });
    return () => {
      e.stop();
    };
  },
  get(store, signal) {
    return signal.get();
  },
};
