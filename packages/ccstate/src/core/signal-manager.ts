import type { Signal, Command, Getter, State, Updater, Setter, Computed } from '../../types/core/signal';
import type { StoreInterceptor, SubscribeOptions } from '../../types/core/store';
import {
  withComputedInterceptor,
  withGetInterceptor,
  withGeValInterceptor,
  withNotifyInterceptor,
  withSetInterceptor,
  withSubInterceptor,
  withUnsubInterceptor,
} from './interceptor';
import { canReadAsCompute, isComputedState } from './typing-util';

export interface StoreContext {
  stateMap: StateMap;
  interceptor?: StoreInterceptor;
}

interface Mutation {
  dirtyMarkers: Set<number>;
  pendingListeners: Set<Command<unknown, []>>;
}

export interface StateState<T> {
  mounted?: Mounted;
  val: T;
  epoch: number;
}

export interface ComputedState<T> {
  mounted?: Mounted;
  val: T;
  dependencies: Map<Signal<unknown>, number>;
  epoch: number;
  abortController?: AbortController;
}

export type SignalState<T> = StateState<T> | ComputedState<T>;
export type StateMap = WeakMap<Signal<unknown>, SignalState<unknown>>;

interface Mounted {
  listeners: Set<Command<unknown, []>>;
  readDepts: Set<Computed<unknown>>;
}

function tryGetCached<T>(
  computed$: Computed<T>,
  context: StoreContext,
  mutation?: Mutation,
): ComputedState<T> | undefined {
  const signalState = context.stateMap.get(computed$) as ComputedState<T> | undefined;
  if (!signalState) {
    return undefined;
  }

  if (mutation?.dirtyMarkers.has(computed$.id)) {
    return undefined;
  }

  if (signalState.mounted) {
    return signalState;
  }

  for (const [dep, epoch] of signalState.dependencies.entries()) {
    const depState = readSignalState(dep, context, mutation);
    if (depState.epoch !== epoch) {
      return undefined;
    }
  }

  return signalState;
}

function readComputed<T>(computed$: Computed<T>, context: StoreContext, mutation?: Mutation): ComputedState<T> {
  const cachedState = tryGetCached(computed$, context, mutation);
  if (cachedState) {
    return cachedState;
  }

  mutation?.dirtyMarkers.delete(computed$.id);

  return withComputedInterceptor(
    () => {
      return evaluateComputed(computed$, context, mutation);
    },
    computed$,
    context.interceptor?.computed,
  );
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

function wrapGet<T>(
  callerComputed$: Computed<T>,
  callerState: ComputedState<T>,
  context: StoreContext,
  mutation?: Mutation,
): [Getter, Map<Signal<unknown>, number>] {
  const readDeps = new Map<Signal<unknown>, number>();

  return [
    (dep$) => {
      const depState = readSignalState(dep$, context, mutation);

      if (callerState.dependencies === readDeps) {
        readDeps.set(dep$, depState.epoch);

        const callerMounted = !!callerState.mounted;
        if (callerMounted && !depState.mounted) {
          tryMount(dep$, context, mutation).readDepts.add(callerComputed$);
        } else if (callerMounted && depState.mounted) {
          depState.mounted.readDepts.add(callerComputed$);
        }
      }

      return depState.val;
    },
    readDeps,
  ];
}

function cleanupMissingDependencies<T>(
  computed$: Computed<T>,
  lastDeps: Map<Signal<unknown>, number>,
  currDeps: Map<Signal<unknown>, number>,
  context: StoreContext,
  mutation?: Mutation,
) {
  for (const key of lastDeps.keys()) {
    if (!currDeps.has(key)) {
      const depState = context.stateMap.get(key);
      if (depState?.mounted) {
        depState.mounted.readDepts.delete(computed$);
        tryUnmount(key, context, mutation);
      }
    }
  }
}

function evaluateComputed<T>(computed$: Computed<T>, context: StoreContext, mutation?: Mutation): ComputedState<T> {
  const computedState = getOrInitComputedState(computed$, context);

  const lastDeps = computedState.dependencies;

  const [wrappedGet, dependencies] = wrapGet(computed$, computedState, context, mutation);
  computedState.dependencies = dependencies;

  const evalVal = computed$.read(
    function <U>(depAtom: Signal<U>) {
      return withGeValInterceptor(() => wrappedGet(depAtom), depAtom, context.interceptor?.get);
    },
    {
      get signal() {
        computedState.abortController?.abort(`abort ${computed$.debugLabel ?? 'anonymous'} atom`);
        computedState.abortController = new AbortController();
        return computedState.abortController.signal;
      },
    },
  );

  cleanupMissingDependencies(computed$, lastDeps, dependencies, context, mutation);

  computedState.val = evalVal;
  computedState.epoch += 1;

  return computedState;
}

function readStateAtom<T>(state: State<T>, context: StoreContext): StateState<T> {
  const atomState = context.stateMap.get(state);
  if (!atomState) {
    const initState = {
      val: state.init,
      epoch: 0,
    };
    context.stateMap.set(state, initState);
    return initState as StateState<T>;
  }

  return atomState as StateState<T>;
}

export function readSignalState<T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation): SignalState<T> {
  if (canReadAsCompute(signal$)) {
    return readComputed(signal$, context, mutation);
  }

  return readStateAtom(signal$, context);
}

function didMount<T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation): Mounted {
  context.interceptor?.mount?.(signal$);

  const signalState = readSignalState(signal$, context, mutation);

  signalState.mounted = signalState.mounted ?? {
    listeners: new Set(),
    readDepts: new Set(),
  };

  if (isComputedState(signalState)) {
    for (const [dep] of Array.from(signalState.dependencies)) {
      const mounted = tryMount(dep, context, mutation);
      mounted.readDepts.add(signal$ as Computed<unknown>);
    }
  }

  return signalState.mounted;
}

