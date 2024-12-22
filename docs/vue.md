# Using in Vue

To begin using CCState in a Vue application, you must utilize the `provideStore` to provide a store for the composables.

```typescript
// main.ts
import { createStore } from 'ccstate';
import { provideStore } from 'ccstate-vue';
import { createApp } from 'vue';
import App from './App.vue';

const store = createStore();
const app = createApp(App);

// Provide store to all child components
provideStore(store);
app.mount('#app');
```

All descendant components will use the provided store as the caller for `get` and `set` operations.

## Retrieving Values

The most basic usage is to use `useGet` to retrieve the value from State or Computed.

```ts
// data/count.ts
import { state } from 'ccstate';
export const count$ = state(0);
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import { useGet } from 'ccstate-vue';
import { count$ } from './data/count';

const count = useGet(count$);
</script>

<template>
  <div>{{ count }}</div>
</template>
```

`useGet` returns a `State` or a `Computed` value, and when the value changes, the component will reactively update.

Two other useful composables are available when dealing with `Promise` values. First, we introduce `useLoadable`.

```ts
// data/user.ts
import { computed } from 'ccstate';
export const user$ = computed(async () => {
  return fetch('/api/users/current').then((res) => res.json());
});
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import { useLoadable } from 'ccstate-vue';
import { user$ } from './data/user';

const user_ = useLoadable(user$);
</script>

<template>
  <div v-if="user_.state === 'loading'">Loading...</div>
  <div v-else-if="user_.state === 'error'">Error: {{ user_.error.message }}</div>
  <div v-else>{{ user_.data.name }}</div>
</template>
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

Another useful composable is `useResolved`, which always returns the resolved value of a `Promise`.

```vue
<!-- App.vue -->
<script setup lang="ts">
import { useResolved } from 'ccstate-vue';
import { user$ } from './data/user';

const user = useResolved(user$);
</script>

<template>
  <div>{{ user?.name }}</div>
</template>
```

## useLastLoadable & useLastResolved

In some scenarios, we want a refreshable Promise Computed to maintain its previous result during the refresh process instead of showing a loading state. CCState provides `useLastLoadable` and `useLastResolved` to achieve this functionality.

```vue
<script setup lang="ts">
import { useLastLoadable } from 'ccstate-vue';
import { user$ } from './data/user';

const user_ = useLastLoadable(user$); // Keep the previous result during new user$ request
</script>

<template>
  <div v-if="user_.state === 'loading'">Loading...</div>
  <div v-else-if="user_.state === 'error'">Error: {{ user_.error.message }}</div>
  <div v-else>{{ user_.data.name }}</div>
</template>
```

## Updating State / Triggering Command

The `useSet` composable can be used to update the value of State, or trigger Command.

```vue
<script setup lang="ts">
import { useSet } from 'ccstate-vue';
import { count$ } from './data/count';

const setCount = useSet(count$);
// setCount(x => x + 1) is equivalent to store.set(count$, x => x + 1)
</script>

<template>
  <button @click="() => setCount((x) => x + 1)">Increment</button>
</template>
```
