/* eslint-disable @typescript-eslint/no-deprecated */
import { command, computed, state, type Command, type Computed, type State, type Subscribe } from 'ccstate';
import { useEffect, useRef } from 'react';
import { useStore } from './provider';

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

export function useSub(...args: Parameters<Subscribe>) {
  const store = useStore();

  useEffect(() => {
    return store.sub(...args);
  }, []);
}
