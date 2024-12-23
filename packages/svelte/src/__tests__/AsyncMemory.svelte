<script lang="ts">
  import type { Computed } from 'ccstate';
  import { useLastResolved } from '../useResolved';

  export let obj$: () => Computed<Promise<{ foo: string }>>;
  const obj = useLastResolved(obj$());
</script>

<div>obj: {$obj?.foo}</div>
