<script lang="ts">
  import type { State } from 'ccstate';
  import { useLastResolved } from '../useResolved';

  export let promise$: () => State<Promise<string>>;
  const result = useLastResolved(promise$());
</script>

{#if $result}
  <div>Result: {$result}</div>
{:else}
  <div>Loading</div>
{/if}
