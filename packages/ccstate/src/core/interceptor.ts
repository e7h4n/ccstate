import type { Command, Computed, Signal, State } from '../../types/core/signal';
import type {
  CallbackFunc,
  ComputedState,
  InterceptorComputed,
  InterceptorGet,
  InterceptorNotify,
  InterceptorSet,
  InterceptorSub,
  InterceptorUnsub,
  SetArgs,
} from '../../types/core/store';

type DataWithCalledState<T> =
  | {
      called: false;
    }
  | {
      called: true;
      data: T;
    };

export function withSetInterceptor<T, Args extends SetArgs<T, unknown[]>>(
  fn: () => T | undefined,
  writable$: State<T> | Command<T, Args>,
  interceptor: InterceptorSet | undefined,
  ...args: Args
): T | undefined {
  if (!interceptor) {
    return fn();
  }

  let result = { called: false } as DataWithCalledState<T | undefined>;
  const wrappedFn = () => {
    result = { called: true, data: fn() };
    return result.data;
  };
  if ('write' in writable$) {
    interceptor(writable$, wrappedFn, ...args);
  } else {
    interceptor(writable$, wrappedFn, args[0]);
  }

  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }

  return result.data;
}

export function withGetInterceptor<T>(fn: () => T, signal: Signal<T>, interceptor?: InterceptorGet): T {
  if (!interceptor) {
    return fn();
  }

  let result = { called: false } as DataWithCalledState<T>;

  interceptor(signal, () => {
    result = { called: true, data: fn() };
    return result.data;
  });

  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }

  return result.data;
}

export function withComputedInterceptor<T>(
  fn: () => ComputedState<T>,
  signal: Computed<T>,
  interceptor?: InterceptorComputed,
): ComputedState<T> {
  if (!interceptor) {
    return fn();
  }

  let result = { called: false } as DataWithCalledState<ComputedState<T>>;

  interceptor(signal, () => {
    result = { called: true, data: fn() };
    return result.data.val;
  });

  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }

  return result.data;
}

export function withGeValInterceptor<T>(fn: () => T, signal: Signal<T>, interceptor?: InterceptorGet): T {
  if (!interceptor) {
    return fn();
  }

  let result = { called: false } as DataWithCalledState<T>;

  interceptor(signal, () => {
    result = { called: true, data: fn() };
    return result.data;
  });

  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }

  return result.data;
}

export function withSubInterceptor<T>(
  fn: () => void,
  signal: Signal<T>,
  callback$: Command<unknown, []>,
  interceptor?: InterceptorSub,
) {
  if (!interceptor) {
    fn();
    return;
  }

  let result = { called: false } as DataWithCalledState<void>;

  interceptor(signal, callback$, () => {
    result = { called: true, data: undefined };
    fn();
  });

  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }
}

export function withUnsubInterceptor<T>(
  fn: () => void,
  signal: Signal<T>,
  callback$: Command<unknown, []>,
  interceptor?: InterceptorUnsub,
): void {
  if (!interceptor) {
    fn();
    return;
  }

  let result = { called: false } as DataWithCalledState<void>;

  interceptor(signal, callback$, () => {
    result = { called: true, data: undefined };
    fn();
  });

  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }
}

export function withNotifyInterceptor<T>(fn: () => T, callback$: CallbackFunc<T>, interceptor?: InterceptorNotify): T {
  if (!interceptor) {
    return fn();
  }

  let result = { called: false } as DataWithCalledState<T>;

  interceptor(callback$, () => {
    result = { called: true, data: fn() };
    return result.data;
  });

  if (!result.called) {
    throw new Error('interceptor must call fn sync');
  }

  return result.data;
}
