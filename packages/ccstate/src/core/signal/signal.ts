import type { Signal } from '../../../types/core/signal';
import type { StoreContext } from '../../../types/core/store';

export function shouldDistinct<T>(signal: Signal<T>, value: T, context: StoreContext) {
  return context.stateMap.get(signal)?.val === value;
}
