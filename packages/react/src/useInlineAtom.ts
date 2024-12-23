import { command, computed, state, type Command, type Computed, type State } from 'ccstate';
import { useRef } from 'react';

function useRefFactory<T>(factory: () => T): T {
  const ref = useRef<T | null>(null);
  if (!ref.current) {
    const value = factory();
    ref.current = value;
    return value;
  }

  return ref.current;
}

export function useCCState<T>(...args: Parameters<typeof state<T>>): State<T> {
  return useRefFactory<State<T>>(() => {
    return state(...args);
  });
}

export function useComputed<T>(...args: Parameters<typeof computed<T>>): Computed<T> {
  return useRefFactory<Computed<T>>(() => {
    return computed(...args);
  });
}

export function useCommand<T, Args extends unknown[]>(...args: Parameters<typeof command<T, Args>>): Command<T, Args> {
  return useRefFactory<Command<T, Args>>(() => {
    return command(...args);
  });
}
