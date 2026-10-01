import { useStore } from './provider';
import { type Computed, type State } from 'ccstate';
import { createSignal, onCleanup } from 'solid-js';

export function useGet<T>(signal$: State<T> | Computed<T>) {
  const store = useStore();
  const [value, setValue] = createSignal<T>(store.get(signal$));

  const refresh = () => {
    setValue(() => store.get(signal$));
  };
  const unsubscribe = store.watch(signal$, refresh);
  onCleanup(unsubscribe);
  refresh();

  return value;
}
