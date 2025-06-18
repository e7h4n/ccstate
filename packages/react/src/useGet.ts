import { useRef, useSyncExternalStore } from 'react';
import { useStore } from './provider';

import type { Computed, State } from 'ccstate';

export function useGet<T>(atom: State<T> | Computed<T>) {
  const store = useStore();
  const onChange = useRef((fn: () => void) => {
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
  });

  return useSyncExternalStore(onChange.current, () => store.get(atom));
}
