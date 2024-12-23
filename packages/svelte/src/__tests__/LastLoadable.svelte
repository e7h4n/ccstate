<script lang="ts">
  import type { State } from 'ccstate';
  import { useLastLoadable } from '../useLoadable';

  export let promise$: () => State<Promise<string>>;
  const result = useLastLoadable(promise$());
</script>

{#if $result.state === 'loading'}
  <div>Loading</div>
{:else if $result.state === 'hasError'}
  <div>{$result.error}</div>
{:else}
  <div>Result: {$result.data}</div>
{/if}
