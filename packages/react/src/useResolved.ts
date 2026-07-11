import { useLastLoadable, useLoadable } from './useLoadable';
import type { Computed, State } from 'ccstate';
import type { EqualityOptions } from './equality';

export function useResolved<T>(
  atom: State<Promise<Awaited<T>> | Awaited<T>> | Computed<Promise<Awaited<T>> | Awaited<T>>,
): Awaited<T> | undefined {
  const loadable = useLoadable<T>(atom);
  return loadable.state === 'hasData' ? loadable.data : undefined;
}

export function useLastResolved<T>(
  atom: State<Promise<Awaited<T>> | Awaited<T>> | Computed<Promise<Awaited<T>> | Awaited<T>>,
  options?: EqualityOptions<Awaited<T>>,
): Awaited<T> | undefined {
  const loadable = useLastLoadable<T>(atom, options);
  return loadable.state === 'hasData' ? loadable.data : undefined;
}
