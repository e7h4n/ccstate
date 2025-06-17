/* eslint-disable @typescript-eslint/no-deprecated */

import { useStore } from './provider';
import { command } from 'ccstate';
import type { Computed, State } from 'ccstate';

export function useGet<T>(atom: State<T> | Computed<T>) {
  const store = useStore();
  return {
    subscribe(fn: (payload: T) => void) {
      fn(store.get(atom));
      return store.sub(
        atom,
        command(({ get }) => {
          const nextValue = get(atom);
          fn(nextValue);
        }),
      );
    },
  };
}
