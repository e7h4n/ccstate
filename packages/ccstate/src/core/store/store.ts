import type { Command, Getter, Setter, Signal, State, Computed } from '../../../types/core/signal';
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
  Watcher,
  StoreWatch,
} from '../../../types/core/store';
import { evaluateComputed, tryGetCached } from '../signal/computed';
import { withComputedInterceptor, withGetInterceptor, withSetInterceptor } from '../interceptor';
import { flushMutation, set as innerSet } from './set';
import { readState } from '../signal/state';
import { canReadAsCompute } from '../typing-util';
import { mount as innerMount, unmount } from './sub';

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
  mutation = context.pendingMutation ?? mutation;
  if (canReadAsCompute(signal$)) {
    return readComputed(signal$, context, mutation);
  }

  return readState(signal$, context);
}

function mount<T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation): Mounted {
  return innerMount(readSignal, signal$, context, mutation);
}

const storeGet: StoreGet = (signal, context, mutation) => {
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

const storeSet: StoreSet = <T, Args extends SetArgs<T, unknown[]>>(
  atom: State<T> | Command<T, Args>,
  context: StoreContext,
  ...args: Args
): T | undefined => {
  return withSetInterceptor<T, Args>(
    () => {
      const previousChangedSize = context.changedSignals.size;
      try {
        return innerSet<T, Args>(readComputed, atom, context, storeGet, flushPending, ...args);
      } finally {
        if (context.changedSignals.size !== previousChangedSize) flushPending(context);
      }
    },
    atom,
    context.interceptor?.set,
    ...args,
  );
};

function flushPending(context: StoreContext): void {
  if (flushMutation(readComputed, context)) flushCallbacks(context);
}

function flushCallbacks(context: StoreContext): void {
  if (!context.changedSignals.size) return;
  const errors: unknown[] = [];
  do {
    // changedSignals is also write-boundary bookkeeping. It may contain only
    // unobserved sources, so do not allocate notification work until needed.
    let callbacks: Set<() => void> | undefined;
    for (const signal$ of context.changedSignals) {
      const listeners = context.stateMap.get(signal$)?.mounted?.listeners;
      if (listeners?.size) {
        callbacks ??= new Set();
        for (const listener of listeners) callbacks.add(listener);
      }
    }
    context.changedSignals.clear();
    if (!callbacks) continue;
    for (const callback of callbacks) {
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    }
  } while (context.changedSignals.size);
  if (errors.length) {
    const AggregateErrorCtor = (
      globalThis as typeof globalThis & {
        AggregateError?: new (errors: unknown[]) => Error;
      }
    ).AggregateError;
    if (AggregateErrorCtor) throw new AggregateErrorCtor(errors);
    throw Object.assign(new Error(), { errors });
  }
}

const storeWatch: StoreWatch = (signal$, context, listener) => {
  if (!('read' in signal$) && !('init' in signal$)) throw new TypeError('watch requires a state or computed');
  const mounted = innerMount(readSignal, signal$, context);
  mounted.listeners.add(listener);
  flushPending(context);
  return () => {
    mounted.listeners.delete(listener);
    unmount(signal$, context);
    flushPending(context);
  };
};

export class StoreImpl implements Store {
  protected readonly stateMap: StateMap = new WeakMap();
  protected readonly context: StoreContext;

  constructor(protected readonly options?: StoreOptions) {
    this.context = {
      stateMap: this.stateMap,
      interceptor: this.options?.interceptor,
      writeVersion: 0,
      changedSignals: new Set(),
      pendingMutation: undefined,
      mutationWork: undefined,
    };
  }

  get: Getter = <T>(atom: Signal<T>): T => {
    return storeGet(atom, this.context);
  };

  set: Setter = <T, Args extends SetArgs<T, unknown[]>>(
    atom: State<T> | Command<T, Args>,
    ...args: Args
  ): undefined | T => {
    return storeSet<T, Args>(atom, this.context, ...args);
  };

  watch: Watcher = (signal$, listener) => {
    return storeWatch(signal$, this.context, listener);
  };
}

export function createStore(): Store {
  return new StoreImpl();
}
