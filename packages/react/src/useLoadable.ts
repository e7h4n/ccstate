import { useEffect, useState } from 'react';
import { type Computed, type State } from 'ccstate';
import { useGet } from './useGet';

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
  signal: State<U> | Computed<U>,
  keepLastResolved: boolean,
): Loadable<T> {
  const promise: Promise<Awaited<T>> | Awaited<T> = useGet(signal);
  const [promiseResult, setPromiseResult] = useState<Loadable<T>>({
    state: 'loading',
  });

  useEffect(() => {
    if (!(promise instanceof Promise)) {
      const data: Awaited<T> = promise;
      setPromiseResult({
        state: 'hasData',
        data,
      });

      return;
    }

    let cancelled = false;

    if (!keepLastResolved) {
      setPromiseResult({
        state: 'loading',
      });
    }

    promise.then(
      (ret) => {
        if (cancelled) return;

        setPromiseResult({
          state: 'hasData',
          data: ret,
        });
      },
      (error: unknown) => {
        if (cancelled) return;

        setPromiseResult({
          state: 'hasError',
          error,
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [promise]);

  return promiseResult;
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
