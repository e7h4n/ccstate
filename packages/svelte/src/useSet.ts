import { useStore } from './provider';
import type { Command, Updater, State } from 'ccstate';

export function useSet<T>(atom: State<T>): (value: T | Updater<T>) => void;
export function useSet<T, ARGS extends unknown[]>(atom: Command<T, ARGS>): (...args: ARGS) => T;
export function useSet<T, ARGS extends unknown[]>(
  atom: State<T> | Command<T, ARGS>,
): ((value: T | Updater<T>) => void) | ((...args: ARGS) => T) {
  const store = useStore();

  if ('write' in atom) {
    return (...args: ARGS): T => {
      const ret = store.set(atom, ...args);

      return ret;
    };
  }

  return (value: T | Updater<T>) => {
    store.set(atom, value);
  };
}
