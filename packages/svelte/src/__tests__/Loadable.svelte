<script lang="ts">
  import type { State } from 'ccstate';
  import { useLoadable } from '../useLoadable';

  export let promise$: State<Promise<string>>;
  const result = useLoadable(promise$);
</script>

{#if $result.state === 'loading'}
  <div>Loading</div>
{:else if $result.state === 'hasError'}
  <div>{$result.error}</div>
{:else}
  <div>Result: {$result.data}</div>
{/if}
