import type { Signal, Command, Getter, State, Updater, Setter, Computed } from '../../types/core/atom';
import type { StoreInterceptor, SubscribeOptions } from '../../types/core/store';
import { canReadAsCompute, isComputedState } from './typing-util';

type DataWithCalledState<T> =
  | {
      called: false;
    }
  | {
      called: true;
      data: T;
    };

export interface Context {
  stateMap: StateMap;
  interceptor?: StoreInterceptor;
}

interface Batch {
  ignoreMounted?: boolean;
  pendingListeners: Set<Command<unknown, []>>;
}

export type SignalState<T> = StateState<T> | ComputedState<T>;
export type StateMap = WeakMap<Signal<unknown>, SignalState<unknown>>;

interface Mounted {
  listeners: Set<Command<unknown, []>>;
  readDepts: Set<Signal<unknown>>;
}

function tryGetCached<T>(computed: Computed<T>, context: Context, batch?: Batch): ComputedState<T> | undefined {
  const signalState = context.stateMap.get(computed) as ComputedState<T> | undefined;
  if (!signalState) {
    return undefined;
  }

  if (signalState.mounted && !batch?.ignoreMounted) {
    return signalState;
  }

  for (const [dep, epoch] of signalState.dependencies.entries()) {
    const depState = readSignalState(dep, context, batch);
    if (depState.epoch !== epoch) {
      return undefined;
    }
  }

  return signalState;
}

function readComputed<T>(computed: Computed<T>, context: Context, batch?: Batch): ComputedState<T> {
  const cachedState = tryGetCached(computed, context, batch);
  if (cachedState) {
    return cachedState;
  }

  const computedInterceptor = context.interceptor?.computed;
  if (!computedInterceptor) {
    return computeComputedAtom(computed, context, batch);
  }

  let result: DataWithCalledState<ComputedState<T>> = {
    called: false,
  } as DataWithCalledState<ComputedState<T>>;

  computedInterceptor(computed, () => {
    result = {
      called: true,
      data: computeComputedAtom(computed, context, batch),
    };

    return result.data.val;
  });

  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }

  return result.data;
}

function computeComputedAtom<T>(atom: Computed<T>, context: Context, batch?: Batch): ComputedState<T> {
  const self: Computed<T> = atom;
  let atomState: ComputedState<T> | undefined = context.stateMap.get(self) as ComputedState<T> | undefined;
  if (!atomState) {
    atomState = {
      dependencies: new Map<Signal<unknown>, number>(),
      epoch: -1,
    } as ComputedState<T>;
    context.stateMap.set(self, atomState);
  }

  const lastDeps = atomState.dependencies;
  const readDeps = new Map<Signal<unknown>, number>();
  atomState.dependencies = readDeps;
  const wrappedGet: Getter = (depAtom) => {
    const depState = readSignalState(depAtom, context, batch);

    // get 可能发生在异步过程中，当重复调用时，只有最新的 get 过程会修改 deps
    if (atomState.dependencies === readDeps) {
      readDeps.set(depAtom, depState.epoch);

      const selfMounted = !!atomState.mounted;
      if (selfMounted && !depState.mounted) {
        tryMount(depAtom, context, batch).readDepts.add(self);
      } else if (selfMounted && depState.mounted) {
        depState.mounted.readDepts.add(self);
      }
    }

    return depState.val;
  };

  const getInterceptor = context.interceptor?.get;
  const ret = self.read(
    function <U>(depAtom: Signal<U>) {
      if (!getInterceptor) {
        return wrappedGet(depAtom);
      }

      let result: DataWithCalledState<U> = {
        called: false,
      } as DataWithCalledState<U>;

      const fn = () => {
        result = {
          called: true,
          data: wrappedGet(depAtom),
        };

        return result.data;
      };

      getInterceptor(depAtom, fn);

      if (!result.called) {
        throw new Error('interceptor must call fn sync');
      }
      return result.data;
    },
    {
      get signal() {
        atomState.abortController?.abort(`abort ${self.debugLabel ?? 'anonymous'} atom`);
        atomState.abortController = new AbortController();
        return atomState.abortController.signal;
      },
    },
  );

  if (atomState.val !== ret) {
    atomState.val = ret;
    atomState.epoch += 1;
  }

  for (const key of lastDeps.keys()) {
    if (!readDeps.has(key)) {
      const depState = context.stateMap.get(key);
      if (depState?.mounted) {
        depState.mounted.readDepts.delete(self);
        tryUnmount(key, context, batch);
      }
    }
  }

  return atomState;
}

