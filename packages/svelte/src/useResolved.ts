import type { Computed, State } from 'ccstate';
import { derived, type Readable } from 'svelte/store';
import { useLastLoadable, useLoadable } from './useLoadable';

export function useResolved<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Readable<T | undefined> {
  const loadable = useLoadable(atom);
  return derived(loadable, ($loadable) => ($loadable.state === 'hasData' ? $loadable.data : undefined));
}

export function useLastResolved<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Readable<T | undefined> {
  const loadable = useLastLoadable(atom);
  return derived(loadable, ($loadable) => ($loadable.state === 'hasData' ? $loadable.data : undefined));
}
