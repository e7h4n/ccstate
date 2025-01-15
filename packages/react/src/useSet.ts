import { useCallback } from 'react';
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

  return useCallback(
    'write' in signal
      ? (...args: CommandArgs): T => {
          return store.set(signal, ...args);
        }
      : (value: StateArg<T>) => {
          store.set(signal, value);
        },
    [store, signal],
  );
}
