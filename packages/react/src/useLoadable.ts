import { useEffect, useState, useSyncExternalStore } from 'react';
import { command, type Computed, type State } from 'ccstate';
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

function useGetPromise<T, U extends Promise<Awaited<T>> | Awaited<T>>(atom: State<U> | Computed<U>): U {
  const store = useStore();
  return useSyncExternalStore(
    (fn) =>
      store.sub(
        atom,
        command(({ get }) => {
          const val = get(atom);
          if (val instanceof Promise) {
            val.catch(() => void 0);
          }
          fn();
        }),
      ),
    () => store.get(atom),
  );
}

function useLoadableInternal<T, U extends Promise<Awaited<T>> | Awaited<T>>(
  signal: State<U> | Computed<U>,
  keepLastResolved: boolean,
): Loadable<T> {
  const promise: Promise<Awaited<T>> | Awaited<T> = useGetPromise(signal);
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
