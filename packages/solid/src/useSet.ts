import { useStore } from './provider';
import type { Command, State, StateArg } from 'ccstate';

type ValueSetter<T> = (val: StateArg<T>) => void;
type CommandInvoker<T, CommandArgs extends unknown[]> = (...args: CommandArgs) => T;

export function useSet<T>(signal: State<T>): ValueSetter<T>;
export function useSet<T, CommandArgs extends unknown[]>(
  signal: Command<T, CommandArgs>,
): CommandInvoker<T, CommandArgs>;
export function useSet<T, CommandArgs extends unknown[]>(
  signal: State<T> | Command<T, CommandArgs>,
): ValueSetter<T> | CommandInvoker<T, CommandArgs> {
  const store = useStore();

  if ('write' in signal) {
    return (...args: CommandArgs): T => {
      const ret = store.set(signal, ...args);

      return ret;
    };
  }

  return (value: StateArg<T>) => {
    store.set(signal, value);
  };
}
