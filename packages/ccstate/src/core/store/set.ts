import type { Command, State, Updater, Computed, Signal } from '../../../types/core/signal';
import type {
  Mutation,
  ReadComputed,
  StoreContext,
  StateState,
  StoreGet,
  StoreSet,
  SetArgs,
} from '../../../types/core/store';

function pushDirtyMarkers(signalState: StateState<unknown>, context: StoreContext, mutation: Mutation) {
  let queue: Computed<unknown>[] = Array.from(signalState.mounted?.readDepts ?? []);

  while (queue.length > 0) {
    const nextQueue: Computed<unknown>[] = [];
    for (const computed$ of queue) {
      mutation.dirtyMarkers.add(computed$.id);

      const computedState = context.stateMap.get(computed$);
      // This computed$ is read from other computed$'s readDepts, so it must not be null and must have mounted
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      for (const dep of computedState!.mounted!.readDepts) {
        nextQueue.push(dep);
      }
    }

    queue = nextQueue;
  }
}

function pullEvaluate(
  readComputed: ReadComputed,
  signalState: StateState<unknown>,
  context: StoreContext,
  mutation: Mutation,
) {
  let queue: Computed<unknown>[] = Array.from(signalState.mounted?.readDepts ?? []);

  for (const listener of signalState.mounted?.listeners ?? []) {
    mutation.pendingListeners.add(listener);
  }

  while (queue.length > 0) {
    const nextQueue: Computed<unknown>[] = [];
    for (const computed$ of queue) {
      const computedState = readComputed(computed$, context, mutation);

      if (computedState.mounted?.listeners) {
        for (const listener of computedState.mounted.listeners) {
          mutation.pendingListeners.add(listener);
        }
      }

      const readDepts = computedState.mounted?.readDepts;
      if (readDepts) {
        for (const dep of Array.from(readDepts)) {
          nextQueue.push(dep);
        }
      }
    }

    queue = nextQueue;
  }
}

function propagationChanges(
  readComputed: ReadComputed,
  signalState: StateState<unknown>,
  context: StoreContext,
  mutation: Mutation,
) {
  pushDirtyMarkers(signalState, context, mutation);
  pullEvaluate(readComputed, signalState, context, mutation);
}

function innerSetState<T>(
  readComputed: ReadComputed,
  signal$: State<T>,
  context: StoreContext,
  mutation: Mutation,
  val: T | Updater<T>,
) {
  const newValue: T =
    typeof val === 'function'
      ? (val as Updater<T>)((context.stateMap.get(signal$)?.val as T | undefined) ?? signal$.init)
      : val;

  const signalState = context.stateMap.get(signal$);
  if (!signalState) {
    context.stateMap.set(signal$, {
      val: newValue,
      epoch: 0,
    });
    return;
  }

  signalState.val = newValue;
  signalState.epoch += 1;
  propagationChanges(readComputed, signalState, context, mutation);

  return undefined;
}

export function set<T, Args extends SetArgs<T, unknown[]>>(
  readComputed: ReadComputed,
  writable$: State<T> | Command<T, Args>,
  context: StoreContext,
  mutation: Mutation,
  ...args: Args
): undefined | T {
  if ('read' in writable$) {
    return;
  }

  if ('write' in writable$) {
    return writable$.write(mutation.visitor, ...args);
  }

  innerSetState(readComputed, writable$, context, mutation, args[0]);
  return;
}

/**
 * Creates a mutation operation context. The Mutation remains unique throughout
 * the mutation cycle and can track side effects produced by this mutation operation
 *
 * This tracking is implemented by coloring the visitor function, so the Mutation
 * needs to wrap get & set functions and ensure that all get & set operations
 * executed in the mutation context come from the same Mutation
 *
 * @param context
 * @param get
 * @param set
 * @returns
 */
export function createMutation(context: StoreContext, get: StoreGet, set: StoreSet): Mutation {
  const mutation: Mutation = {
    dirtyMarkers: new Set(),
    pendingListeners: new Set(),
    visitor: {
      get: <T>(signal$: Signal<T>) => {
        return get(signal$, context, mutation);
      },
      set: <T, Args extends SetArgs<T, unknown[]>>(
        signal$: State<T> | Command<T, Args>,
        ...args: Args
      ): undefined | T => {
        return set<T, Args>(signal$, context, ...args);
      },
    },
  };

  return mutation;
}
