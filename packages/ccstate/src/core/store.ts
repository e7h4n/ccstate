import type { Signal, Command, Getter, State, Updater, Setter, Computed } from '../../types/core/atom';
import type { Store, StoreInterceptor, StoreOptions, SubscribeOptions } from '../../types/core/store';

type DataWithCalledState<T> =
  | {
      called: false;
    }
  | {
      called: true;
      data: T;
    };

interface ReadContext {
  stateMap: StateMap;
  ignoreMounted: boolean;
  interceptor?: StoreInterceptor;
}

function tryGetCachedState<T>(atom: Computed<T>, context: ReadContext): ComputedState<T> | undefined {
  const atomState = context.stateMap.get(atom) as ComputedState<T> | undefined;
  if (!atomState) {
    return undefined;
  }

  if (atomState.mounted && !context.ignoreMounted) {
    return atomState;
  }

  for (const [dep, epoch] of atomState.dependencies.entries()) {
    const depState = readSignalState(dep, context);
    if (depState.epoch !== epoch) {
      return undefined;
    }
  }

  return atomState;
}

function readComputed<T>(computed: Computed<T>, context: ReadContext): ComputedState<T> {
  const cachedState = tryGetCachedState(computed, context);
  if (cachedState) {
    return cachedState;
  }

  const computedInterceptor = context.interceptor?.computed;
  if (!computedInterceptor) {
    return computeComputedAtom(computed, context);
  }

  let result: DataWithCalledState<ComputedState<T>> = {
    called: false,
  } as DataWithCalledState<ComputedState<T>>;

  computedInterceptor(computed, () => {
    result = {
      called: true,
      data: computeComputedAtom(computed, context),
    };

    return result.data.val;
  });

  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }

  return result.data;
}

function computeComputedAtom<T>(atom: Computed<T>, context: ReadContext): ComputedState<T> {
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
    const depState = readSignalState(depAtom, context);

    // get 可能发生在异步过程中，当重复调用时，只有最新的 get 过程会修改 deps
    if (atomState.dependencies === readDeps) {
      readDeps.set(depAtom, depState.epoch);

      const selfMounted = !!atomState.mounted;
      if (selfMounted && !depState.mounted) {
        mount(depAtom, context).readDepts.add(self);
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
        tryUnmount(key, context);
      }
    }
  }

  return atomState;
}

