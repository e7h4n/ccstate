import { useStore } from './provider';
import type { Computed, State } from 'ccstate';

export function useGet<T>(atom: State<T> | Computed<T>) {
  const store = useStore();
  return {
    subscribe(fn: (payload: T) => void) {
      const controller = new AbortController();

      store.watch(
        (get) => {
          fn(get(atom));
        },
        {
          signal: controller.signal,
        },
      );

      return () => {
        controller.abort();
      };
    },
  };
}
