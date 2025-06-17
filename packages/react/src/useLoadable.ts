import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { command, type Computed, type State } from 'ccstate';
import { useStore } from './provider';

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

/**
 * Handles a specific behavior of useSyncExternalStore. In React, there are situations where the getSnapshot function of
 * useSyncExternalStore executes, but the Render function doesn't execute.
 *
 * This can cause the promise generated in that round to not be caught, and userspace has no opportunity to handle this
 * promise. Therefore, this issue needs to be handled in useGetPromise.
 *
 * @param atom
 * @returns
 */
function useGetPromise<T, U extends Promise<T> | T>(atom: State<U> | Computed<U>): [U, () => void] {
  const store = useStore();
  const lastPromise = useRef<Promise<unknown> | undefined>(undefined);
  const promiseProcessed = useRef(false);

  const promise = useSyncExternalStore(
    (fn) => store.sub(atom, command(fn)),
    () => {
      const val = store.get(atom);

      // If the last promise is not processed and the current value is a promise,
      // we need to silence the last promise to avoid unhandled rejections.
      if (lastPromise.current !== undefined && lastPromise.current !== val && !promiseProcessed.current) {
        lastPromise.current.catch(() => void 0);
      }

      if (lastPromise.current !== val) {
        promiseProcessed.current = false;
        lastPromise.current = val instanceof Promise ? val : undefined;
      }

      return val;
    },
  );

  return [
    promise,
    () => {
      promiseProcessed.current = true;
    },
  ];
}

function useLoadableInternal<T>(
  atom: State<Promise<T> | T> | Computed<Promise<T> | T>,
  keepLastResolved: boolean,
): Loadable<T> {
  const [promise, setPromiseProcessed] = useGetPromise(atom);
  const [promiseResult, setPromiseResult] = useState<Loadable<T>>({
    state: 'loading',
  });

  useEffect(() => {
    if (!(promise instanceof Promise)) {
      setPromiseResult({
        state: 'hasData',
        data: promise,
      });

      return;
    }

    let cancelled = false;

    if (!keepLastResolved) {
      setPromiseResult({
        state: 'loading',
      });
    }

    setPromiseProcessed();

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
): Loadable<Awaited<T>> {
  return useLoadableInternal(atom, false);
}

export function useLastLoadable<T>(
  atom: State<Promise<Awaited<T>> | Awaited<T>> | Computed<Promise<Awaited<T>> | Awaited<T>>,
): Loadable<Awaited<T>> {
  return useLoadableInternal(atom, true);
}
