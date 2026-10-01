import { useStore } from './provider';
import type { Computed, State } from 'ccstate';

export function useGet<T>(atom: State<T> | Computed<T>) {
  const store = useStore();
  return {
    subscribe(fn: (payload: T) => void) {
      const refresh = () => {
        fn(store.get(atom));
      };
      const unsubscribe = store.watch(atom, refresh);
      // Svelte's readable-store contract requires synchronous initial delivery.
      try {
        refresh();
      } catch (error) {
        unsubscribe();
        throw error;
      }
      return unsubscribe;
    },
  };
}
