import type { Command, State, Computed, Signal, Updater, StateArg, Getter, Setter } from '../../../types/core/signal';
import type { Mutation, ReadComputed, StoreContext, StoreGet, SetArgs } from '../../../types/core/store';
import { shouldDistinct } from '../signal/signal';
import { withSetInterceptor } from '../interceptor';

type Flush = (context: StoreContext) => void;

// Writes mark the current mounted graph, but do not evaluate it. Repeated
// invalidations must still mark nodes whose dirty flag an eager get cleared.
function markDirty(dependents: Set<Computed<unknown>>, context: StoreContext, mutation: Mutation) {
  let queue = Array.from(dependents);
  while (queue.length) {
    const next: Computed<unknown>[] = [];
    for (const computed$ of queue) {
      // Jotai likewise stops at an already invalidated node (#2950). An
      // eager read clears this flag, so a later write can invalidate it again.
      if (mutation.potentialDirtyIds.has(computed$.id)) continue;
      const computedState = context.stateMap.get(computed$);
      if (!mutation.oldEpochs.has(computed$)) mutation.oldEpochs.set(computed$, computedState?.epoch);
      mutation.potentialDirtyIds.add(computed$.id);
      for (const dep of computedState?.mounted?.readDepts ?? []) next.push(dep);
    }
    queue = next;
  }
}

function pullEvaluate(
  readComputed: ReadComputed,
  dependents: Set<Computed<unknown>>,
  context: StoreContext,
  mutation: Mutation,
) {
  let queue = Array.from(dependents);
  const visited = new Set<Computed<unknown>>();
  while (queue.length) {
    const next: Computed<unknown>[] = [];
    for (const computed$ of queue) {
      if (visited.has(computed$)) continue;
      visited.add(computed$);
      const current = readComputed(computed$, context, mutation);
      // Newly mounted roots already computed their initial value and must not
      // receive an initial notification merely because an earlier write exists.
      if (!mutation.oldEpochs.has(computed$) || mutation.oldEpochs.get(computed$) === current.epoch) continue;
      context.changedSignals.add(computed$);
      for (const dep of current.mounted?.readDepts ?? []) next.push(dep);
    }
    queue = next;
  }
}

function getPendingMutation(context: StoreContext): Mutation {
  // Like Jotai's store-owned invalidation collections, reuse cleared work
  // buffers. Evaluation dependency Maps and AbortSignal owners are not reused.
  return (context.pendingMutation ??= context.mutationWork ??=
    {
      potentialDirtyIds: new Set(),
      oldEpochs: new Map(),
      changedSources: new Set(),
      flushing: false,
    });
}

export function flushMutation(readComputed: ReadComputed, context: StoreContext): boolean {
  const mutation = context.pendingMutation;
  if (!mutation) return true;
  // A computed's old AbortSignal can synchronously cause a write while the new
  // evaluation is being constructed. Finish that graph before firing listeners.
  if (mutation.flushing) return false;
  mutation.flushing = true;
  try {
    while (mutation.changedSources.size) {
      const sources = Array.from(mutation.changedSources);
      mutation.changedSources.clear();
      for (const source of sources) {
        const dependents = context.stateMap.get(source)?.mounted?.readDepts;
        if (dependents?.size) pullEvaluate(readComputed, dependents, context, mutation);
      }
    }
    mutation.potentialDirtyIds.clear();
    mutation.oldEpochs.clear();
    if (context.pendingMutation === mutation) context.pendingMutation = undefined;
    return true;
  } finally {
    mutation.flushing = false;
  }
}

function setState<T>(signal$: State<T>, context: StoreContext, value: StateArg<T>) {
  let next: T;
  if (typeof value === 'function') {
    const updaterState = context.stateMap.get(signal$);
    next = (value as Updater<T>)(updaterState ? (updaterState.val as T) : signal$.init);
  } else {
    next = value;
  }
  if (shouldDistinct(signal$, next, context)) return;
  context.writeVersion += 1;
  // Updaters are user code and can subscribe or write before returning.
  // Preserve the state object/mounted listeners established during that call.
  const oldState = context.stateMap.get(signal$);
  if (oldState) {
    oldState.val = next;
    oldState.epoch += 1;
  } else {
    context.stateMap.set(signal$, { val: next, epoch: 0 });
  }
  // Like Jotai changedAtoms, this records real state changes even without a
  // listener, and is also the public set entry's flush-work checkpoint.
  context.changedSignals.add(signal$);
  const dependents = oldState?.mounted?.readDepts;
  if (dependents?.size) {
    const mutation = getPendingMutation(context);
    mutation.changedSources.add(signal$);
    markDirty(dependents, context, mutation);
  }
}

export function set<T, Args extends SetArgs<T, unknown[]>>(
  readComputed: ReadComputed,
  writable$: State<T> | Command<T, Args>,
  context: StoreContext,
  get: StoreGet,
  flush: Flush,
  ...args: Args
): undefined | T {
  if ('read' in writable$) return;
  if (!('write' in writable$)) {
    setState(writable$, context, args[0]);
    return;
  }
  let isSync = true;
  const visitor: { get: Getter; set: Setter } = {
    get: <U>(signal$: Signal<U>) => get(signal$, context),
    set: <U, Params extends SetArgs<U, unknown[]>>(
      child: State<U> | Command<U, Params>,
      ...innerArgs: Params
    ): undefined | U => {
      try {
        return withSetInterceptor(
          () => set<U, Params>(readComputed, child, context, get, flush, ...innerArgs),
          child,
          context.interceptor?.set,
          ...innerArgs,
        );
      } finally {
        // Each write invocation owns this flag. Returning a Promise (or the
        // setter itself) ends its synchronous phase, just as in Jotai.
        if (!isSync) flush(context);
      }
    },
  };
  try {
    return writable$.write(visitor, ...args);
  } finally {
    isSync = false;
  }
}
