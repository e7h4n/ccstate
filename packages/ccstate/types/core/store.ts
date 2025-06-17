import type { Signal, Command, Getter, Setter, State, Computed, StateArg, Watcher } from './signal';

export interface Store {
  get: Getter;
  set: Setter;
  watch: Watch;
}

export type Watch = (
  observer: Watcher,
  options?: {
    signal?: AbortSignal;
    debugLabel?: string;
  },
) => void;

export type InterceptorGet = <T>(signal$: Signal<T>, fn: () => T) => void;
export interface InterceptorSet {
  <T, Args extends unknown[]>(command$: Command<T, Args>, fn: () => T, ...args: Args): void;
  <T>(state$: State<T>, fn: () => void, val: StateArg<T>): void;
}
export type InterceptorMount = <T>(signal$: Signal<T>) => void;
export type InterceptorUnmount = <T>(signal$: Signal<T>) => void;
export type InterceptorComputed = <T>(computed$: Computed<T>, fn: () => T) => void;

export interface StoreInterceptor {
  get?: InterceptorGet;
  set?: InterceptorSet;
  mount?: InterceptorMount;
  unmount?: InterceptorUnmount;
  computed?: InterceptorComputed;
}

export type StoreEventType = 'set' | 'get' | 'mount' | 'unmount' | 'computed';

export interface StoreOptions {
  interceptor?: StoreInterceptor;
}

export interface StoreContext {
  stateMap: StateMap;
  interceptor?: StoreInterceptor;
}

export interface Mutation {
  potentialDirtyIds: Set<number>;
  visitor: {
    get: Getter;
    set: Setter;
  };
}

export interface StateState<T> {
  mounted?: Mounted;
  val: T;
  epoch: number;
}

export type ComputedState<T> =
  | {
      mounted?: Mounted;
      val: T;
      error: undefined;
      dependencies: Map<Signal<unknown>, number>;
      epoch: number;
      abortController?: AbortController;
    }
  | {
      mounted?: Mounted;
      val: undefined;
      error: unknown;
      dependencies: Map<Signal<unknown>, number>;
      epoch: number;
      abortController?: AbortController;
    };

export type SignalState<T> = StateState<T> | ComputedState<T>;
export type StateMap = WeakMap<Signal<unknown>, SignalState<unknown>>;

export interface Mounted {
  readDepts: Set<Computed<unknown>>;
}

export type SetArgs<T, CommandArgs extends unknown[]> = [StateArg<T>] | CommandArgs;

export type StoreSet = <T, Args extends SetArgs<T, unknown[]>>(
  atom: State<T> | Command<T, Args>,
  context: StoreContext,
  ...args: Args
) => T | undefined;

export type StoreGet = <T>(signal: Signal<T>, context: StoreContext, mutation?: Mutation) => T;

export type ReadComputed = <T>(computed$: Computed<T>, context: StoreContext, mutation?: Mutation) => ComputedState<T>;
export type ReadSignal = <T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation) => SignalState<T>;
export type Mount = <T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation) => Mounted;
export type Unmount = <T>(signal$: Signal<T>, context: StoreContext, mutation?: Mutation) => void;
