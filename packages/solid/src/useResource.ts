import { createResource, type Resource } from 'solid-js';
import { useGet } from './useGet';
import type { Computed, State } from 'ccstate';

export function useResource<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Resource<T> {
  const [data] = createResource(useGet(atom), (promise) => {
    return promise;
  });

  return data;
}
