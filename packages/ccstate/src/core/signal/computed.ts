import type { Computed, Getter, Signal } from '../../../types/core/signal';
import type {
  ComputedState,
  Mount,
  Mutation,
  ReadComputed,
  ReadSignal,
  StoreContext,
  Unmount,
} from '../../../types/core/store';
import { withGeValInterceptor } from '../interceptor';
import { canReadAsCompute } from '../typing-util';
import { shouldDistinct } from './signal';

function checkEpoch<T>(
  readComputed: ReadComputed,
  computedState: ComputedState<T>,
  context: StoreContext,
  mutation?: Mutation,
): boolean {
  for (const [dep, epoch] of computedState.dependencies.entries()) {
    const depEpoch = canReadAsCompute(dep)
      ? readComputed(dep, context, mutation).epoch
      : context.stateMap.get(dep)?.epoch;

    if (depEpoch !== epoch) {
      return false;
    }
  }

  return true;
}

export function tryGetCached<T>(
  readComputed: ReadComputed,
  computed$: Computed<T>,
  context: StoreContext,
  mutation?: Mutation,
): ComputedState<T> | undefined {
  const signalState = context.stateMap.get(computed$) as ComputedState<T> | undefined;
  if (!signalState) {
    return undefined;
  }

  if (!mutation?.dirtyMarkers.has(computed$.id) && signalState.mounted) {
    return signalState;
  }

  if (checkEpoch(readComputed, signalState, context, mutation)) {
    if (mutation?.dirtyMarkers.has(computed$.id)) {
      mutation.dirtyMarkers.delete(computed$.id);
    }
    return signalState;
  }

  return undefined;
}

function wrapGet<T>(
  readSignal: ReadSignal,
  mount: Mount,
  callerComputed$: Computed<T>,
  callerState: ComputedState<T>,
  context: StoreContext,
  mutation?: Mutation,
): [Getter, Map<Signal<unknown>, number>] {
  const readDeps = new Map<Signal<unknown>, number>();

  return [
    (dep$) => {
      const depState = readSignal(dep$, context, mutation);

      if (callerState.dependencies === readDeps) {
        readDeps.set(dep$, depState.epoch);

        const callerMounted = !!callerState.mounted;
        if (callerMounted && !depState.mounted) {
          mount(dep$, context, mutation).readDepts.add(callerComputed$);
        } else if (callerMounted && depState.mounted) {
          depState.mounted.readDepts.add(callerComputed$);
        }
      }

      return depState.val;
    },
    readDeps,
  ];
}

function getOrInitComputedState<T>(computed$: Computed<T>, context: StoreContext): ComputedState<T> {
  let computedState: ComputedState<T> | undefined = context.stateMap.get(computed$) as ComputedState<T> | undefined;
  if (!computedState) {
    computedState = {
      dependencies: new Map<Signal<unknown>, number>(),
      epoch: -1,
    } as ComputedState<T>;
    context.stateMap.set(computed$, computedState);
  }

  return computedState;
}

function cleanupMissingDependencies<T>(
  unmount: Unmount,
  computed$: Computed<T>,
  lastDeps: Map<Signal<unknown>, number>,
  currDeps: Map<Signal<unknown>, number>,
  context: StoreContext,
  mutation?: Mutation,
) {
  for (const key of lastDeps.keys()) {
    if (!currDeps.has(key)) {
      const depState = context.stateMap.get(key);
      depState?.mounted?.readDepts.delete(computed$);
      unmount(key, context, mutation);
    }
  }
}

export function evaluateComputed<T>(
  readSignal: ReadSignal,
  mount: Mount,
  unmount: Unmount,
  computed$: Computed<T>,
  context: StoreContext,
  mutation?: Mutation,
): ComputedState<T> {
  const computedState = getOrInitComputedState(computed$, context);

  const lastDeps = computedState.dependencies;

  const [_get, dependencies] = wrapGet(readSignal, mount, computed$, computedState, context, mutation);
  computedState.dependencies = dependencies;

  const evalVal = computed$.read(
    function <U>(depAtom: Signal<U>) {
      return withGeValInterceptor(() => _get(depAtom), depAtom, context.interceptor?.get);
    },
    {
      get signal() {
        computedState.abortController?.abort(`abort ${computed$.debugLabel ?? 'anonymous'} atom`);
        computedState.abortController = new AbortController();
        return computedState.abortController.signal;
      },
    },
  );

  cleanupMissingDependencies(unmount, computed$, lastDeps, dependencies, context, mutation);

  if (!shouldDistinct(computed$, evalVal, context)) {
    computedState.val = evalVal;
    computedState.epoch += 1;
  }

  return computedState;
}
