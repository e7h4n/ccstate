<script lang="ts">
  import type { State } from 'ccstate';
  import { useResolved } from '../useResolved';

  export let promise$: () => State<Promise<string>>;
  const result = useResolved(promise$());
</script>

{#if $result}
  <div>Result: {$result}</div>
{:else}
  <div>Loading</div>
{/if}
