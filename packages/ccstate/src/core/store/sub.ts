import type { Computed, Signal } from '../../../types/core/signal';
import type {
  ComputedState,
  Mounted,
  Mutation,
  ReadSignal,
  SignalState,
  StoreContext,
} from '../../../types/core/store';
import { isComputedState } from '../typing-util';

function unmountComputedDependencies<T>(
  computed$: Computed<T>,
  computedState: ComputedState<T>,
  context: StoreContext,
  mutation?: Mutation,
) {
  for (const [dep] of Array.from(computedState.dependencies)) {
    context.stateMap.get(dep)?.mounted?.readDepts.delete(computed$ as Computed<unknown>);
    unmount(dep, context, mutation);
  }
}

function mountComputedDependencies<T>(
  readSignal: ReadSignal,
  computed$: Computed<T>,
  computedState: ComputedState<T>,
  context: StoreContext,
  mutation?: Mutation,
) {
  for (const [dep] of Array.from(computedState.dependencies)) {
    const mounted = mount(readSignal, dep, context, mutation);
    mounted.readDepts.add(computed$ as Computed<unknown>);
  }
}

function initMount<T>(readSignal: ReadSignal, signal$: Signal<T>, context: StoreContext, mutation?: Mutation): Mounted {
  context.interceptor?.mount?.(signal$);

  const signalState = readSignal(signal$, context, mutation);

  signalState.mounted = signalState.mounted ?? {
    readDepts: new Set(),
  };

  if (isComputedState(signalState)) {
    mountComputedDependencies(readSignal, signal$ as Computed<unknown>, signalState, context, mutation);
  }

  return signalState.mounted;
}

export function mount<T>(
  readSignal: ReadSignal,
  signal$: Signal<T>,
  context: StoreContext,
  mutation?: Mutation,
): Mounted {
  const mounted = context.stateMap.get(signal$)?.mounted;
  if (mounted) {
    return mounted;
  }

  return initMount(readSignal, signal$, context, mutation);
}

function doUnmount<T>(
  signal$: Signal<T>,
  signalState: SignalState<T>,
  context: StoreContext,
  mutation?: Mutation,
): void {
  context.interceptor?.unmount?.(signal$);

  if (isComputedState(signalState)) {
    unmountComputedDependencies(signal$ as Computed<unknown>, signalState, context, mutation);
  }

  signalState.mounted = undefined;
}

export function unmount<T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation): void {
  const signalState = context.stateMap.get(signal$);
  if (!signalState?.mounted || signalState.mounted.readDepts.size) {
    return;
  }

  doUnmount(signal$, signalState, context, mutation);
}
