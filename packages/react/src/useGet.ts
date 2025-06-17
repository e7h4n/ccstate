import { useRef, useSyncExternalStore } from 'react';
import { useStore } from './provider';

import type { Computed, State } from 'ccstate';

export function useGet<T>(atom: State<T> | Computed<T>) {
  const store = useStore();
  const onChange = useRef((fn: () => void) => {
    const controller = new AbortController();
    store._syncExternal(
      (get) => {
        const val = get(atom);
        if (val instanceof Promise) {
          val.catch(() => void 0);
        }
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
