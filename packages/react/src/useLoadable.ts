import { useEffect, useState } from 'react';
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
): Loadable<T> {
  const promise = useGet(atom);
  const [promiseResult, setPromiseResult] = useState<Loadable<T>>({
    state: 'loading',
  });

  useEffect(() => {
    const ctrl = new AbortController();
    const signal = ctrl.signal;

    if (!keepLastResolved) {
      setPromiseResult({
        state: 'loading',
      });
    }

    void promise
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

    return () => {
      ctrl.abort();
    };
  }, [promise]);

  return promiseResult;
}

export function useLoadable<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Loadable<T> {
  return useLoadableInternal(atom, false);
}

export function useLastLoadable<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Loadable<T> {
  return useLoadableInternal(atom, true);
}
