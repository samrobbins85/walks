<script lang="ts">
  interface Props {
    date: Date;
  }

  let { date }: Props = $props();
</script>

<time datetime={date.toISOString()}>
  {date.toLocaleDateString("en-gb", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })}
</time>
