import type { Computed, Signal } from '../../types/core/signal';
import type { ComputedState, SignalState } from '../../types/core/store';

export function canReadAsCompute<T>(atom: Signal<T>): atom is Computed<T> {
  return 'read' in atom;
}

export function isComputedState<T>(state: SignalState<T>): state is ComputedState<T> {
  return 'dependencies' in state;
}
