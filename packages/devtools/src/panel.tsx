import { StoreInspector } from './components/store-inspector';
import { type DevToolsHookMessage, type Store } from 'ccstate';
import { StoreProvider } from 'ccstate/react';
import type { ReactNode } from 'react';
import { clearEvents$, onEvent$ } from './atoms/events';

export function setupUI(render: (children: ReactNode) => void, store: Store) {
  render(
    <>
      <StoreProvider value={store}>
        <StoreInspector />
      </StoreProvider>
    </>,
  );
}

export function setupStore(store: Store, window: Window, signal?: AbortSignal) {
  window.addEventListener(
    'message',
    ({ data }: { data: DevToolsHookMessage | undefined | 'knockknock' }) => {
      if (data === 'knockknock') {
        store.set(clearEvents$);
        return;
      }

      if (!data || !('source' in data) || (data as unknown as { source: string }).source !== 'ccstate-store') {
        return;
      }

      store.set(onEvent$, data.payload);
    },
    {
      signal,
    },
  );
}
