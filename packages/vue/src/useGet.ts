import { getCurrentInstance, onScopeDispose, shallowReadonly, shallowRef, type ShallowRef } from 'vue';
import { useStore } from './provider';
import { type Computed, type State } from 'ccstate';

export function useGet<Value>(atom: Computed<Value> | State<Value>): Readonly<ShallowRef<Value>> {
  const store = useStore();

  const vueState = shallowRef(store.get(atom));

  const controller = new AbortController();
  store.watch(
    (get) => {
      vueState.value = get(atom);
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