function readStateAtom<T>(state: State<T>, context: Context): StateState<T> {
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

export function readSignalState<T>(signal: Signal<T>, context: Context, batch?: Batch): SignalState<T> {
  if (canReadAsCompute(signal)) {
    return readComputed(signal, context, batch);
  }

  return readStateAtom(signal, context);
}

function tryGetMount(atom: Signal<unknown>, stateMap: StateMap): Mounted | undefined {
  return stateMap.get(atom)?.mounted;
}

function tryMount<T>(signal: Signal<T>, context: Context, batch?: Batch): Mounted {
  const mounted = tryGetMount(signal, context.stateMap);
  if (mounted) {
    return mounted;
  }

  context.interceptor?.mount?.(signal);

  const atomState = readSignalState(signal, context, batch);

  atomState.mounted = atomState.mounted ?? {
    listeners: new Set(),
    readDepts: new Set(),
  };

  if (isComputedState(atomState)) {
    for (const [dep] of Array.from(atomState.dependencies)) {
      const mounted = tryMount(dep, context, batch);
      mounted.readDepts.add(signal);
    }
  }

  return atomState.mounted;
}

function tryUnmount<T>(signal: Signal<T>, context: Context, batch?: Batch): void {
  const atomState = context.stateMap.get(signal);
  if (!atomState?.mounted || atomState.mounted.listeners.size || atomState.mounted.readDepts.size) {
    return;
  }

  context.interceptor?.unmount?.(signal);

  if (isComputedState(atomState)) {
    for (const [dep] of Array.from(atomState.dependencies)) {
      const depState = readSignalState(dep, context, batch);
      depState.mounted?.readDepts.delete(signal);
      tryUnmount(dep, context, batch);
    }
  }

  atomState.mounted = undefined;
}

function subSingleSignal<T>(
  signal$: Signal<T>,
  callback$: Command<unknown, []>,
  context: Context,
  options?: SubscribeOptions,
) {
  let unsub: (() => void) | undefined;
  const fn = () => {
    let subscribed = true;
    const mounted = tryMount(signal$, context);
    mounted.listeners.add(callback$);

    unsub = () => {
      if (!subscribed) {
        return;
      }

      const fn = () => {
        subscribed = false;
        mounted.listeners.delete(callback$);

        if (mounted.readDepts.size === 0 && mounted.listeners.size === 0) {
          tryUnmount(signal$, context);
        }

        options?.signal?.addEventListener('abort', fn);
      };

      if (context.interceptor?.unsub) {
        context.interceptor.unsub(signal$, callback$, fn);

        // subscribed should be false if interceptor called fn sync
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (subscribed) {
          throw new Error('interceptor must call fn sync');
        }
      } else {
        fn();
      }
    };

    options?.signal?.addEventListener('abort', unsub);
  };

  if (context.interceptor?.sub) {
    context.interceptor.sub(signal$, callback$, fn);
  } else {
    fn();
  }

  if (!unsub) {
    throw new Error('interceptor must call fn sync');
  }

  return unsub;
}

export function sub<T>(
  signals$: Signal<T>[] | Signal<T>,
  callback$: Command<unknown, []>,
  context: Context,
  options?: SubscribeOptions,
): () => void {
  if (Array.isArray(signals$) && signals$.length === 0) {
    return () => void 0;
  }

  if (Array.isArray(signals$) && signals$.length === 1) {
    return subSingleSignal(signals$[0], callback$, context, options);
  } else if (!Array.isArray(signals$)) {
    return subSingleSignal(signals$, callback$, context, options);
  }

  const unsubscribes = new Set<() => void>();
  signals$.forEach((atom) => {
    unsubscribes.add(subSingleSignal(atom, callback$, context, options));
  });

  const unsub = () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };

  return unsub;
}

