import type { Effect, Signal } from '../../../types/core/signal';
import type { ReadSignal, StoreContext, StoreSet } from '../../../types/core/store';

export function mountEffect(
  readSignal: ReadSignal,
  set: StoreSet,
  effect: Effect,
  context: StoreContext,
  options?: { signal?: AbortSignal },
) {
  if (context.effectMap.has(effect)) {
    throw new Error('Effect is already mounted');
  }

  const ctrl = new AbortController();
  options?.signal?.addEventListener('abort', () => {
    context.effectMap.delete(effect);
  });
  context.effectMap.set(effect, {
    abortController: ctrl,
  });

  const wrappedGet = <T>(dep$: Signal<T>): T => {
    const depState = readSignal(dep$, context);

    return depState.val as T;
  };

  const signal = AbortSignal.any([options?.signal ?? ctrl.signal]);

  effect(
    {
      get: wrappedGet,
      set,
    },
    signal,
  );
}
