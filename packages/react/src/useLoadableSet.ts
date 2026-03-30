import { useCallback, useRef, useSyncExternalStore } from 'react';
import { type Command, type State, type StateArg } from 'ccstate';
import { useStore } from './provider';

type LoadableSetResult<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'hasData'; data: Awaited<T> }
  | { state: 'hasError'; error: unknown };

export function useLoadableSet<T>(signal: State<T>): [LoadableSetResult<void>, (val: StateArg<T>) => void];
export function useLoadableSet<T, CommandArgs extends unknown[]>(
  signal: Command<T, CommandArgs>,
): [LoadableSetResult<Awaited<T>>, (...args: CommandArgs) => T];
export function useLoadableSet<T, CommandArgs extends unknown[]>(
  signal: State<T> | Command<T, CommandArgs>,
): [LoadableSetResult<unknown>, (...args: unknown[]) => unknown] {
  const store = useStore();
  const resultRef = useRef<LoadableSetResult<unknown>>({ state: 'idle' });
  const notifyRef = useRef<(() => void) | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const subscribe = useCallback((notify: () => void) => {
    notifyRef.current = notify;
    return () => {
      notifyRef.current = null;
      controllerRef.current?.abort();
    };
  }, []);

  const invoke = useCallback(
    (...args: unknown[]) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal: abortSignal } = controller;

      function updateResult(result: LoadableSetResult<unknown>) {
        if (abortSignal.aborted) return;
        resultRef.current = result;
        notifyRef.current?.();
      }

      if ('write' in signal) {
        const result = store.set(signal, ...(args as CommandArgs));
        if (result instanceof Promise) {
          updateResult({ state: 'loading' });
          void result.then(
            (data: unknown) => {
              updateResult({ state: 'hasData', data });
            },
            (error: unknown) => {
              updateResult({ state: 'hasError', error });
            },
          );
        } else {
          updateResult({ state: 'hasData', data: result });
        }
        return result;
      } else {
        store.set(signal, ...(args as [StateArg<T>]));
        updateResult({ state: 'hasData', data: undefined });
        return undefined;
      }
    },
    [store, signal],
  );

  const loadable = useSyncExternalStore(subscribe, () => resultRef.current);

  return [loadable, invoke];
}
