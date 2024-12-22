import { useLastLoadable, useLoadable } from './useLoadable';
import type { Computed, State } from 'ccstate';
import { computed, type ComputedRef } from 'vue';

export function useResolved<T>(atom: State<Promise<T>> | Computed<Promise<T>>): ComputedRef<T | undefined> {
  const loadable = useLoadable(atom);
  return computed(() => (loadable.value.state === 'hasData' ? loadable.value.data : undefined));
}

export function useLastResolved<T>(atom: State<Promise<T>> | Computed<Promise<T>>): ComputedRef<T | undefined> {
  const loadable = useLastLoadable(atom);
  return computed(() => (loadable.value.state === 'hasData' ? loadable.value.data : undefined));
}
