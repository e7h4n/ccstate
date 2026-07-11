import { useCallback, useRef, useSyncExternalStore } from 'react';
import { type Computed, type State } from 'ccstate';
import { useStore } from './provider';
import { defaultEqualityFn, type EqualityFn, type EqualityOptions } from './equality';

export type Loadable<T> =
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

export type LoadableState = Loadable<unknown>['state'];

function hasSameData<T>(previous: Loadable<T>, next: Loadable<T>, equalityFn: EqualityFn<Awaited<T>>): boolean {
  return previous.state === 'hasData' && next.state === 'hasData' && equalityFn(previous.data, next.data);
}

const selectLoadable = <T>(loadable: Loadable<T>): Loadable<T> => loadable;
const selectLoadableState = <T>(loadable: Loadable<T>): LoadableState => loadable.state;

function useLoadableInternal<T, R>(
  promise$: State<Promise<Awaited<T>> | Awaited<T>> | Computed<Promise<Awaited<T>> | Awaited<T>>,
  keepLastResolved: boolean,
  select: (loadable: Loadable<T>) => R,
  equalityFn: EqualityFn<Awaited<T>>,
): R {
  const promiseResult = useRef<Loadable<T>>({
    state: 'loading',
  });
  const selectedResult = useRef(select(promiseResult.current));

  const store = useStore();
  const subStore = useCallback(
    (fn: () => void) => {
      function updateResult(result: Loadable<T>, signal: AbortSignal) {
        if (signal.aborted) return;
        if (keepLastResolved && hasSameData(promiseResult.current, result, equalityFn)) return;
        promiseResult.current = result;
        const nextSelectedResult = select(result);
        if (Object.is(selectedResult.current, nextSelectedResult)) return;
        selectedResult.current = nextSelectedResult;
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
    [store, promise$, keepLastResolved, select, equalityFn],
  );

  return useSyncExternalStore(subStore, () => selectedResult.current);
}

export function useLoadable<T>(
  atom: State<Promise<Awaited<T>> | Awaited<T>> | Computed<Promise<Awaited<T>> | Awaited<T>>,
): Loadable<T> {
  return useLoadableInternal<T, Loadable<T>>(atom, false, selectLoadable, defaultEqualityFn);
}

export function useLastLoadable<T>(
  atom: State<Promise<Awaited<T>> | Awaited<T>> | Computed<Promise<Awaited<T>> | Awaited<T>>,
  options?: EqualityOptions<Awaited<T>>,
): Loadable<T> {
  return useLoadableInternal<T, Loadable<T>>(atom, true, selectLoadable, options?.equalityFn ?? defaultEqualityFn);
}

export function useLoadableState<T>(
  atom: State<Promise<Awaited<T>> | Awaited<T>> | Computed<Promise<Awaited<T>> | Awaited<T>>,
): LoadableState {
  return useLoadableInternal<T, LoadableState>(atom, false, selectLoadableState, defaultEqualityFn);
}
