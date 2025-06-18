import type { Computed, Getter, Signal } from '../../../types/core/signal';
import type {
  ComputedState,
  Mount,
  Mutation,
  ReadComputed,
  ReadOptions,
  ReadSignal,
  StoreContext,
  Unmount,
} from '../../../types/core/store';
import { withGeValInterceptor } from '../interceptor';
import { canReadAsCompute } from '../typing-util';
import { shouldDistinct, shouldDistinctError } from './signal';

function checkEpoch<T>(
  readComputed: ReadComputed,
  computedState: ComputedState<T>,
  context: StoreContext,
  readOptions?: ReadOptions,
): boolean {
  for (const [dep, epoch] of computedState.dependencies.entries()) {
    const depEpoch = canReadAsCompute(dep)
      ? readComputed(dep, context, readOptions).epoch
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
  readOptions?: ReadOptions,
): ComputedState<T> | undefined {
  const signalState = context.stateMap.get(computed$) as ComputedState<T> | undefined;
  if (!signalState) {
    return undefined;
  }

  // If a computed is marked as potentially dirty, we should perform a
  // thorough epoch check. Alternatively, we can check the mounted state since
  // a mounted computed is always re-evaluated immediately.
  const mayDirty = readOptions?.mutation?.potentialDirtyIds.has(computed$.id);
  if (!mayDirty && signalState.mounted) {
    return signalState;
  }

  if (checkEpoch(readComputed, signalState, context, readOptions)) {
    if (mayDirty) {
      readOptions?.mutation?.potentialDirtyIds.delete(computed$.id);
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
  readOptions?: ReadOptions,
): [Getter, Map<Signal<unknown>, number>] {
  const readDeps = new Map<Signal<unknown>, number>();

  return [
    (dep$) => {
      const depState = readSignal(dep$, context, readOptions);

      if (callerState.dependencies === readDeps) {
        readDeps.set(dep$, depState.epoch);

        const callerMounted = !!callerState.mounted;
        if (callerMounted && !depState.mounted) {
          mount(dep$, context, readOptions).readDepts.add(callerComputed$);
        } else if (callerMounted && depState.mounted) {
          depState.mounted.readDepts.add(callerComputed$);
        }
      }

      if ('error' in depState) {
        throw depState.error;
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

type ComputedResult<T> =
  | {
      value: T;
    }
  | {
      error: unknown;
    };

export function evaluateComputed<T>(
  readSignal: ReadSignal,
  mount: Mount,
  unmount: Unmount,
  computed$: Computed<T>,
  context: StoreContext,
  readOptions?: ReadOptions,
): ComputedState<T> {
  const computedState = getOrInitComputedState(computed$, context);

  const lastDeps = computedState.dependencies;

  const [_get, dependencies] = wrapGet(readSignal, mount, computed$, computedState, context, readOptions);
  computedState.dependencies = dependencies;

  let result: ComputedResult<T>;
  try {
    result = {
      value: computed$.read(
        function <U>(depAtom: Signal<U>) {
          return withGeValInterceptor(
            () => {
              return _get(depAtom);
            },
            depAtom,
            context.interceptor?.get,
          );
        },
        {
          get signal() {
            computedState.abortController?.abort(`abort ${computed$.debugLabel ?? 'anonymous'} atom`);
            computedState.abortController = new AbortController();
            return computedState.abortController.signal;
          },
        },
      ),
    };
  } catch (error) {
    result = {
      error,
    };
  }

  readOptions?.mutation?.potentialDirtyIds.delete(computed$.id);

  cleanupMissingDependencies(unmount, computed$, lastDeps, dependencies, context, readOptions?.mutation);

  if ('error' in result) {
    if (!shouldDistinctError(computed$, context)) {
      computedState.error = result.error;
      delete computedState.val;
      computedState.epoch += 1;
    }
  } else if (!shouldDistinct(computed$, result.value, context)) {
    computedState.val = result.value;
    delete computedState.error;
    computedState.epoch += 1;
  }

  return computedState;
}
