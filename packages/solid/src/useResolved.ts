import { createMemo, type Accessor } from 'solid-js';
import { useLastLoadable, useLoadable } from './useLoadable';
import type { Computed, State } from 'ccstate';

export function useResolved<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Accessor<T | undefined> {
  const loadable = useLoadable(atom);
  return createMemo(() => {
    const value = loadable();
    return value.state === 'hasData' ? value.data : undefined;
  });
}

export function useLastResolved<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Accessor<T | undefined> {
  const loadable = useLastLoadable(atom);
  return createMemo(() => {
    const value = loadable();
    return value.state === 'hasData' ? value.data : undefined;
  });
}
