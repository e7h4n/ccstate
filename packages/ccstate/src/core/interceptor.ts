import type { Signal } from '../../types/core/atom';
import type { InterceptorGet, InterceptorSub } from '../../types/core/store';
import type { SignalState } from './signal-manager';

type DataWithCalledState<T> =
  | {
      called: false;
    }
  | {
      called: true;
      data: T;
    };

export function withGetStateInterceptor<T, U extends SignalState<T>>(
  fn: () => U,
  signal: Signal<T>,
  interceptor?: InterceptorGet,
): U {
  if (!interceptor) {
    return fn();
  }

  let result = { called: false } as DataWithCalledState<U>;

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
