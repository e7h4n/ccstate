import type { Signal, Command, Getter, Setter, State, Computed, Updater } from './atom';

export interface Store {
  get: Getter;
  set: Setter;
  sub: Subscribe;
}

export interface SubscribeOptions {
  signal?: AbortSignal;
}

export type CallbackFunc<T> = Command<T, []>;

export type Subscribe = (
  atoms$: Signal<unknown>[] | Signal<unknown>,
  callback: CallbackFunc<unknown>,
  options?: SubscribeOptions,
) => () => void;

export type InterceptorGet = <T>(signal$: Signal<T>, fn: () => T) => void;
export interface InterceptorSet {
  <T, Args extends unknown[]>(command$: Command<T, Args>, fn: () => T, ...args: Args): void;
  <T>(value$: State<T>, fn: () => void, val: T | Updater<T>): void;
}
export type InterceptorSub = <T>(signal$: Signal<T>, callback$: CallbackFunc<T>, fn: () => void) => void;
export type InterceptorUnsub = <T>(signal$: Signal<T>, callback$: CallbackFunc<T>, fn: () => void) => void;
export type InterceptorMount = <T>(signal$: Signal<T>) => void;
export type InterceptorUnmount = <T>(signal$: Signal<T>) => void;
export type InterceptorNotify = <T>(callback$: CallbackFunc<T>, fn: () => T) => void;
export type InterceptorComputed = <T>(computed$: Computed<T>, fn: () => T) => void;

export interface StoreInterceptor {
  get?: InterceptorGet;
  set?: InterceptorSet;
  sub?: InterceptorSub;
  unsub?: InterceptorUnsub;
  mount?: InterceptorMount;
  unmount?: InterceptorUnmount;
  notify?: InterceptorNotify;
  computed?: InterceptorComputed;
}

export type StoreEventType = 'set' | 'get' | 'sub' | 'unsub' | 'mount' | 'unmount' | 'notify' | 'computed';

export interface StoreOptions {
  interceptor?: StoreInterceptor;
}
