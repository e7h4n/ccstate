import { useGet } from './useGet';
import type { Computed, State } from 'ccstate';
import { onDestroy } from 'svelte';
import { writable, type Writable } from 'svelte/store';

type Loadable<T> =
  | {
      state: 'loading';
    }
  | {
      state: 'hasData';
      data: T;
    }
  | {
      state: 'hasError';
      error: unknown;
    };

function useLoadableInternal<T>(
  atom: State<Promise<T>> | Computed<Promise<T>>,
  keepLastResolved: boolean,
): Writable<Loadable<T>> {
  const promise = useGet(atom);
  const loadable = writable<Loadable<T>>({
    state: 'loading',
  });

  let abortController = new AbortController();
  onDestroy(() => {
    abortController.abort();
  });

  promise.subscribe((promiseValue) => {
    abortController.abort();
    abortController = new AbortController();

    if (!keepLastResolved) {
      loadable.set({
        state: 'loading',
      });
    }

    void promiseValue
      .then((ret) => {
        if (abortController.signal.aborted) return;

        loadable.set({
          state: 'hasData',
          data: ret,
        });
      })
      .catch(() => void 0);

    void promiseValue.catch((error: unknown) => {
      if (abortController.signal.aborted) return;

      loadable.set({
        state: 'hasError',
        error,
      });
    });
  });

  return loadable;
}

export function useLoadable<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Writable<Loadable<T>> {
  return useLoadableInternal(atom, false);
}

export function useLastLoadable<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Writable<Loadable<T>> {
  return useLoadableInternal(atom, true);
}
