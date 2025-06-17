import { useSyncExternalStore } from 'react';
import { useStore } from './provider';
import { command } from 'ccstate';
import type { Computed, State } from 'ccstate';

export function useGet<T>(atom: State<T> | Computed<T>) {
  const store = useStore();
  return useSyncExternalStore(
    (fn) => store.sub(atom, command(fn)),
    () => store.get(atom),
  );
}
