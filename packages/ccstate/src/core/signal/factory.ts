import type { Computed, Command, Read, State, Write } from '../../../types/core/signal';

interface Options {
  debugLabel?: string;
}

let globalId = 0;

const generateToString = (id: number, prefix: string, debugLabel?: string) => {
  const label = `${prefix}${String(id)}${debugLabel ? ':' + debugLabel : ''}`;
  return () => label;
};

export function state<T>(init: T, options?: Options): State<T> {
  const id = globalId++;
  const ret: State<T> = {
    id,
    init,
    toString: generateToString(id, 'S', options?.debugLabel),
  };

  if (options?.debugLabel) {
    ret.debugLabel = options.debugLabel;
  }
  return ret;
}

export function computed<T>(read: Read<T>, options?: Options): Computed<T> {
  const id = globalId++;
  const ret: Computed<T> = {
    id,
    read,
    toString: generateToString(id, 'CPT', options?.debugLabel),
  };

  if (options?.debugLabel) {
    ret.debugLabel = options.debugLabel;
  }
  return ret;
}

export function command<T, Args extends unknown[]>(write: Write<T, Args>, options?: Options): Command<T, Args> {
  const id = globalId++;
  const ret: Command<T, Args> = {
    id,
    write,
    toString: generateToString(id, 'CMD', options?.debugLabel),
  };
  if (options?.debugLabel) {
    ret.debugLabel = options.debugLabel;
  }
  return ret;
}
