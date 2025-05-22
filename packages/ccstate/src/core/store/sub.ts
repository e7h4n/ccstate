import type { Command, Computed, Signal } from '../../../types/core/signal';
import type {
  ComputedState,
  Mounted,
  Mutation,
  ReadSignal,
  SignalState,
  StoreContext,
} from '../../../types/core/store';
import { withNotifyInterceptor, withSubInterceptor, withUnsubInterceptor } from '../interceptor';
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
    listeners: new Set(),
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
  if (!signalState?.mounted || signalState.mounted.listeners.size || signalState.mounted.readDepts.size) {
    return;
  }

  doUnmount(signal$, signalState, context, mutation);
}

export function subSingleSignal<T>(
  readSignal: ReadSignal,
  signal$: Signal<T>,
  callback$: Command<unknown, []>,
  context: StoreContext,
  signal: AbortSignal,
) {
  withSubInterceptor(
    () => {
      const mounted = mount(readSignal, signal$, context);
      mounted.listeners.add(callback$);

      const unsub = () => {
        withUnsubInterceptor(
          () => {
            mounted.listeners.delete(callback$);

            if (mounted.readDepts.size === 0 && mounted.listeners.size === 0) {
              unmount(signal$, context);
            }
          },
          signal$,
          callback$,
          context.interceptor?.unsub,
        );
      };

      signal.addEventListener('abort', unsub, {
        once: true,
      });
    },
    signal$,
    callback$,
    context.interceptor?.sub,
  );
}

export function notify(context: StoreContext, mutation: Mutation) {
  const pendingListeners = mutation.pendingListeners;

  mutation.pendingListeners = new Set();

  for (const listener of pendingListeners) {
    withNotifyInterceptor(
      () => {
        return listener.write(mutation.visitor);
      },
      listener,
      context.interceptor?.notify,
    );
  }
}
