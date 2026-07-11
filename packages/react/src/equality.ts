export type EqualityFn<T> = (previous: T, next: T) => boolean;

export interface EqualityOptions<T> {
  equalityFn?: EqualityFn<T>;
}

export function defaultEqualityFn<T>(previous: T, next: T): boolean {
  return Object.is(previous, next);
}
