import type { Command, Getter, Setter, Signal, State, Computed } from '../../../types/core/signal';
import type {
  StateMap,
  Store,
  StoreContext,
  StoreOptions,
  SubscribeOptions,
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
import { mount as innerMount, unmount, subSingleSignal, notify } from './sub';

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

function sub<T>(
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
    subSingleSignal(readSignal, signals$, callback$, context, signal);
  } else {
    signals$.forEach((atom) => {
      subSingleSignal(readSignal, atom, callback$, context, signal);
    });
  }

  return () => {
    controller.abort();
  };
}

const get: StoreGet = (signal, context, mutation) => {
  return withGetInterceptor(
    () => {
      return readSignal(signal, context, mutation).val;
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

      let ret: T | undefined;
      try {
        ret = innerSet<T, Args>(readComputed, atom, context, mutation, ...args);
      } finally {
        notify(context, mutation);
      }
      return ret;
    },
    atom,
    context.interceptor?.set,
    ...args,
  );
};

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
