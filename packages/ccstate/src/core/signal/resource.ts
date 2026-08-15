import type { AsyncSnapshot, Resource } from '../../../types/core/signal';
import type { ComputedState, Mutation, StoreContext } from '../../../types/core/store';
import { currentValue } from './signal';

function isSameSnapshot<T>(a: AsyncSnapshot<T>, b: AsyncSnapshot<T>): boolean {
  return a.status === b.status && Object.is(a.data, b.data) && Object.is(a.error, b.error);
}

type ResourceControllerState<T> = ComputedState<T | Promise<T>> & {
  resourcePromise?: Promise<T>;
  resourceRequestId?: number;
};

export function trackResource<T>(
  controllerState: ComputedState<T | Promise<T>>,
  resource$: Resource<T>,
  context: StoreContext,
  commit: (snapshot: AsyncSnapshot<T>, mutation?: Mutation) => void,
  mutation?: Mutation,
): void {
  const state = controllerState as ResourceControllerState<T>;
  const current = currentValue(resource$, context) ?? resource$.init;

  if (state.error !== undefined) {
    state.resourceRequestId = (state.resourceRequestId ?? 0) + 1;
    state.resourcePromise = undefined;
    const snapshot = { status: 'error' as const, data: current.data, error: state.error };
    if (!isSameSnapshot(current, snapshot)) commit(snapshot, mutation);
    return;
  }

  const value = state.val;
  if (!(value instanceof Promise)) {
    state.resourceRequestId = (state.resourceRequestId ?? 0) + 1;
    state.resourcePromise = undefined;
    const snapshot = { status: 'success' as const, data: value, error: undefined };
    if (!isSameSnapshot(current, snapshot)) commit(snapshot, mutation);
    return;
  }

  if (state.resourcePromise === value) return;

  state.resourcePromise = value;
  const requestId = (state.resourceRequestId ?? 0) + 1;
  state.resourceRequestId = requestId;

  const loading = { status: 'loading' as const, data: current.data, error: undefined };
  if (!isSameSnapshot(current, loading)) commit(loading, mutation);

  void value.then(
    (data) => {
      const latest = context.stateMap.get(resource$.controller) as ResourceControllerState<T> | undefined;
      if (!latest || latest.resourceRequestId !== requestId || latest.resourcePromise !== value) return;

      const snapshot = { status: 'success' as const, data, error: undefined };
      const previous = currentValue(resource$, context) ?? resource$.init;
      if (!isSameSnapshot(previous, snapshot)) commit(snapshot);
    },
    (error: unknown) => {
      const latest = context.stateMap.get(resource$.controller) as ResourceControllerState<T> | undefined;
      if (!latest || latest.resourceRequestId !== requestId || latest.resourcePromise !== value) return;

      const previous = currentValue(resource$, context) ?? resource$.init;
      const snapshot = { status: 'error' as const, data: previous.data, error };
      if (!isSameSnapshot(previous, snapshot)) commit(snapshot);
    },
  );
}

export function invalidateResource<T>(resource$: Resource<T>, context: StoreContext): void {
  const state = context.stateMap.get(resource$.controller) as ResourceControllerState<T> | undefined;
  if (!state) return;

  state.resourceRequestId = (state.resourceRequestId ?? 0) + 1;
  state.resourcePromise = undefined;
}
