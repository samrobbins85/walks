<script>
  let { label, value } = $props();
</script>

<div
  class="flex flex-col border px-6 py-4 border-slate-200 rounded-lg justify-between"
>
  <span class="text-slate-500">{label}</span>
  <span class="text-2xl font-medium">{value}</span>
</div>
