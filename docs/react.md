# Using in React

To begin using CCState in a React application, you must utilize the `StoreProvider` to provide a store for the hooks.

```jsx
// main.tsx
import { createStore } from 'ccstate';
import { StoreProvider } from 'ccstate-react';
import { App } from './App';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const store = createStore();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider value={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
```

All descendant components within the `StoreProvider` will use the provided store as the caller for `get` and `set` operations.

You can place the `StoreProvider` inside or outside of `StrictMode`; the functionality is the same.

## Retrieving Values

The most basic usage is to use `useGet` to retrieve the value from State or Computed.

```jsx
// data/count.ts
import { state } from 'ccstate';
export const count$ = state(0);

// App.tsx
import { useGet } from 'ccstate-react';
import { count$ } from './data/count';

function App() {
  const count = useGet(count$);
  return <div>{count}</div>;
}
```

`useGet` returns a `State` or a `Computed` value, and when the value changes, `useGet` triggers a re-render of the component.

`useGet` does not do anything special with `Promise` values. In fact, `useGet` is equivalent to a single `store.get` call, plus a `store.sub` to ensure reactive updates to the React component.

Two other useful hooks are available when dealing with `Promise` values. First, we introduce `useLoadable`.

```jsx
// data/user.ts
import { computed } from 'ccstate';

export const user$ = computed(async () => {
  return fetch('/api/users/current').then((res) => res.json());
});

// App.tsx
import { useLoadable } from 'ccstate-react';
import { user$ } from './data/user';

function App() {
  const user_ = useLoadable(user$);
  if (user_.state === 'loading') return <div>Loading...</div>;
  if (user_.state === 'error') return <div>Error: {user_.error.message}</div>;

  return <div>{user_.data.name}</div>;
}
```

`useLoadable` accepts Value/Computed that returns a `Promise` and wraps the result in a `Loadable` structure.

```typescript
type Loadable<T> =
  | {
      state: 'loading';
    }
  | {
      state: 'hasData';
      data: T;
    }
  | {
      state: 'hasError';
      error: unknown;
    };
```

This allows you to render loading and error states in JSX based on the state. `useLoadable` suppresses exceptions, so it will not trigger an `ErrorBoundary`.

Another useful hook is `useResolved`, which always returns the resolved value of a `Promise`.

```jsx
// App.tsx
import { useResolved } from 'ccstate-react';
import { user$ } from './data/user';

function App() {
  const user = useResolved(user$);
  return <div>{user?.name}</div>;
}
```

`useResolved` only returns the parameter passed to the resolve function so that it will return `undefined` during loading and when encountering error values. Like `useLoadable`, `useResolved` also suppresses exceptions. In fact, `useResolved` is a simple wrapper around `useLoadable`.

```typescript
// useResolved.ts
import { useLoadable } from './useLoadable';
import type { Computed, State } from '../core';

export function useResolved<T>(atom: State<Promise<T>> | Computed<Promise<T>>): T | undefined {
  const loadable = useLoadable(atom);
  return loadable.state === 'hasData' ? loadable.data : undefined;
}
```

## useLastLoadable & useLastResolved

In some scenarios, we want a refreshable Promise Computed to maintain its previous result during the refresh process instead of showing a loading state. CCState provides `useLastLoadable` and `useLastResolved` to achieve this functionality.

```jsx
import { useLoadable } from 'ccstate-react';
import { user$ } from './data/user';

function App() {
  const user_ = useLastLoadable(user$); // Keep the previous result during new user$ request, without triggering loading state
  if (user_.state === 'loading') return <div>Loading...</div>;
  if (user_.state === 'error') return <div>Error: {user_.error.message}</div>;

  return <div>{user_.data.name}</div>;
}
```

`useLastResolved` behaves similarly - it always returns the last resolved value from a Promise Atom and won't reset to `undefined` when a new Promise is generated.

## Updating State / Triggering Command

The `useSet` hook can be used to update the value of State, or trigger Command. It returns a function equivalent to `store.set` when called.

```jsx
// App.tsx
import { useSet } from 'ccstate-react';
import { count$ } from './data/count';

function App() {
  const setCount = useSet(count$);
  // setCount(x => x + 1) is equivalent to store.set(count$, x => x + 1)
  return <button onClick={() => setCount((x) => x + 1)}>Increment</button>;
}
```

## Creating Inline Atoms

> [!CAUTION]
> Creating Inline Atoms is an experimental feature and may be changed in the future.

Using `useCCState`, `useComputed`, `useCommand` and `useSub` hooks, you can create atoms directly within your React components. This is useful for migrating existed React projects to CCState.

```jsx
import { useCCState, useComputed, useCommand } from 'ccstate-react/experimental';

function App() {
  const count$ = useCCState(0);
  const double$ = useComputed((get) => get(count$) * 2);
  const incrementTriple$ = useCommand(({ set, get }, diff: number) => set(count$, get(count$) + diff * 3));

  // ...
}
```

These atoms should be used by `useGet`, `useSet` as other normal atoms.

```jsx
function App() {
  const count$ = useCCState(0);
  const count = useGet(count$);
  const setCount = useSet(count$);

  return (
    <>
      <div>{count}</div>
      <button onClick={() => setCount((x) => x + 1)}>Increment</button>
    </>
  );
}
```

`useComputed` is similar to `useMemo`, but it can automatically track dependencies, so you don't need to manually specify a dependency array like with `useMemo`. And async `Computed` is also supported as normal.

However, during the computation process of `useComputed`, it's possible to access methods that can cause side effects on the Store, such as methods returned by other `useSet` calls. While this approach might work in some cases, CCState does not recommend this practice and won't test for stability under these circumstances. This is particularly important to note when migrating from `useMemo` to `useComputed`.

```jsx
function App() {
  const userId$ = useCCState('');
  const user$ = useComputed((get) => fetch(`/api/users/${get(userId$)}`).then((resp) => resp.json()));

  const updateUserId = useSet(userId$);
  const user = useLastResolved(user$);

  return (
    <>
      <div>{user?.name}</div>
      <input value={userId} onChange={(e) => updateUserId(e.target.value)} />
    </>
  );
}
```

`useCommand` is nothing special but should useful for passing a callback command to other components as props or another `Command`.

`useSub` is useful for migrating existing `useEffect` code. Although `sub` should be a restricted method in CCState, legacy React projects often contain numerous `useEffect` calls. Therefore, using `useSub` to replace some `useEffect` calls in a controlled manner, while gradually reducing the usage of `useSub`, can be helpful.

```jsx
import { useSub } from 'ccstate-react/experimental';

function App() {
  const count$ = useCCState(0);
  const double$ = useCCState(0);
  const onCountChange$ = useCommand(({ get, set }) => {
    set(double$, get(count$) * 2);
  });
  useSub(count$, onCountChange$);
}
```