function tryMount<T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation): Mounted {
  const mounted = context.stateMap.get(signal$)?.mounted;
  if (mounted) {
    return mounted;
  }

  return didMount(signal$, context, mutation);
}

function didUnmount<T>(
  signal$: Signal<T>,
  signalState: SignalState<T>,
  context: StoreContext,
  mutation?: Mutation,
): void {
  context.interceptor?.unmount?.(signal$);

  if (isComputedState(signalState)) {
    for (const [dep] of Array.from(signalState.dependencies)) {
      const depState = readSignalState(dep, context, mutation);
      depState.mounted?.readDepts.delete(signal$ as Computed<unknown>);
      tryUnmount(dep, context, mutation);
    }
  }

  signalState.mounted = undefined;
}

function tryUnmount<T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation): void {
  const signalState = context.stateMap.get(signal$);
  if (!signalState?.mounted || signalState.mounted.listeners.size || signalState.mounted.readDepts.size) {
    return;
  }

  didUnmount(signal$, signalState, context, mutation);
}

function subSingleSignal<T>(
  signal$: Signal<T>,
  callback$: Command<unknown, []>,
  context: StoreContext,
  signal: AbortSignal,
) {
  withSubInterceptor(
    () => {
      const mounted = tryMount(signal$, context);
      mounted.listeners.add(callback$);

      const unmount = () => {
        withUnsubInterceptor(
          () => {
            mounted.listeners.delete(callback$);

            if (mounted.readDepts.size === 0 && mounted.listeners.size === 0) {
              tryUnmount(signal$, context);
            }
          },
          signal$,
          callback$,
          context.interceptor?.unsub,
        );
      };

      signal.addEventListener('abort', unmount, {
        once: true,
      });
    },
    signal$,
    callback$,
    context.interceptor?.sub,
  );
}

export function sub<T>(
  signals$: Signal<T>[] | Signal<T>,
  callback$: Command<unknown, []>,
  context: StoreContext,
  options?: SubscribeOptions,
): () => void {
  if (Array.isArray(signals$) && signals$.length === 0) {
    return () => void 0;
  }

  const controller = new AbortController();
  const signal = options?.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;

  if (!Array.isArray(signals$)) {
    subSingleSignal(signals$, callback$, context, signal);
  } else {
    signals$.forEach((atom) => {
      subSingleSignal(atom, callback$, context, signal);
    });
  }

  return () => {
    controller.abort();
  };
}

export function get<T>(signal: Signal<T>, context: StoreContext, mutation?: Mutation): T {
  return withGetInterceptor(
    () => {
      return readSignalState(signal, context, mutation).val;
    },
    signal,
    context.interceptor?.get,
  );
}

function wrapVisitor(context: StoreContext, mutation: Mutation) {
  const wrappedGet: Getter = <T>(signal: Signal<T>) => {
    return get(signal, context, mutation);
  };

  const wrappedSet: Setter = <T, Args extends unknown[]>(
    signal: State<T> | Command<T, Args>,
    ...args: [T | Updater<T>] | Args
  ): undefined | T => {
    return set<T, Args>(signal, context, ...args);
  };

  return {
    get: wrappedGet,
    set: wrappedSet,
  };
}

function innerSetState<T>(signal$: State<T>, context: StoreContext, mutation: Mutation, val: T | Updater<T>) {
  const newValue: T =
    typeof val === 'function' ? (val as Updater<T>)(readSignalState(signal$, context, mutation).val) : val;

  if (!context.stateMap.has(signal$)) {
    context.stateMap.set(signal$, {
      val: newValue,
      epoch: 0,
    });
    return;
  }

  const signalState = readStateAtom(signal$, context);

  signalState.val = newValue;
  signalState.epoch += 1;
  pushPullStateChange(signalState, context, mutation);

  return undefined;
}

function innerSet<T, Args extends unknown[]>(
  writable$: State<T> | Command<T, Args>,
  context: StoreContext,
  mutation: Mutation,
  ...args: [T | Updater<T>] | Args
): undefined | T {
  if ('read' in writable$) {
    return;
  }

  if ('write' in writable$) {
    return writable$.write(wrapVisitor(context, mutation), ...(args as Args));
  }

  innerSetState(writable$, context, mutation, args[0]);
  return;
}

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

function pullEvaluate(signalState: StateState<unknown>, context: StoreContext, mutation: Mutation) {
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

function pushPullStateChange(signalState: StateState<unknown>, context: StoreContext, mutation: Mutation) {
  pushDirtyMarkers(signalState, context, mutation);
  pullEvaluate(signalState, context, mutation);
}

export function set<T, Args extends unknown[]>(
  atom: State<T> | Command<T, Args>,
  context: StoreContext,
  ...args: [T | Updater<T>] | Args
): undefined | T {
  const ret = withSetInterceptor(
    () => {
      let ret: T | undefined;
      const mutation: Mutation = {
        dirtyMarkers: new Set(),
        pendingListeners: new Set(),
      };

      try {
        ret = innerSet(atom, context, mutation, ...args) as T | undefined;
      } finally {
        notify(context, mutation);
      }
      return ret;
    },
    atom,
    context.interceptor?.set,
    ...args,
  ) as T;
  return ret;
}

function notify(context: StoreContext, mutation: Mutation) {
  const pendingListeners = mutation.pendingListeners;
  mutation.pendingListeners = new Set();

  for (const listener of pendingListeners) {
    withNotifyInterceptor(
      () => {
        return listener.write(wrapVisitor(context, mutation));
      },
      listener,
      context.interceptor?.notify,
    );
  }
}
