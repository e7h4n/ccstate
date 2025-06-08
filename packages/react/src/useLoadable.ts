import { useEffect, useState } from 'react';
import { useGet } from './useGet';
import type { Computed, State } from 'ccstate';
import { useSet } from './useSet';
import { collectFloatingPromise$ } from './floating-promise';

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
  const collectFloatingPromise = useSet(collectFloatingPromise$);

  const [promiseResult, setPromiseResult] = useState<Loadable<T>>({
    state: 'loading',
  });

  useEffect(() => {
    const ctrl = new AbortController();
    const signal = ctrl.signal;

    const settledController = new AbortController();

    if (!keepLastResolved) {
      setPromiseResult({
        state: 'loading',
      });
    }

    collectFloatingPromise(
      promise.then(
        (ret) => {
          settledController.abort();
          if (signal.aborted) return;

          setPromiseResult({
            state: 'hasData',
            data: ret,
          });
        },
        (error: unknown) => {
          settledController.abort();
          if (signal.aborted) return;

          setPromiseResult({
            state: 'hasError',
            error,
          });
        },
      ),
      AbortSignal.any([signal, settledController.signal]),
    );

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
