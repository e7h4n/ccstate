<script lang="ts">
  let props: {
    obj: () => object;
    cb: (obj: object) => void;
  } = $props();
  props.cb(props.obj());
</script>

<div>done</div>
