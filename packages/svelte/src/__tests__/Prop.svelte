<script lang="ts">
  import type { State } from 'ccstate';
  import { useGet } from '../useGet';
  import { useSet } from '../useSet';

  let props: {
    count$: State<number>;
  } = $props();
  const number = useGet(props.count$);
  const updateNumber = useSet(props.count$);
  updateNumber(100);
</script>

<div>{$number}</div>
