import { inject, provide, type InjectionKey } from 'vue';
import type { Store } from 'ccstate';

export const StoreKey = Symbol('ccstate-vue-store') as InjectionKey<Store>;

export const provideStore = (store: Store) => {
  provide(StoreKey, store);
};

export const useStore = (): Store => {
  return inject(
    StoreKey,
    () => {
      throw new Error('useStore must be used within a provideStore');
    },
    true,
  );
};
