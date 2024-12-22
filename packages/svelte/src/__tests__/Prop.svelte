<script lang="ts">
  let props: {
    obj: {};
    cb: (obj: {}) => void;
  } = $props();
  props.cb(props.obj);
</script>

<div>done</div>
