import { getCurrentInstance, onScopeDispose, shallowReadonly, shallowRef, type ShallowRef } from 'vue';
import { useStore } from './provider';
import { type Computed, type State } from 'ccstate';

export function useGet<Value>(atom: Computed<Value> | State<Value>): Readonly<ShallowRef<Value>> {
  const store = useStore();

  const vueState = shallowRef(store.get(atom));

  const refresh = () => {
    vueState.value = store.get(atom);
  };
  const unsubscribe = store.watch(atom, refresh);

  if (getCurrentInstance()) {
    onScopeDispose(unsubscribe);
  }
  refresh();

  return shallowReadonly(vueState);
}
