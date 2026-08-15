import type {
  AsyncSnapshot,
  AsyncStatus,
  Computed,
  Command,
  Read,
  Resource,
  ResourceController,
  Signal,
  State,
  Write,
} from '../../../types/core/signal';

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

function createResourceSignal<T>(source: Signal<T | Promise<T>>, options?: Options): Resource<T> {
  const id = globalId++;
  const resource: Resource<T> = {
    id,
    init: {
      status: 'idle',
      data: undefined,
      error: undefined,
    } satisfies AsyncSnapshot<T>,
    source,
    controller: undefined as unknown as ResourceController<T>,
    debugLabel: options?.debugLabel,
    toString: generateToString(id, 'RES', options?.debugLabel),
  };

  resource.controller = computed((get) => get(source), {
    debugLabel: options?.debugLabel ? `${options.debugLabel}.controller` : undefined,
  }) as ResourceController<T>;
  resource.controller.resource = resource;

  return resource;
}

export interface AsyncResource<T> {
  snapshot$: Resource<T>;
  data$: Computed<T | undefined>;
  loading$: Computed<boolean>;
  error$: Computed<unknown>;
  status$: Computed<AsyncStatus>;
}

export function resource<T>(source: Signal<T | Promise<T>>, options?: Options): AsyncResource<T> {
  const snapshot$ = createResourceSignal(source, options);
  const label = options?.debugLabel ?? 'resource';

  return {
    snapshot$,
    data$: computed((get) => get(snapshot$).data, { debugLabel: `${label}.data` }),
    loading$: computed((get) => get(snapshot$).status === 'loading', { debugLabel: `${label}.loading` }),
    error$: computed((get) => get(snapshot$).error, { debugLabel: `${label}.error` }),
    status$: computed((get) => get(snapshot$).status, { debugLabel: `${label}.status` }),
  };
}
