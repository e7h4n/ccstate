<script lang="ts">
  import Counter from './Counter.svelte';
  import { provideStore } from '..';
  import type { Store } from 'ccstate';

  export let store: Store | undefined = undefined;

  if (store) {
    provideStore(store);
  }
</script>

<Counter />
