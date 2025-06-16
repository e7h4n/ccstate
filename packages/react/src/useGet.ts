import { useSyncExternalStore } from 'react';
import { useStore } from './provider';
import { command } from 'ccstate';
import type { Computed, State } from 'ccstate';

export function useGetInternal<T>(
  atom: State<T> | Computed<T>,
  { silenceUnhandleRejection }: { silenceUnhandleRejection: boolean },
) {
  const store = useStore();
  return useSyncExternalStore(
    (fn) => {
      const ctrl = new AbortController();
      store.sub(atom, command(fn), { signal: ctrl.signal });
      return () => {
        ctrl.abort();
      };
    },
    () => {
      const val = store.get(atom);
      if (val instanceof Promise && silenceUnhandleRejection) {
        val.catch(() => void 0);
      }
      return val;
    },
  );
}

export function useGet<T>(atom: State<T> | Computed<T>) {
  return useGetInternal(atom, { silenceUnhandleRejection: false });
}
