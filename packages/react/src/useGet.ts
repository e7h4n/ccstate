import { useCallback, useSyncExternalStore } from 'react';
import { useStore } from './provider';

import type { Computed, State } from 'ccstate';

export function useGet<T>(atom: State<T> | Computed<T>) {
  const store = useStore();
  const subscribe = useCallback(
    (fn: () => void) => {
      const controller = new AbortController();
      store.watch(
        (get) => {
          get(atom);
          fn();
        },
        {
          signal: controller.signal,
        },
      );
      return () => {
        controller.abort();
      };
    },
    [store, atom],
  );

  return useSyncExternalStore(subscribe, () => store.get(atom));
}
