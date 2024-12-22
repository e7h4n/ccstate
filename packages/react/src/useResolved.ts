import { useLastLoadable, useLoadable } from './useLoadable';
import type { Computed, State } from 'ccstate';

export function useResolved<T>(atom: State<Promise<T>> | Computed<Promise<T>>): T | undefined {
  const loadable = useLoadable(atom);
  return loadable.state === 'hasData' ? loadable.data : undefined;
}

export function useLastResolved<T>(atom: State<Promise<T>> | Computed<Promise<T>>): T | undefined {
  const loadable = useLastLoadable(atom);
  return loadable.state === 'hasData' ? loadable.data : undefined;
}
