import type { Command, Getter, Setter, Signal, State, Computed, Watcher } from '../../../types/core/signal';
import type {
  StateMap,
  Store,
  StoreContext,
  StoreOptions,
  ComputedState,
  Mounted,
  Mutation,
  ReadComputed,
  SignalState,
  StoreGet,
  StoreSet,
  SetArgs,
} from '../../../types/core/store';
import { evaluateComputed, tryGetCached } from '../signal/computed';
import { withComputedInterceptor, withGetInterceptor, withSetInterceptor } from '../interceptor';
import { createMutation, set as innerSet } from './set';
import { readState } from '../signal/state';
import { canReadAsCompute } from '../typing-util';
import { mount as innerMount, unmount } from './sub';
import { computed } from '../signal/factory';

const readComputed: ReadComputed = <T>(
  computed$: Computed<T>,
  context: StoreContext,
  mutation?: Mutation,
): ComputedState<T> => {
  const cachedState = tryGetCached(readComputed, computed$, context, mutation);
  if (cachedState) {
    return cachedState;
  }

  return withComputedInterceptor(
    () => {
      return evaluateComputed(readSignal, mount, unmount, computed$, context, mutation);
    },
    computed$,
    context.interceptor?.computed,
  );
};

function readSignal<T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation): SignalState<T> {
  if (canReadAsCompute(signal$)) {
    return readComputed(signal$, context, mutation);
  }

  return readState(signal$, context);
}

function mount<T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation): Mounted {
  return innerMount(readSignal, signal$, context, mutation);
}

const get: StoreGet = (signal, context, mutation) => {
  return withGetInterceptor(
    () => {
      const signalState = readSignal(signal, context, mutation);
      if ('error' in signalState) {
        throw signalState.error as Error;
      }

      return signalState.val;
    },
    signal,
    context.interceptor?.get,
  );
};

const set: StoreSet = <T, Args extends SetArgs<T, unknown[]>>(
  atom: State<T> | Command<T, Args>,
  context: StoreContext,
  ...args: Args
): T | undefined => {
  return withSetInterceptor<T, Args>(
    () => {
      const mutation = createMutation(context, get, set);

      return innerSet<T, Args>(readComputed, atom, context, mutation, ...args);
    },
    atom,
    context.interceptor?.set,
    ...args,
  );
};

export function watch(
  watcher: Watcher,
  context: StoreContext,
  options?: { signal?: AbortSignal; debugLabel?: string },
) {
  const computed$ = computed(
    (get, { signal }) => {
      let childSignal: AbortSignal | undefined;
      const obOptions = {
        get signal() {
          if (!childSignal) {
            childSignal = options?.signal ? AbortSignal.any([options.signal, signal]) : signal;
          }
          return childSignal;
        },
      };

      watcher(get, obOptions);
    },
    {
      debugLabel: options?.debugLabel,
    },
  );

  innerMount(readSignal, computed$, context);

  options?.signal?.addEventListener(
    'abort',
    () => {
      unmount(computed$, context);
    },
    {
      once: true,
    },
  );
}

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

  set: Setter = <T, Args extends SetArgs<T, unknown[]>>(
    atom: State<T> | Command<T, Args>,
    ...args: Args
  ): undefined | T => {
    return set<T, Args>(atom, this.context, ...args);
  };

  watch(watcher: Watcher, options?: { signal?: AbortSignal }) {
    watch(watcher, this.context, options);
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
