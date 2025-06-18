<img src="https://github.com/user-attachments/assets/590797c8-6edf-45cc-8eae-028aef0b2cb3"  width="240" >

---

[![Coverage Status](https://coveralls.io/repos/github/e7h4n/ccstate/badge.svg?branch=main)](https://coveralls.io/github/e7h4n/ccstate?branch=main)
![NPM Type Definitions](https://img.shields.io/npm/types/ccstate)
![NPM Version](https://img.shields.io/npm/v/ccstate)
![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/ccstate)
[![CI](https://github.com/e7h4n/ccstate/actions/workflows/ci.yaml/badge.svg)](https://github.com/e7h4n/ccstate/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CCState is a modern signals-based state management library that elegantly implements async computed and read-write capability isolation based on signal features, making it suitable for medium to large web applications.

The name of CCState comes from three basic types: `Computed`, `Command`, and `State`.

## Quick Features

- ✈️ Intuitive async computation: using async/await or try/catch to process async flow as regular JavaScript without any additional concept
- 💯 Simple & Intuitive: Crystal-clear API design with just three types and two operations
- ✅ Rock-solid Reliability: Comprehensive test coverage reaching 100% branch coverage
- 💡 Framework Agnostic: Seamlessly works with [React](docs/react.md), [Vue](docs/vue.md), [Solid.js](docs/solid.md), [Vanilla](docs/vanilla.md), or any UI framework

## Getting Started

### Installation

```bash
# npm
npm i ccstate

# pnpm
pnpm add ccstate

# yarn
yarn add ccstate
```

### Create Signals

Use `state` to store a simple value unit, and use `computed` to create a derived computation logic:

```ts
// signals.js
import { state, computed } from 'ccstate';

// a simple value unit which supports read/write
export const userId$ = state('');

// intuitive async computation logic
export const user$ = computed(async (get) => {
  const userId = get(userId$);
  if (!userId) return null;

  const resp = await fetch(`https://api.github.com/users/${userId}`);
  return resp.json();
});
```

### Use signals in React

Use `useGet` and `useSet` hooks in React to get/set signals, and use `useResolved` to get Promise value.

```jsx
// App.jsx
import { useGet, useSet, useResolved } from 'ccstate-react';
import { userId$, user$ } from './signals';

export default function App() {
  const userId = useGet(userId$);
  const setUserId = useSet(userId$);
  const user = useResolved(user$);

  return (
    <div>
      <div>
        <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="github username" />
      </div>
      <div>
        <img src={user?.avatar_url} width="48" />
        <div>
          {user?.name}
          {user?.company}
        </div>
      </div>
    </div>
  );
}
```

That's it! [Click here to see the full example](https://stackblitz.com/edit/vitejs-vite-rert8c7a?file=src%2FApp.tsx).

Through these examples, you should have understood the basic usage of CCState. Next, you can read to learn about CCState's core APIs.

## Core APIs

CCState provides several simple concepts to help developers better manage application states. And it can be used as an external store to drive UI frameworks like React.

### State

`State` is the most basic value unit in CCState. A `State` can store any type of value, which can be accessed or modified through the store's `get`/`set` methods. Before explaining why it's designed this way, let's first look at the basic capabilities of `State`.

```typescript
import { store, state } from 'ccstate';

const store = createStore();

const userId$ = state(0);
store.get(userId$); // 0
store.set(userId$, 100);
store.get(userId$); // 100

const user$ = state<({
  name: 'e7h4n',
  avatar: 'https://avatars.githubusercontent.com/u/813596',
} | undefined>(undefined);

store.set({
  name: 'yc-kanyun',
  avatar: 'https://avatars.githubusercontent.com/u/168416598'
});
```

These examples should be very easy to understand. You might notice a detail in the examples: all variables returned by `state` have a `$` suffix. This is a naming convention used to distinguish an CCState signal type from other regular types. CCState signal types must be accessed through the store's get/set methods, and since it's common to convert an CCState signal type to a regular type using get, the `$` suffix helps avoid naming conflicts.

### Store

In CCState, declaring a `State` doesn't mean the value will be stored within the `State` itself. In fact, a `State` acts like a key in a Map, and CCState needs to create a Map to store the corresponding value for each `State` - this Map is the `Store`.

```typescript
const count$ = state(0); // count$: { init: 0 }

const store = createStore(); // imagine this as new Map()
store.set(count$, 10); // simply imagine as map[count$] = 10

const otherStore = createStore(); // another new Map()
otherStore.get(count$); // anotherMap[$count] ?? $count.init, returns 0
```

This should be easy to understand. If `Store` only needed to support `State` types, a simple Map would be sufficient. However, CCState needs to support another signal type. Next, let's introduce `Computed`, CCState's reactive computation unit.

### Computed

`Computed` is CCState's reactive computation unit. You can write derived computation logic in `Computed`, such as sending HTTP requests, data transformation, data aggregation, etc.

```typescript
import { computed, createStore } from 'ccstate';

const userId$ = state(0);
const user$ = computed(async (get) => {
  const userId = get(userId$);
  const resp = await fetch('/api/users/' + userId);
  return resp.json();
});

const store = createStore();
const user = await store.get(user$);
```

Does this example seem less intuitive than `State`? Here's a mental model that might help you better understand what's happening:

- `computed(fn)` returns an object `{read: fn}`, which is assigned to `user$`
- When `store.get(user$)` encounters an object which has a read function, it calls that function: `user$.read(store.get)`

This way, `Computed` receives a get accessor that can access other signal in the store. This get accessor is similar to `store.get` and can be used to read both `State` and `Computed`. The reason CCState specifically passes a get method to `Computed`, rather than allowing direct access to the store within `Computed`, is to shield the logic within `Computed` from other store methods like `store.set`. The key characteristic of `Computed` is that it can only read states from the store but cannot modify them. In other words, `Computed` is side-effect free.

In most cases, side-effect free computation logic is extremely useful. They can be executed any number of times and have few requirements regarding execution timing. `Computed` is one of the most powerful features in CCState, and you should try to write your logic as `Computed` whenever possible, unless you need to perform set operations on the `Store`.

### Command

`Command` is CCState's logic unit for organizing side effects. It has both `set` and `get` accessors from the store, allowing it to not only read other signal types but also modify `State` or call other `Command`.

```typescript
import { command, createStore } from 'ccstate';

const user$ = state<UserInfo | undefined>(undefined);
const updateUser$ = command(async ({ set }, userId) => {
  const user = await fetch('/api/users/' + userId).then((resp) => resp.json());
  set(user$, user);
});

const store = createStore();
store.set(updateUser$, 10); // fetchUserInfo(userId=10) and set to user$
```

Similarly, we can imagine the set operation like this:

- `command(fn)` returns an object `{write: fn}` which is assigned to `updateUser$`
- When `store.set(updateUser$)` encounters an object which has a `write` function, it calls that function: `updateUser$.write({set: store.set, get: store.get}, userId)`

Since `Command` can call the `set` method, it produces side effects on the `Store`. Therefore, its execution timing must be explicitly specified through one of these ways:

- Calling a `Command` through `store.set`
- Being called by the `set` method within other `Command`s

### Watching to Changes

CCState provides a `watch` method on the store to observe state change.

```typescript
import { createStore, state, computed, command } from 'ccstate';

const base$ = state(0);
const double$ = computed((get) => get(base$) * 2);

const store = createStore();
store.watch((get) => {
  console.log('double', get(double$));
});

store.set(base$, 10); // will log to console 'double 20'
```

Using an AbortSignal to cancel any watcher.

```typescript
const ctrl = new AbortController();
store.watch(
  (get) => {
    console.log('double', get(double$));
  },
  {
    signal: ctrl.signal,
  },
);

ctrl.abort(); // will cancel watch
```

Watchers intentionally do not have access to the store's `set` method. CCState encourages implementing derived computation logic through `Computed` rather than modifying data through change callbacks.

```typescript
// 🙅 use watch & store.set
const user$ = state(undefined);
const userId$ = state(0);
store.watch((get) => {
  const userId = get(userId$);
  const user = fetch('/api/users/' + userId).then((resp) => resp.json());
  store.set(user$, user);
});

// ✅ use computed
const userId$ = state(0);
const user$ = computed(async (get) => {
  return await fetch('/api/users/' + get(userId$)).then((resp) => resp.json());
});
```

Using `Computed` to write reactive logic has several advantages:

- No need to manage unsubscription
- No need to worry about it modifying other `State`s or calling other `Command`

Here's a simple rule of thumb:

> if some logic can be written as a `Computed`, it should be written as a `Computed`.

### Comprasion

| Type     | get | set |
| -------- | --- | --- |
| State    | ✅  | ✅  |
| Computed | ✅  | ❌  |
| Command  | ❌  | ✅  |

That's it! Next, you can learn how to use CCState in React.

## Patterns

`CCState` has some unique programming patterns.

### Computed with Arguments

In some cases, the computation process of `Computed` relies on some external parameters. However, the function definition of `Computed` prevents it from receiving parameters, which is intentional, as the function's parameters do not have the ability to be reactively subscribed.

There are two techniques that allow `Computed` to handle external parameters. Below is a simple example to introduce these two methods.

#### Args as State/Computed

Consider a simple scenario where the API for obtaining user information requires a userId. Defining this userId as a `State`/`Computed` allows it to be retrieved during the process of obtaining user information in Computed.

```javascript
const currentUserId$ = state<0>
const currentUser$ = computed(get => {
  const userId = get(currentUserId$)
  return fetch(`/api/users/${userId}`);
})
```

This technology is very useful for singleton data such as "currently logged-in user" and "currently opened product," as it directly reflects the responsive definition process of this data.

But for some types of data like list items, this technique is difficult to define a global id list `State`/`Computed`.

#### Args by function closure

We could pass some data into the calculation process of `Computed` through closure, for example:

```javascript
function getUser(userId) {
  return computed((get) => {
    return fetch(`/api/users/${userId}`);
  });
}

// Use such a list externally
const userList$ = state([]);
const addUser$ = command(({ set }, userId) => {
  set(userList$, (x) => {
    return [...x, getUser(userId)];
  });
});
```

It is easy to see that `userId` passed by the function parameters do not have reactive capabilities. Therefore, we can use this technique to distinguish the semantics of reactive arguments and non-reactive arguments.

#### Other Technologies

The `Command` has the ability to receive parameters, so we can encapsulate the above example into a `Command`:

```javascript
const getUser$ = command(({ set, get }, userId, sigal) => {
  return fetch(`/api/users/${userId}`, { signal });
});
```

However, this method requires that the caller must also be a `Command` in order to access the `set` method, which can easily lead to destructive passing of `Command`. If a `Command` itself does not produce side effects, then it should be considered to be written as a `Computed`.

### Serious Async Flow Cancellation

CCState's design philosophy aims to use the language's native capabilities for flow control as much as possible, including direct support for async/await. For Promise cancellation issues brought by asynchronous operations, CCState prefers to handle them using AbortSignal like fetch. When the following rules are satisfied, CCState can achieve very serious Async Flow cancellation capabilities, preventing unexpected side effects from occurring after the upstream task is aborted.

#### Rule 1: await in commands must perform abort signal check

```typescript
const updateUser$ = command(async ({ get }, signal: AbortSignal) => {
  const currentUser = await get(currentUser$); // Here we assume currentUser$ returns a Promise<User>
  signal.throwIfAbort(); // Must perform throwIfAbort check on the line after await
});
```

If the function after await accepts AbortSignal as a parameter, then the caller has no responsibility to perform throwIfAbort check, as it's assumed the callee has already done such check.

```typescript
const updateUser$ = command(async ({ get, set }, name: string, signal: AbortSignal) => {
  const currentUser = await get(currentUser$);
  signal.throwIfAbort();

  await set(updateUserName$, currentUser.id, name, signal); // Here we pass signal to the next command, so the current command doesn't need to check
});
```

`Computed` doesn't need such checks because Computed is side-effect free.

In `watch`, although it cannot produce side effects on the Store, it may produce external side effects. In this case, signal check is also needed.

```typescript
store.watch(
  (get, { signal }) => {
    void (async () => {
      const user = await get(currentUser$);
      signal.throwIfAbort();

      syncExternalState(user); // this code will not execute when externalAbortSignal abort
    })();
  },
  {
    signal: externalAbortSignal,
  },
);
```

### Rule 2: Do not intercept AbortError in try/catch

```typescript
const isAbortError = (error: unknown): boolean => {
  if ((error instanceof Error || error instanceof DOMException) && error.name === 'AbortError') {
    return true;
  }

  return false;
};

function throwIfAbort(e: unknown) {
  if (isAbortError(e)) {
    throw e;
  }
}

const updateUser$ = command(async ({ get, set }, name: string, signal: AbortSignal) => {
  // ...
  try {
    await set(updateUserName$, currentUser.id, name, signal);
  } catch (error: unknown) {
    throwIfAbort(error); // do not catch any AbortError
    // .. error handling
  }
});
```

## Using in React

[Using in React](docs/react.md)

## Using in Vue

[Using in Vue](docs/vue.md)

## Using in Solid.js

[Using in Solid.js](docs/solid.md)

## Using in Vanilla

[Using in Vanilla](docs/vanilla.md)

### Testing & Debugging

Testing Value/Computed should be as simple as testing a Map.

```typescript
// counter.test.ts
import { test } from 'vitest';
import { createStore, state } from 'ccstate';

test('test counter', () => {
  const store = createStore();
  const count$ = state(0);
  store.set(count$, 10);
  expect(store.get(count$)).toBe(10);
});
```

Here are some tips to help you better debug during testing.

### ConsoleInterceptor

Use `ConsoleInterceptor` to log most store behaviors to the console during testing:

```typescript
import { createDebugStore, state, computed, command } from 'ccstate';

const base$ = state(1, { debugLabel: 'base$' });
const derived$ = computed((get) => get(base$) * 2);

const store = createDebugStore([base$, 'derived'], ['set']); // log set actions
store.set(base$, 1); // console: SET [V0:base$] 1
```

## Concept behind CCState

CCState is inspired by Jotai. So everyone will ask questions: What's the ability of CCState that Jotai doesn't have?

The answer is: CCState intentionally has fewer features, simpler concepts, and less "magic" under the hood.

While Jotai is a great state management solution that has benefited the Motiff project significantly, as our project grew larger, especially with the increasing number of states (10k~100k atoms), we felt that some of Jotai's design choices needed adjustments, mainly in these aspects:

- Too many combinations of atom init/setter/getter methods, need simplification to reduce team's mental overhead
- Should reduce reactive capabilities, especially the `onMount` capability - the framework shouldn't provide this ability
- Some implicit magic operations, especially Promise wrapping, make the application execution process less transparent

To address these issues, I got an idea: "What concepts in Jotai are essential? And which concepts create mental overhead for developers?". Rather than just discussing it theoretically, I decided to try implementing it myself. So I created CCState to express my thoughts on state management. Before detailing the differences from Jotai, we need to understand CCState's signal types and subscription system.

### More semantic atom types

Like Jotai, CCState is also an Atom State solution. However, unlike Jotai, CCState doesn't expose Raw Atom, instead dividing Atoms into three types:

- `State` (equivalent to "Primitive Atom" in Jotai): `State` is a readable and writable "variable", similar to a Primitive Atom in Jotai. Reading a `State` involves no computation process, and writing to a `State` just like a map.set.
- `Computed` (equivalent to "Read-only Atom" in Jotai): `Computed` is a readable computed variable whose calculation process should be side-effect free. As long as its dependent Atoms don't change, repeatedly reading the value of a `Computed` should yield identical results. `Computed` is similar to a Read-only Atom in Jotai.
- `Command` (equivalent to "Write-only Atom" in Jotai): `Command` is used to encapsulate a process code block. The code inside an Command only executes when an external `set` call is made on it. `Command` is also the only type in ccstate that can modify value without relying on a store.

### Subscription System

CCState's subscription system is very different from Jotai's. First, the method name `watch` itself implies this is a read-only operation for observing state changes, not for modifying state.

Secondly, the subscription callback receives a `get` parameter, the consideration here is to avoid having callbacks depend on the Store object, which was a key design consideration when creating CCState. In CCState, `watch` is the only API with reactive capabilities, and CCState reduces the complexity of reactive computations by limiting Store usage.

In Jotai, there are no restrictions on writing code that uses sub within a sub callback:

```typescript
store.sub(targetAtom, () => {
  if (store.get(fooAtom)) {
    store.sub(barAtom, () => {
      // ...
    });
  }
});
```

In CCState, we can prevent this situation by moving the `Watcher` definition to a separate file and protecting the Store.

```typescript
// main.ts
import { fooWatcher } from './watchers';

function initApp() {
  const store = createStore();
  store.watch(fooWatcher);
  // do not expose store to outside
}

// watchers.ts
export const fooWatcher = (get) => {
  // there is no way to use store watch here
  get(foo$);
};
```

Therefore, in CCState, the capability of `watcher` is intentionally limited. CCState encourages developers to handle data consistency updates within `Computed` and `Watcher`, rather than relying on subscription capabilities for reactive data updates. In fact, in a React application, CCState's `watch` is likely only used in conjunction with `useSyncExternalStore` to update views, or other external state system out of CCState.

### Avoid `useEffect` in React

While Reactive Programming like `useEffect` has natural advantages in decoupling View Components, it causes many complications for editor applications like [Motiff](https://motiff.com).

Regardless of the original design semantics of `useEffect`, in the current environment, `useEffect`'s semantics are deeply bound to React's rendering behavior. When engineers use `useEffect`, they subconsciously think "callback me when these things change", especially "callback me when some async process is done". While it's easy to write such waiting code using `async/await`, it feels unnatural in React.

```jsx
// App.jsx
// Reactive Programming in React
export function App() {
  const userId = useUserId(); // an common hook to takeout userId from current location search params
  const [user, setUser] = useState();
  const [loading, setLoading] = useState();

  useEffect(() => {
    setLoading(true);
    fetch('/api/users/' + userId)
      .then((resp) => resp.json())
      .then((u) => {
        setLoading(false);
        setUser(u);
      });
  }, [userId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return <>{user?.name}</>;
}
```

When designing CCState, we wanted the trigger points for value changes to be completely detached from React's Mount/Unmount lifecycle and completely decoupled from React's rendering behavior.

```jsx
// signals.js
export const userId$ = state(0)
export const init$ = command(({set}) => {
  const userId = // ... parse userId from location search
  set(userId$, userId)
})

export const user$ = computed(get => {
  const userId = get(userId$)
  return fetch('/api/users/' + userId).then(resp => resp.json())
})

// App.jsx
export function App() {
  const user = useLastResolved(user$);
  return <>{user?.name}</>;
}

// main.jsx
const store = createStore();
store.set(init$)

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);
root.render(
  <StoreProvider value={store}>
    <App />
  </StoreProvider>,
);
```

### Less Magic

#### No `onMount`: Maintaining Pure State Semantics

CCState intentionally omits `onMount` to preserve the side-effect-free nature of `Computed` and `State`. This design choice emphasizes clarity and predictability over convenience.

Let's examine a common pattern in Jotai and understand why CCState takes a different approach. [Consider the following scenario](https://codesandbox.io/p/sandbox/gkk43v):

```typescript
// atom.ts
const countAtom = atom(0);
countAtom.onMount = (setAtom) => {
  const timer = setInterval(() => {
    setAtom((x) => x + 1);
  }, 1000);
  return () => {
    clearInterval(timer);
  };
};

// App.tsx
function App() {
  const count = useAtomValue(countAtom)
  return <div>{count}</div>
}
```

It looks pretty cool, right? Just by using `useAtomValue` in React, you get an auto-incrementing timer. However, this means that subscribing to a `State` can potentially have side effects. Because it has side effects, we need to be very careful handling these side effects in scenarios like `useExternalStore` and `StrictMode`. In CCState, such timer auto-increment operations can only be placed in a `Command`.

```tsx
// logic.ts
export const count$ = state(0); // state is always effect-less

export const setupTimer$ = command(({ set }) => {
  // command is considered to always have side effects
  const timer = setInterval(() => {
    set(count$, (x) => x + 1);
  }, 1000);
  return () => {
    clearInterval(timer);
  };
});

// Must explicitly enable side effects in React
// App.tsx
function App() {
  const count = useGet(count$);
  const setupTimer = useSet(setupTimer$);

  // Rendering App has side effects, so we explicitly enable them
  useEffect(() => {
    return setupTimer();
  }, []);

  return <div>{count}</div>;
}

// A more recommended approach is to enable side effects outside of React
// main.ts
store.watch(
  // watch is always effect-less to any State
  (get) => {
    get(count$); // ... onCount
  },
);
store.set(setupTimer$); // must setup effect explicitly

// ...

// The pure effect-less rendering process
root.render(function App() {
  const count = useGet(count$);

  return <div>{count}</div>;
});
```

I'm agree with [explicit is better than implicit](https://peps.python.org/pep-0020/), so CCState removes the `onMount` capability.

#### No `loadable` & `unwrap`

Jotai provides `loadable` and `unwrap` to handle Promise Atom, to convert them to a flat loading state atom. To implement this functionality, it inevitably needs to use `onMount` to subscribe to Promise changes and then modify its own return value.

As mentioned in the previous section, CCState does not provide `onMount`, so `loadable` and `unwrap` are neither present nor necessary in CCState. Instead, React hooks `useLoadable` and `useResolved` are provided as alternatives. The reason for this design is that I noticed a detail - only within a subscription system (like React's rendering part) do we need to convert a Promise into a loading state:

```tsx
// Jotai's example, since try/catch and async/await cannot be used in JSX, loadable is required to flatten the Promise
const userLoadableAtom = loadable(user$);
function User() {
  const user = useAtomValue(userLoadableAtom);
  if (user.state === 'loading') return <div>Loading...</div>;
  if (user.state === 'error') return <div>Error: {user.error.message}</div>;
  return <div>{user.data.name}</div>;
}
```

Or use loadable in the sub callback.

```ts
// Jotai's example
const userLoadableAtom = loadable(user$);

store.sub(userLoadableAtom, () => {
  // Notice how similar this is to the JSX code above
  const user = store.get(userLoadableAtom);
  if (user.state === 'loading') return;
  if (user.state === 'error') return;

  // ...
});
```

CCState intentionally avoids overuse of the subscription pattern, encouraging developers to write state changes where they originate rather than where they are responded to.

```ts
// CCState's example, avoid use sub pattern to invoke effect
const updateUserId$ = command(({ set, get }) => {
  // retrieve userId from somewhere
  set(userId$, USER_ID)

  set(connectRoom$)
})

const connectRoom$ = command({ set, get }) => {
  const user = await get(user$)
  // ... prepare connection for room
})
```

In React's subscription-based rendering system, I use `useEffect` to introduce subscription to Promises. The code below shows the actual implementation of `useLoadable`.

```ts
function useLastLoadable<T>(atom: State<Promise<T>> | Computed<Promise<T>>): Loadable<T> {
  const promise = useGet(atom);

  const [promiseResult, setPromiseResult] = useState<Loadable<T>>({
    state: 'loading',
  });

  useEffect(() => {
    const ctrl = new AbortController();
    const signal = ctrl.signal;

    void promise
      .then((ret) => {
        if (signal.aborted) return;

        setPromiseResult({
          state: 'hasData',
          data: ret,
        });
      })
      .catch((error: unknown) => {
        // ...
      });

    return () => {
      ctrl.abort();
    };
  }, [promise]);

  return promiseResult;
}
```

Finally, CCState only implements Promise flattening in the React-related range, that's enough. By making these design choices, CCState maintains a cleaner separation of concerns, makes side effects more explicit, and reduces the overall complexity of state management. While this might require slightly more explicit code in some cases, it leads to more maintainable and predictable applications.

## Technical Details

### When Computed Values Are Evaluated

The execution of `read` function in `Computed` has several strategies:

1. If the `Computed` is not directly or indirectly subscribed, it only be evaluated when accessed by `get`
   1. If the version number of other `Computed` | `State` accessed by the previous `read` is unchanged, use the result of the last `read` without re-evaluating it
   2. Otherwise, re-evaluate `read` and mark its version number +1
2. Otherwise, if the `Computed` is directly or indirectly subscribed, it will constantly be re-evaluated when its dependency changes

I mentioned "directly or indirectly subscribed" twice. Here, we use a simpler term to express it. If a `Computed | Value` is directly or indirectly subscribed, we consider it to be _mounted_. Otherwise, it is deemed to be _unmounted_.

Consider this example:

```typescript
const base$ = state(0);
const branch$ = state('A');
const derived$ = computed((get) => {
  if (get(branch$) !== 'B') {
    return 0;
  } else {
    return get(base$) * 2;
  }
});
```

In this example, `derived$` is not directly or indirectly subscribed, so it is always in the _unmounted_ state. At the same time, it has not been read, so it has no dependencies. At this point, resetting `base$` / `branch$` will not trigger the recomputation of `derived$`.

```
store.set(base$, 1) // will not trigger derived$'s read
store.set(branch$, 'C') // will not trigger derived$'s too
```

Once we read `derived$`, it will automatically record a dependency array.

```typescript
store.get(derived$); // return 0 because of branch$ === 'A'
```

At this point, the dependency array of `derived$` is `[branch$]`, because `derived$` did not access `base$` in the previous execution. Although CCState knows that `derived$` depends on `branch$`, because `branch$` is not mounted, the re-evaluation of `derived$` is lazy.

```typescript
store.set(branch$, 'D'); // will not trigger derived$'s read, until next get(derived$)
```

Once we mount `derived$` by `watch`, all its direct and indirect dependencies will enter the _mounted_ state.

```typescript
store.watch((get) => get(derived$));
```

The mount graph in CCState is `[derived$, [branch$]]`. When `branch$` is reset, `derived$` will be re-evaluated immediately, and all subscribers will be notified.

```typescript
store.set(branch$, 'B'); // will trigger derived$'s read
```

In this re-evaluation, the dependency array of `derived$` is updated to `[branch$, base$]`, so `base$` will also be _mounted_. Any modification to `base$` will immediately trigger the re-evaluation of `derived$`.

```typescript
store.set(base$, 1); // will trigger derived$'s read and notify all subscribers
```

[Here's an example](https://codesandbox.io/p/sandbox/ds6p44). Open preview in an independent window to check the console output. If you hide the double output and click increment, you will only see the `set` log.

```
[R][SET] V1:count$
    arg: – [function] (1)
    ret: – undefined
```

Click show to make double enter the display state, and you can see the `set` `showDouble$` log and the `double$` evaluation log.

```
[R][SET] V0:showDouble$
    arg: – [function] (1)
    ret: – undefined

[R][CPT] C2:doubleCount$
    ret: – 14
```

The abbreviation `CPT` represents `Computed` evaluation, not just a simple read operation. You can also try modifying the parameters of `createDebugStore` in the code to include `get` in the logs, and you'll find that not every `get` triggers a `Computed` evaluation.

Click increment to see the `set` trigger the `Computed` evaluation.

```
[R][SET] V1:count$
    arg: – [function] (1)
    [R][CPT] C2:doubleCount$
        ret: – 16
    ret: – undefined
```

### How to Isolate Effect-less Code

CCState strives to isolate effect-less code through API capability restrictions and thus introduces two accessor APIs: `get` and `set`. I remember when I first saw Jotai, I raised a question: why can't we directly use the Atom itself to read and write state, just like signals do?

Most state libraries allow you to directly read and write state once you get the state object:

```typescript
// Zustand
const useStore = create((set) => {
  return {
    count: 0,
    updateCount: () => {
      set({
        count: (x) => x + 1,
      });
    },
  };
});
useStore.getState().count; // read count is effect-less
useStore.getState().updateCount(); // update count invoke effect

// RxJS
const count$ = new BehaviorSubject(0);
count$.value; // read count is effect-less
count$.next(1); // next count invoke effect

// Signals
const counter = signal(0);
counter.value; // read value is effect-less
counter.value = 1; // write value invoke effect
```

So, these libraries cannot isolate effect-less code. Jotai and CCState choose to add a wrapper layer to isolate effect-less code.

```typescript
const count$ = state(0);
const double$ = computed((get) => {
  get(count$); // read count$ is effect-less
  // In this scope, we can't update any state
});
const updateDouble$ = command(({ get, set }) => {
  // This scope can update the state because it has `set` method
  set(count$, get(count$) * 2);
});
```

Isolating effect-less code is very useful in large projects, but is there a more straightforward way to write it? For example, a straightforward idea is to mark the current state of the `Store` as read-only when entering the `Computed` code block and then restore it to writable when exiting. In read-only mode, all `set` operations are blocked.

```typescript
const counter = state(0);
const double = computed(() => {
  // set store to read-only
  const result = counter.value * 2; // direct read value from counter instead of get(counter)
  // counter.value = 4; // any write operation in read-only mode will raise an  error
  return result;
}); // exit computed restore store to writable

double.value; // will enter read-only mode, evaluate double logic, get the result, and exit read-only mode
```

Unfortunately, this design will fail when encountering asynchronous callback functions in the current JavaScript language capabilities.

```typescript
const double = computed(async () => {
  // set store to read-only
  await delay(TIME_TO_DELAY);
  // How to restore the store to read-only here?
  // ...
});
```

When encountering `await`, the execution of `double.value` will end, and the framework code in `Computed` can restore the `Store` to writable. If we don't do this, the subsequent set operation will raise an error. But if we do this, when `await` re-enters the `double` read function, it will not be able to restore the `Store` to read-only.

Now, we are in the execution context that persists across async tasks; we hope to restore the Store's context to read-only when the async callback re-enters the `read` function. This direction has been proven to have many problems by [zone.js](https://github.com/angular/angular/tree/main/packages/zone.js). This is a dead end.

So, I think the only way to implement `Computed`'s effect-less is to separate the atom and the accessor.

## Changelog & TODO

[Changelog](packages/ccstate/CHANGELOG.md)

Here are some new ideas:

- Integration with svelte
- Enhance debug ability
  - Support viewing current subscription graph and related atom values
- Performance improvements
  - Mount atomState directly on atoms when there's only one store in the application to reduce WeakMap lookup overhead
  - Support static declaration of upstream dependencies for Computed to improve performance by disabling runtime dependency analysis

## Contributing

CCState welcomes any suggestions and Pull Requests. If you're interested in improving CCState, here are some basic steps to help you set up a CCState development environment.

```bash
pnpm install
pnpm husky # setup commit hooks to verify commit
pnpm vitest # to run all tests
pnpm lint # check code style & typing
```

## Special Thanks

Thanks [Jotai](https://github.com/pmndrs/jotai) for the inspiration and some code snippets, especially the test cases. Without their work, this project would not exist.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
