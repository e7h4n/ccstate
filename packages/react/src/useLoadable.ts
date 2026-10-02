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
      let active = true;
      let generation = 0;

      function updateResult(result: Loadable<T>, version: number) {
        if (!active || version !== generation) return;
        if (keepLastResolved && hasSameData(promiseResult.current, result, equalityFn)) return;
        promiseResult.current = result;
        const nextSelectedResult = select(result);
        if (Object.is(selectedResult.current, nextSelectedResult)) return;
        selectedResult.current = nextSelectedResult;
        fn();
      }

      function refresh() {
        const version = ++generation;
        let promise: Promise<Awaited<T>> | Awaited<T>;
        try {
          promise = store.get(promise$);
        } catch (error) {
          updateResult({ state: 'hasError', error }, version);
          return;
        }
        if (!(promise instanceof Promise)) {
          updateResult({ state: 'hasData', data: promise }, version);
          return;
        }
        if (!keepLastResolved) updateResult({ state: 'loading' }, version);
        void promise.then(
          (data) => {
            updateResult({ state: 'hasData', data }, version);
          },
          (error: unknown) => {
            updateResult({ state: 'hasError', error }, version);
          },
        );
      }

      const unsubscribe = store.watch(promise$, refresh);
      // Core watch establishes dependencies, but initialization of the hook's
      // selected snapshot belongs to this subscription, not to the listener API.
      refresh();

      return () => {
        active = false;
        generation += 1;
        unsubscribe();
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
