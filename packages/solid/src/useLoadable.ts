import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { useGet } from './useGet';
import type { Computed, State } from 'ccstate';

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
): Accessor<Loadable<T>> {
  const promise = useGet(atom);
  const [promiseResult, setPromiseResult] = createSignal<Loadable<T>>({
    state: 'loading',
  });

  createEffect(() => {
    const ctrl = new AbortController();
    onCleanup(() => {
      ctrl.abort();
    });

    const signal = ctrl.signal;

    if (!keepLastResolved) {
      setPromiseResult({
        state: 'loading',
      });
    }

    void promise()
      .then((ret) => {
        if (signal.aborted) return;

        setPromiseResult({
          state: 'hasData',
          data: ret,
        });
      })
      .catch((error: unknown) => {
        if (signal.aborted) return;

        setPromiseResult({
          state: 'hasError',
          error,
        });
      });
  }, [promise]);

  return promiseResult;
}

export function useLoadable<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Accessor<Loadable<T>> {
  return useLoadableInternal(atom, false);
}

export function useLastLoadable<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Accessor<Loadable<T>> {
  return useLoadableInternal(atom, true);
}
