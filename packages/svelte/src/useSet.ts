import { useStore } from './provider';
import type { Command, State, StateArg } from 'ccstate';

export function useSet<T>(atom: State<T>): (value: StateArg<T>) => void;
export function useSet<T, CommandArgs extends unknown[]>(atom: Command<T, CommandArgs>): (...args: CommandArgs) => T;
export function useSet<T, CommandArgs extends unknown[]>(
  atom: State<T> | Command<T, CommandArgs>,
): ((value: StateArg<T>) => void) | ((...args: CommandArgs) => T) {
  const store = useStore();

  if ('write' in atom) {
    return (...args: CommandArgs): T => {
      const ret = store.set(atom, ...args);

      return ret;
    };
  }

  return (value: StateArg<T>) => {
    store.set(atom, value);
  };
}
