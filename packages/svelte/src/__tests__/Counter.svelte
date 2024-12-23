<script lang="ts">
  import { count$, doubleIncrease$ } from './store';
  import { useGet } from '..';
  import { useSet } from '..';

  const count = useGet(count$);
  const setCount = useSet(count$);
  const doubleIncrease = useSet(doubleIncrease$);
</script>

<div>count: {$count}</div>
<button
  on:click={() => {
    setCount((x) => x + 1);
  }}
>
  Increment
</button>

<button on:click={() => doubleIncrease(10)}>Double Increase</button>
