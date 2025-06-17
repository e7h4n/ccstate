/* eslint-disable @typescript-eslint/no-deprecated */

import { useStore } from './provider';
import { command, type Computed, type State } from 'ccstate';
import { createSignal, onCleanup } from 'solid-js';

export function useGet<T>(atom: State<T> | Computed<T>) {
  const store = useStore();
  const [value, setValue] = createSignal<T>(store.get(atom));

  const unsub = store.sub(
    atom,
    command(() => {
      setValue(() => store.get(atom));
    }),
  );

  onCleanup(() => {
    unsub();
  });

  return value;
}
