import type { Computed, Signal } from '../../../types/core/signal';
import type { StoreContext } from '../../../types/core/store';

export function shouldDistinct<T>(signal: Signal<T>, value: T, context: StoreContext) {
  const signalState = context.stateMap.get(signal);
  return !!signalState && 'val' in signalState && !('error' in signalState) && signalState.val === value;
}

export function shouldDistinctError(signal: Computed<unknown>, error: unknown, context: StoreContext) {
  const signalState = context.stateMap.get(signal);
  return !!signalState && 'error' in signalState && signalState.error === error;
}
