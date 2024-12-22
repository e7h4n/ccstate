import type { ReadableAtom, Command, Getter, State, Updater, Setter } from '../../types/core/atom';
import type { Store, StoreOptions, SubscribeOptions } from '../../types/core/store';
import { AtomManager, ListenerManager } from './atom-manager';

type DataWithCalledState<T> =
  | {
      called: false;
    }
  | {
      called: true;
      data: T;
    };

export class StoreImpl implements Store {
  constructor(
    protected readonly atomManager: AtomManager,
    protected readonly listenerManager: ListenerManager,
    protected readonly options?: StoreOptions,
  ) {}

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

  get: Getter = <T>(atom: ReadableAtom<T>): T => {
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
    target$: ReadableAtom<unknown>,
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
    targets$: ReadableAtom<unknown>[] | ReadableAtom<unknown>,
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
  const atomManager = new AtomManager();
  const listenerManager = new ListenerManager();

  return new StoreImpl(atomManager, listenerManager);
}

let defaultStore: Store | undefined = undefined;
export function getDefaultStore(): Store {
  if (!defaultStore) {
    defaultStore = createStore();
  }
  return defaultStore;
}
