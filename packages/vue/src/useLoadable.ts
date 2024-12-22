import { useGet } from './useGet';
import type { Computed, State } from 'ccstate';
import { shallowReadonly, shallowRef, watch, type ShallowRef } from 'vue';

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
): Readonly<ShallowRef<Loadable<T>>> {
  const promise = useGet(atom);
  const loadable = shallowRef<Loadable<T>>({
    state: 'loading',
  });

  watch(
    promise,
    (promiseValue, _, onCleanup) => {
      const ctrl = new AbortController();
      onCleanup(() => {
        ctrl.abort();
      });

      if (!keepLastResolved) {
        loadable.value = {
          state: 'loading',
        };
      }

      void promiseValue
        .then((ret) => {
          if (ctrl.signal.aborted) return;

          loadable.value = {
            state: 'hasData',
            data: ret,
          };
        })
        .catch(() => void 0);

      void promiseValue.catch((error: unknown) => {
        if (ctrl.signal.aborted) return;

        loadable.value = {
          state: 'hasError',
          error,
        };
      });
    },
    {
      immediate: true,
    },
  );

  return shallowReadonly(loadable);
}

export function useLoadable<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Readonly<ShallowRef<Loadable<T>>> {
  return useLoadableInternal(atom, false);
}

export function useLastLoadable<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Readonly<ShallowRef<Loadable<T>>> {
  return useLoadableInternal(atom, true);
}
