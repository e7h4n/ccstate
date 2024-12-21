import { getCurrentInstance, onScopeDispose, shallowReadonly, shallowRef, type ShallowRef } from 'vue';
import { useStore } from './provider';
import { command, type Computed, type State } from '../core';

export function useGet<Value>(atom: Computed<Value> | State<Value>): Readonly<ShallowRef<Value>> {
  const store = useStore();
  const initialValue = store.get(atom);

  const vueState = shallowRef(initialValue);

  const controller = new AbortController();
  store.sub(
    atom,
    command(() => {
      const nextValue = store.get(atom);
      vueState.value = nextValue;
    }),
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
