import { useCallback, useRef, useSyncExternalStore } from 'react';
import { type Computed, type State } from 'ccstate';
import { useStore } from './provider';

type Loadable<T> =
  | {
      state: 'loading';
    }
  | {
      state: 'hasData';
      data: Awaited<T>;
    }
  | {
      state: 'hasError';
      error: unknown;
    };

function useLoadableInternal<T, U extends Promise<Awaited<T>> | Awaited<T>>(
  promise$: State<U> | Computed<U>,
  keepLastResolved: boolean,
): Loadable<T> {
  const promiseResult = useRef<Loadable<T>>({
    state: 'loading',
  });

  const store = useStore();
  const subStore = useCallback(
    (fn: () => void) => {
      function updateResult(result: Loadable<T>, signal: AbortSignal) {
        if (signal.aborted) return;
        promiseResult.current = result;
        fn();
      }

      const controller = new AbortController();

      store.watch(
        (get, { signal }) => {
          const promise: Promise<Awaited<T>> | Awaited<T> = get(promise$);
          if (!(promise instanceof Promise)) {
            updateResult(
              {
                state: 'hasData',
                data: promise,
              },
              signal,
            );
            return;
          }

          if (!keepLastResolved) {
            updateResult(
              {
                state: 'loading',
              },
              signal,
            );
          }

          promise.then(
            (ret) => {
              updateResult(
                {
                  state: 'hasData',
                  data: ret,
                },
                signal,
              );
            },
            (error: unknown) => {
              updateResult(
                {
                  state: 'hasError',
                  error,
                },
                signal,
              );
            },
          );
        },
        {
          signal: controller.signal,
        },
      );

      return () => {
        controller.abort();
      };
    },
    [store, promise$],
  );

  return useSyncExternalStore(subStore, () => promiseResult.current);
}

export function useLoadable<T>(
  atom: State<Promise<Awaited<T>> | Awaited<T>> | Computed<Promise<Awaited<T>> | Awaited<T>>,
): Loadable<T> {
  return useLoadableInternal(atom, false);
}

export function useLastLoadable<T>(
  atom: State<Promise<Awaited<T>> | Awaited<T>> | Computed<Promise<Awaited<T>> | Awaited<T>>,
): Loadable<T> {
  return useLoadableInternal(atom, true);
}
