import type { ReadableAtom, Func, Getter, Computed, Value } from '../../types/core/atom';
import type { StoreOptions } from '../../types/core/store';

type DataWithCalledState<T> =
  | {
      called: false;
    }
  | {
      called: true;
      data: T;
    };

export interface StateState<T> {
  mounted?: Mounted;
  val: T;
  epoch: number;
}

export interface ComputedState<T> {
  mounted?: Mounted;
  val: T;
  dependencies: Map<ReadableAtom<unknown>, number>;
  epoch: number;
  abortController?: AbortController;
}

type CommonReadableState<T> = StateState<T> | ComputedState<T>;

type AtomState<T> = StateState<T> | ComputedState<T>;

interface Mounted {
  listeners: Set<Func<unknown, []>>;
  readDepts: Set<ReadableAtom<unknown>>;
}

function canReadAsCompute<T>(atom: ReadableAtom<T>): atom is Computed<T> {
  return 'read' in atom;
}

function isComputedState<T>(state: CommonReadableState<T>): state is ComputedState<T> {
  return 'dependencies' in state;
}

export class AtomManager {
  private atomStateMap = new WeakMap<ReadableAtom<unknown>, AtomState<unknown>>();

  constructor(private readonly options?: StoreOptions) {}

  private tryGetCachedState = <T>(atom: Computed<T>, ignoreMounted: boolean): ComputedState<T> | undefined => {
    const atomState = this.atomStateMap.get(atom) as ComputedState<T> | undefined;
    if (!atomState) {
      return undefined;
    }

    if (atomState.mounted && !ignoreMounted) {
      return atomState;
    }

    for (const [dep, epoch] of atomState.dependencies.entries()) {
      const depState = this.readAtomState(dep);
      if (depState.epoch !== epoch) {
        return undefined;
      }
    }

    return atomState;
  };

  private readComputedAtom<T>(atom: Computed<T>, ignoreMounted = false): ComputedState<T> {
    const cachedState = this.tryGetCachedState(atom, ignoreMounted);
    if (cachedState) {
      return cachedState;
    }

    const self: Computed<T> = atom;
    let atomState: ComputedState<T> | undefined = this.atomStateMap.get(self) as ComputedState<T> | undefined;
    if (!atomState) {
      atomState = {
        dependencies: new Map<ReadableAtom<unknown>, number>(),
        epoch: -1,
      } as ComputedState<T>;
      this.atomStateMap.set(self, atomState);
    }

    const lastDeps = atomState.dependencies;
    const readDeps = new Map<ReadableAtom<unknown>, number>();
    atomState.dependencies = readDeps;
    const wrappedGet: Getter = (depAtom) => {
      const depState = this.readAtomState(depAtom);

      // get 可能发生在异步过程中，当重复调用时，只有最新的 get 过程会修改 deps
      if (atomState.dependencies === readDeps) {
        readDeps.set(depAtom, depState.epoch);

        const selfMounted = !!atomState.mounted;
        if (selfMounted && !depState.mounted) {
          this.mount(depAtom).readDepts.add(self);
        } else if (selfMounted && depState.mounted) {
          depState.mounted.readDepts.add(self);
        }
      }

      return depState.val;
    };

    const getInterceptor = this.options?.interceptor?.get;
    const ret = self.read(
      function <U>(depAtom: ReadableAtom<U>) {
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
        const otherState = this.atomStateMap.get(key);
        if (otherState?.mounted) {
          otherState.mounted.readDepts.delete(self);
        }
      }
    }

    return atomState;
  }

  private readStateAtom<T>(atom: Value<T>): StateState<T> {
    const atomState = this.atomStateMap.get(atom);
    if (!atomState) {
      const initState = {
        val: atom.init,
        epoch: 0,
      };
      this.atomStateMap.set(atom, initState);
      return initState as StateState<T>;
    }

    return atomState as StateState<T>;
  }

  public readAtomState<T>(atom: Value<T>, ignoreMounted?: boolean): StateState<T>;
  public readAtomState<T>(atom: Computed<T>, ignoreMounted?: boolean): ComputedState<T>;
  public readAtomState<T>(atom: Value<T> | Computed<T>, ignoreMounted?: boolean): CommonReadableState<T>;
  public readAtomState<T>(
    atom: Value<T> | Computed<T>,
    ignoreMounted = false,
  ): StateState<T> | ComputedState<T> | CommonReadableState<T> {
    if (canReadAsCompute(atom)) {
      return this.readComputedAtom(atom, ignoreMounted);
    }

    return this.readStateAtom(atom);
  }

  private tryGetMount(atom: ReadableAtom<unknown>): Mounted | undefined {
    return this.atomStateMap.get(atom)?.mounted;
  }

  public mount<T>(atom: ReadableAtom<T>): Mounted {
    const mounted = this.tryGetMount(atom);
    if (mounted) {
      return mounted;
    }

    this.options?.interceptor?.mount?.(atom);

    const atomState = this.readAtomState(atom);

    atomState.mounted = atomState.mounted ?? {
      listeners: new Set(),
      readDepts: new Set(),
    };

    if (isComputedState(atomState)) {
      for (const [dep] of Array.from(atomState.dependencies)) {
        const mounted = this.mount(dep);
        mounted.readDepts.add(atom);
      }
    }

    return atomState.mounted;
  }

  public unmount<T>(atom: ReadableAtom<T>): void {
    const atomState = this.atomStateMap.get(atom);
    if (!atomState?.mounted || atomState.mounted.listeners.size) {
      return;
    }

    this.options?.interceptor?.unmount?.(atom);

    if (isComputedState(atomState)) {
      for (const [dep] of Array.from(atomState.dependencies)) {
        const depState = this.readAtomState(dep);
        depState.mounted?.readDepts.delete(atom);
        if (depState.mounted?.readDepts.size === 0) {
          this.unmount(dep);
        }
      }
    }

    atomState.mounted = undefined;
  }

  public inited(atom: ReadableAtom<unknown>) {
    return this.atomStateMap.has(atom);
  }
}

export class ListenerManager {
  private pendingListeners = new Set<Func<unknown, []>>();

  markPendingListeners(atomManager: AtomManager, atom: ReadableAtom<unknown>) {
    let queue: ReadableAtom<unknown>[] = [atom];
    while (queue.length > 0) {
      const nextQueue: ReadableAtom<unknown>[] = [];
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

  *notify(): Generator<Func<unknown, []>, void, unknown> {
    const pendingListeners = this.pendingListeners;
    this.pendingListeners = new Set();

    for (const listener of pendingListeners) {
      yield listener;
    }
  }
}
