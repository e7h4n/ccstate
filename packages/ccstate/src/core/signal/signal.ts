import type { Computed, Signal } from '../../../types/core/signal';
import type { StoreContext } from '../../../types/core/store';

export function currentValue<T>(signal: Signal<T>, context: StoreContext): T | undefined {
  return context.stateMap.get(signal)?.val as T | undefined;
}

export function shouldDistinct<T>(signal: Signal<T>, value: T, context: StoreContext) {
  return currentValue(signal, context) === value;
}

export function shouldDistinctError(signal: Computed<unknown>, context: StoreContext) {
  const currentState = context.stateMap.get(signal);
  if (!currentState) {
    return false;
  }

  if ('error' in currentState && currentState.error !== undefined) {
    return true;
  }

  return false;
}
