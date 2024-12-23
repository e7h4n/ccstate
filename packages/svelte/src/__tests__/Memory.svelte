<script lang="ts">
  import type { Computed } from 'ccstate';
  import { useGet } from '..';

  export let obj$: Computed<{ foo: string }>;
  const obj = useGet(obj$);
</script>

<div>obj: {$obj.foo}</div>
