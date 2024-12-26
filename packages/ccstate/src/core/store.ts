import type { Command, Getter, Setter, Signal, State, Updater } from '../../types/core/signal';
import type { Store, StoreOptions, SubscribeOptions } from '../../types/core/store';
import { get, set, sub, type StoreContext, type StateMap } from './signal-manager';

export class StoreImpl implements Store {
  protected readonly stateMap: StateMap = new WeakMap();
  protected readonly context: StoreContext;

  constructor(protected readonly options?: StoreOptions) {
    this.context = {
      stateMap: this.stateMap,
      interceptor: this.options?.interceptor,
    };
  }

  get: Getter = <T>(atom: Signal<T>): T => {
    return get(atom, this.context);
  };

  set: Setter = <T, Args extends unknown[]>(
    atom: State<T> | Command<T, Args>,
    ...args: [T | Updater<T>] | Args
  ): undefined | T => {
    return set<T, Args>(atom, this.context, ...args);
  };

  sub(
    targets$: Signal<unknown>[] | Signal<unknown>,
    cb$: Command<unknown, unknown[]>,
    options?: SubscribeOptions,
  ): () => void {
    return sub(targets$, cb$, this.context, options);
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
