export interface Strategy<T, S> {
  createStore(): S;
  createValue(value: number): T;
  createComputed(compute: (get: (atom: T) => number) => number): T;
  sub(store: S, atom: T, callback: () => void): () => void;
  get(store: S, atom: T): number;
}
