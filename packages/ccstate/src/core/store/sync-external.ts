import type { ExternalEffect, Signal } from '../../../types/core/signal';
import type { ReadSignal, StoreContext } from '../../../types/core/store';

export function syncExternal(
  readSignal: ReadSignal,
  externalEffect: ExternalEffect,
  context: StoreContext,
  options?: { signal?: AbortSignal },
) {
  if (context.effectMap.has(externalEffect)) {
    throw new Error('Effect is already mounted');
  }

  const ctrl = new AbortController();
  options?.signal?.addEventListener('abort', () => {
    context.effectMap.delete(externalEffect);
  });
  context.effectMap.set(externalEffect, {
    abortController: ctrl,
  });

  const wrappedGet = <T>(dep$: Signal<T>): T => {
    const depState = readSignal(dep$, context);

    return depState.val as T;
  };

  let signal: AbortSignal | undefined;
  const effectOptions = {
    get signal() {
      if (!signal) {
        signal = AbortSignal.any([options?.signal ?? ctrl.signal]);
      }
      return signal;
    },
  };

  externalEffect(wrappedGet, effectOptions);
}
