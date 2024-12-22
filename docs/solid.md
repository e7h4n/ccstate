# Using in Solid.js

To begin using CCState in a Solid.js application, you need to utilize the `StoreProvider` to provide a store for the hooks.

```jsx
// main.tsx
import { createStore } from 'ccstate';
import { StoreProvider } from 'ccstate-solid';
import { App } from './App';

const store = createStore();

render(
  () => (
    <StoreProvider value={store}>
      <App />
    </StoreProvider>
  ),
  document.getElementById('root'),
);
```

All descendant components within the `StoreProvider` will use the provided store as the caller for `get` and `set` operations. If no provider is present, components will use the default store.

## Retrieving Values

The most basic usage is to use `useGet` to retrieve the value from State or Computed. Note that in Solid.js, `useGet` returns an accessor function.

```jsx
// data/count.ts
import { state } from 'ccstate';
export const count$ = state(0);

// App.tsx
import { useGet } from 'ccstate-solid';
import { count$ } from './data/count';

function App() {
  const count = useGet(count$);
  return <div>{count()}</div>; // Note: count is a function in Solid.js
}
```

`useGet` returns an accessor function that, when called, returns the current value of the State or Computed. When the value changes, components using the accessor will automatically re-render.

## Handling Async Values

For handling Promise values, CCState provides the `useResource` hook in Solid.js, which follows Solid's Resource pattern. If you're familiar with Solid's `createResource`, the API is very similar.

```jsx
// data/user.ts
import { computed } from 'ccstate';

export const user$ = computed(async () => {
  return fetch('/api/users/current').then((res) => res.json());
});

// App.tsx
import { useResource } from 'ccstate-solid';
import { user$ } from './data/user';

function App() {
  const user = useResource(user$);

  return (
    <Show when={!user.loading} fallback={<div>Loading...</div>}>
      <div>{user().name}</div>
    </Show>
  );
}
```

`useResource` returns a Resource object that includes:

- An accessor function to get the resolved value
- `loading` and `error` states
- `latest` property for maintaining previous values during refreshes

For more details about Resource patterns and state handling, refer to [Solid.js createResource documentation](https://docs.solidjs.com/reference/basic-reactivity/create-resource#v150).

## Maintaining Previous Values During Refreshes

When refreshing async data, you may want to keep showing the previous value instead of a loading state. The `latest` property from `useResource` helps achieve this:

```jsx
function App() {
  const data = useResource(async$);

  return (
    <Show when={data.latest} fallback={<div>Loading...</div>}>
      <div>Value: {data.latest}</div>
    </Show>
  );
}
```

## Updating State / Triggering Command

The `useSet` hook can be used to update the value of State or trigger Command. It returns a function that's equivalent to `store.set` when called.

```jsx
// App.tsx
import { useSet, useGet } from 'ccstate-solid';
import { count$ } from './data/count';

function App() {
  const count = useGet(count$);
  const setCount = useSet(count$);

  return <button onClick={() => setCount((c) => c + 1)}>Count: {count()}</button>;
}
```

For commands, `useSet` can be used to trigger the command execution:

```jsx
const increment$ = command(({ get, set }) => {
  const current = get(count$);
  set(count$, current + 1);
});

function App() {
  const triggerIncrement = useSet(increment$);
  return <button onClick={triggerIncrement}>Increment</button>;
}
```
