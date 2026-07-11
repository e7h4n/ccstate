import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useStore } from './provider';
import { defaultEqualityFn, type EqualityOptions } from './equality';

import type { Computed, State } from 'ccstate';

export function useGet<T>(atom: State<T> | Computed<T>, options?: EqualityOptions<T>) {
  const store = useStore();
  const equalityFn = options?.equalityFn ?? defaultEqualityFn;
  const snapshotRef = useRef<{
    atom: State<T> | Computed<T>;
    value: T;
  } | null>(null);
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

  const getSnapshot = useCallback(() => {
    const next = store.get(atom);
    const previous = snapshotRef.current;
    if (previous !== null && previous.atom === atom && equalityFn(previous.value, next)) {
      return previous.value;
    }
    snapshotRef.current = { atom, value: next };
    return next;
  }, [store, atom, equalityFn]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
