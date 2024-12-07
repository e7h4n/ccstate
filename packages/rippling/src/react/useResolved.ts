import { useLoadable } from './useLoadable';
import type { Computed, Value } from '../core';

export function useResolved<T>(atom: Value<Promise<T>> | Computed<Promise<T>>): T | undefined {
  const loadable = useLoadable(atom);
  return loadable.state === 'hasData' ? loadable.data : undefined;
}
