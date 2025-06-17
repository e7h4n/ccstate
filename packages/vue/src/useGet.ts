import { getCurrentInstance, onScopeDispose, shallowReadonly, shallowRef, type ShallowRef } from 'vue';
import { useStore } from './provider';
import { type Computed, type State } from 'ccstate';

export function useGet<Value>(atom: Computed<Value> | State<Value>): Readonly<ShallowRef<Value>> {
  const store = useStore();
  const initialValue = store.get(atom);

  const vueState = shallowRef(initialValue);

  const controller = new AbortController();
  store.watch(
    (get) => {
      const value = get(atom);
      vueState.value = value;
    },
    {
      signal: controller.signal,
    },
  );

  if (getCurrentInstance()) {
    onScopeDispose(() => {
      controller.abort();
    });
  }

  return shallowReadonly(vueState);
}
