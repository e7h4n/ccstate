import type { Computed, Resource, Signal } from '../../types/core/signal';
import type { ComputedState, SignalState } from '../../types/core/store';

export function canReadAsCompute<T>(atom: Signal<T>): atom is Computed<T> {
  return 'read' in atom;
}

export function isResource<T>(atom: Signal<T>): atom is Extract<Signal<T>, Resource<unknown>> {
  return 'source' in atom;
}

export function isResourceController<T>(atom: Computed<T>): atom is Computed<T> & { resource: Resource<Awaited<T>> } {
  return 'resource' in atom;
}

export function isComputedState<T>(state: SignalState<T>): state is ComputedState<T> {
  return 'dependencies' in state;
}
