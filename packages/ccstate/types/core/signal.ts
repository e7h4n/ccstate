export type Updater<T> = (current: T) => T;
export type StateArg<T> = T | Updater<T>;

export interface Setter {
  <T>(state: State<T>, val: StateArg<T>): void;
  <T, Args extends unknown[]>(command: Command<T, Args>, ...args: Args): T;
}
export type Getter = <T>(readable: Signal<T>) => T;
export interface GetterOptions {
  signal: AbortSignal;
}
export type Read<T> = (get: Getter, options: GetterOptions) => T;
export type Write<T, Args extends unknown[]> = (visitor: { get: Getter; set: Setter }, ...args: Args) => T;

export interface State<T> {
  id: number;
  init: T;
  debugLabel?: string;
  toString: () => string;
}
export interface Computed<T> {
  id: number;
  read: Read<T>;
  debugLabel?: string;
  toString: () => string;
}
export interface Command<T, Args extends unknown[]> {
  id: number;
  write: Write<T, Args>;
  debugLabel?: string;
  toString: () => string;
}

export type ExternalEffect = (get: Getter, options: GetterOptions) => void;

export type Signal<T> = State<T> | Computed<T>;