export function get<T>(signal: Signal<T>, context: Context, batch?: Batch): T {
  if (!context.interceptor?.get) {
    return readSignalState(signal, context, batch).val;
  }

  let result: DataWithCalledState<T> = {
    called: false,
  } as DataWithCalledState<T>;

  const fnWithRet = () => {
    result = {
      called: true,
      data: readSignalState(signal, context, batch).val,
    };
    return result.data;
  };

  context.interceptor.get(signal, fnWithRet);
  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }

  return result.data;
}

function wrapVisitor(context: Context, batch: Batch) {
  const wrappedGet: Getter = <T>(signal: Signal<T>) => {
    return get(signal, context, batch);
  };
  const wrappedSet: Setter = <T, Args extends unknown[]>(
    signal: State<T> | Command<T, Args>,
    ...args: [T | Updater<T>] | Args
  ): undefined | T => {
    return set<T, Args>(signal, context, batch, ...args);
  };

  return {
    get: wrappedGet,
    set: wrappedSet,
  };
}

function innerSet<T, Args extends unknown[]>(
  atom: State<T> | Command<T, Args>,
  context: Context,
  batch: Batch,
  ...args: [T | Updater<T>] | Args
): undefined | T {
  if ('read' in atom) {
    return;
  }

  if ('write' in atom) {
    const ret = atom.write(wrapVisitor(context, batch), ...(args as Args));
    return ret;
  }

  const newValue =
    typeof args[0] === 'function' ? (args[0] as Updater<T>)(readSignalState(atom, context, batch).val) : (args[0] as T);

  if (!context.stateMap.has(atom)) {
    context.stateMap.set(atom, {
      val: newValue,
      epoch: 0,
    });
    return;
  }
  const atomState = readSignalState(atom, context, batch);
  atomState.val = newValue;
  atomState.epoch += 1;
  markPendingListeners(atom, context, batch);
  return undefined;
}

function markPendingListeners(signal: Signal<unknown>, context: Context, batch: Batch) {
  let queue: Signal<unknown>[] = [signal];

  while (queue.length > 0) {
    const nextQueue: Signal<unknown>[] = [];
    for (const atom of queue) {
      const atomState = readSignalState(atom, context, {
        pendingListeners: batch.pendingListeners,
        ignoreMounted: true,
      });

      if (atomState.mounted?.listeners) {
        for (const listener of atomState.mounted.listeners) {
          batch.pendingListeners.add(listener);
        }
      }

      const readDepts = atomState.mounted?.readDepts;
      if (readDepts) {
        for (const dep of Array.from(readDepts)) {
          nextQueue.push(dep);
        }
      }
    }

    queue = nextQueue;
  }
}

export function set<T, Args extends unknown[]>(
  atom: State<T> | Command<T, Args>,
  context: Context,
  batch: Batch,
  ...args: [T | Updater<T>] | Args
): undefined | T {
  let ret: T | undefined;
  const fn = () => {
    try {
      ret = innerSet(atom, context, batch, ...args) as T | undefined;
    } finally {
      notify(context, batch);
    }
    return ret;
  };

  if (context.interceptor?.set) {
    if ('write' in atom) {
      context.interceptor.set(atom, fn, ...(args as Args));
    } else {
      context.interceptor.set(atom, fn, args[0] as T | Updater<T>);
    }
  } else {
    fn();
  }

  return ret;
}

function* innerNotify(context: Context, batch: Batch): Generator<Command<unknown, []>, void, unknown> {
  const pendingListeners = batch.pendingListeners;
  batch.pendingListeners = new Set();

  for (const listener of pendingListeners) {
    yield listener;
  }
}

function notify(context: Context, batch: Batch) {
  for (const listener of innerNotify(context, batch)) {
    let notifyed = false;
    const fn = () => {
      notifyed = true;
      return listener.write(wrapVisitor(context, batch));
    };
    if (context.interceptor?.notify) {
      context.interceptor.notify(listener, fn);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- notify must call fn sync
      if (!notifyed) {
        throw new Error('interceptor must call fn sync');
      }
    } else {
      fn();
    }
  }
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