function readStateAtom<T>(state: State<T>, context: ReadContext): StateState<T> {
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

function readSignalState<T>(signal: Signal<T>, context: ReadContext): SignalState<T> {
  if (canReadAsCompute(signal)) {
    return readComputed(signal, context);
  }

  return readStateAtom(signal, context);
}

function tryGetMount(atom: Signal<unknown>, stateMap: StateMap): Mounted | undefined {
  return stateMap.get(atom)?.mounted;
}

function mount<T>(signal: Signal<T>, context: ReadContext): Mounted {
  const mounted = tryGetMount(signal, context.stateMap);
  if (mounted) {
    return mounted;
  }

  context.interceptor?.mount?.(signal);

  const atomState = readSignalState(signal, context);

  atomState.mounted = atomState.mounted ?? {
    listeners: new Set(),
    readDepts: new Set(),
  };

  if (isComputedState(atomState)) {
    for (const [dep] of Array.from(atomState.dependencies)) {
      const mounted = mount(dep, context);
      mounted.readDepts.add(signal);
    }
  }

  return atomState.mounted;
}

function tryUnmount<T>(signal: Signal<T>, context: ReadContext): void {
  const atomState = context.stateMap.get(signal);
  if (!atomState?.mounted || atomState.mounted.listeners.size || atomState.mounted.readDepts.size) {
    return;
  }

  context.interceptor?.unmount?.(signal);

  if (isComputedState(atomState)) {
    for (const [dep] of Array.from(atomState.dependencies)) {
      const depState = readSignalState(dep, context);
      depState.mounted?.readDepts.delete(signal);
      tryUnmount(dep, context);
    }
  }

  atomState.mounted = undefined;
}

export class StoreImpl implements Store {
  protected readonly atomManager: AtomManager;
  protected readonly listenerManager: ListenerManager;
  constructor(protected readonly options?: StoreOptions) {
    this.atomManager = new AtomManager(options);
    this.listenerManager = new ListenerManager();
  }

  private innerSet = <T, Args extends unknown[]>(
    atom: State<T> | Command<T, Args>,
    ...args: [T | Updater<T>] | Args
  ): undefined | T => {
    if ('read' in atom) {
      return;
    }

    if ('write' in atom) {
      const ret = atom.write({ get: this.get, set: this.set }, ...(args as Args));
      return ret;
    }

    const newValue =
      typeof args[0] === 'function'
        ? (args[0] as Updater<T>)(this.atomManager.readAtomState(atom).val)
        : (args[0] as T);

    if (!this.atomManager.inited(atom)) {
      this.atomManager.readAtomState(atom).val = newValue;
      this.listenerManager.markPendingListeners(this.atomManager, atom);
      return;
    }
    const atomState = this.atomManager.readAtomState(atom);
    atomState.val = newValue;
    atomState.epoch += 1;
    this.listenerManager.markPendingListeners(this.atomManager, atom);
    return undefined;
  };

  get: Getter = <T>(atom: Signal<T>): T => {
    if (!this.options?.interceptor?.get) {
      return this.atomManager.readAtomState(atom).val;
    }
    let result: DataWithCalledState<T> = {
      called: false,
    } as DataWithCalledState<T>;

    const fnWithRet = () => {
      result = {
        called: true,
        data: this.atomManager.readAtomState(atom).val,
      };
      return result.data;
    };

    this.options.interceptor.get(atom, fnWithRet);
    if (!result.called) {
      throw new Error('interceptor must call fn sync');
    }

    return result.data;
  };

  private notify = () => {
    for (const listener of this.listenerManager.notify()) {
      let notifyed = false;
      const fn = () => {
        notifyed = true;
        return listener.write({ get: this.get, set: this.set });
      };
      if (this.options?.interceptor?.notify) {
        this.options.interceptor.notify(listener, fn);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- notify must call fn sync
        if (!notifyed) {
          throw new Error('interceptor must call fn sync');
        }
      } else {
        fn();
      }
    }
  };

  set: Setter = <T, Args extends unknown[]>(
    atom: State<T> | Command<T, Args>,
    ...args: [T | Updater<T>] | Args
  ): undefined | T => {
    let ret: T | undefined;
    const fn = () => {
      try {
        ret = this.innerSet(atom, ...args) as T | undefined;
      } finally {
        this.notify();
      }
      return ret;
    };

    if (this.options?.interceptor?.set) {
      if ('write' in atom) {
        this.options.interceptor.set(atom, fn, ...(args as Args));
      } else {
        this.options.interceptor.set(atom, fn, args[0] as T | Updater<T>);
      }
    } else {
      fn();
    }

    return ret;
  };

  private _subSingleAtom(
    target$: Signal<unknown>,
    cb$: Command<unknown, unknown[]>,
    options?: SubscribeOptions,
  ): () => void {
    let unsub: (() => void) | undefined;
    const fn = () => {
      let subscribed = true;
      const mounted = this.atomManager.mount(target$);
      mounted.listeners.add(cb$);

      unsub = () => {
        if (!subscribed) {
          return;
        }

        const fn = () => {
          subscribed = false;
          mounted.listeners.delete(cb$);

          if (mounted.readDepts.size === 0 && mounted.listeners.size === 0) {
            this.atomManager.tryUnmount(target$);
          }

          options?.signal?.addEventListener('abort', fn);
        };

        if (this.options?.interceptor?.unsub) {
          this.options.interceptor.unsub(target$, cb$, fn);

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

    if (this.options?.interceptor?.sub) {
      this.options.interceptor.sub(target$, cb$, fn);
    } else {
      fn();
    }

    if (!unsub) {
      throw new Error('interceptor must call fn sync');
    }

    return unsub;
  }

  sub(
    targets$: Signal<unknown>[] | Signal<unknown>,
    cb$: Command<unknown, unknown[]>,
    options?: SubscribeOptions,
  ): () => void {
    if (Array.isArray(targets$) && targets$.length === 0) {
      return () => void 0;
    }

    if (Array.isArray(targets$) && targets$.length === 1) {
      return this._subSingleAtom(targets$[0], cb$, options);
    } else if (!Array.isArray(targets$)) {
      return this._subSingleAtom(targets$, cb$, options);
    }

    const unsubscribes = new Set<() => void>();
    targets$.forEach((atom) => {
      unsubscribes.add(this._subSingleAtom(atom, cb$, options));
    });

    const unsub = () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };

    return unsub;
  }
}

export function createStore(): Store {
  return new StoreImpl();
}

let defaultStore: Store | undefined = undefined;
export function getDefaultStore(): Store {
  if (!defaultStore) {
    defaultStore = createStore();
  }
  return defaultStore;
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

type SignalState<T> = StateState<T> | ComputedState<T>;
type StateMap = WeakMap<Signal<unknown>, SignalState<unknown>>;

interface Mounted {
  listeners: Set<Command<unknown, []>>;
  readDepts: Set<Signal<unknown>>;
}

function canReadAsCompute<T>(atom: Signal<T>): atom is Computed<T> {
  return 'read' in atom;
}

function isComputedState<T>(state: SignalState<T>): state is ComputedState<T> {
  return 'dependencies' in state;
}

class AtomManager {
  private atomStateMap: StateMap = new WeakMap();

  constructor(private readonly options?: StoreOptions) {}

  public readAtomState<T>(atom: State<T>, ignoreMounted?: boolean): StateState<T>;
  public readAtomState<T>(atom: Computed<T>, ignoreMounted?: boolean): ComputedState<T>;
  public readAtomState<T>(atom: State<T> | Computed<T>, ignoreMounted?: boolean): SignalState<T>;
  public readAtomState<T>(
    atom: State<T> | Computed<T>,
    ignoreMounted = false,
  ): StateState<T> | ComputedState<T> | SignalState<T> {
    return readSignalState(atom, {
      stateMap: this.atomStateMap,
      ignoreMounted,
      interceptor: this.options?.interceptor,
    });
  }

  public mount<T>(atom: Signal<T>): Mounted {
    return mount(atom, {
      stateMap: this.atomStateMap,
      ignoreMounted: false,
      interceptor: this.options?.interceptor,
    });
  }

  public tryUnmount<T>(atom: Signal<T>): void {
    tryUnmount(atom, {
      stateMap: this.atomStateMap,
      ignoreMounted: false,
      interceptor: this.options?.interceptor,
    });
  }

  public inited(atom: Signal<unknown>) {
    return this.atomStateMap.has(atom);
  }
}

class ListenerManager {
  private pendingListeners = new Set<Command<unknown, []>>();

  markPendingListeners(atomManager: AtomManager, atom: Signal<unknown>) {
    let queue: Signal<unknown>[] = [atom];
    while (queue.length > 0) {
      const nextQueue: Signal<unknown>[] = [];
      for (const atom of queue) {
        const atomState = atomManager.readAtomState(atom, true);

        if (atomState.mounted?.listeners) {
          for (const listener of atomState.mounted.listeners) {
            this.pendingListeners.add(listener);
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

  *notify(): Generator<Command<unknown, []>, void, unknown> {
    const pendingListeners = this.pendingListeners;
    this.pendingListeners = new Set();

    for (const listener of pendingListeners) {
      yield listener;
    }
  }
}
