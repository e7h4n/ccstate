export type Updater<T> = (current: T) => T;
export interface Setter {
  <T>(state: State<T>, val: T | Updater<T>): void;
  <T, Args extends unknown[]>(command: Command<T, Args>, ...args: Args): T;
}
export type Getter = <T>(readable: Signal<T>) => T;
export interface GetterOptions {
  signal: AbortSignal;
}
export type Read<T> = (get: Getter, options: GetterOptions) => T;
export type Write<T, Args extends unknown[]> = (visitor: { get: Getter; set: Setter }, ...args: Args) => T;

export interface State<T> {
  init: T;
  debugLabel?: string;
  toString: () => string;
}
export interface Computed<T> {
  read: Read<T>;
  debugLabel?: string;
  toString: () => string;
}
export interface Command<T, Args extends unknown[]> {
  write: Write<T, Args>;
  debugLabel?: string;
  toString: () => string;
}

export type Signal<T> = State<T> | Computed<T>;
