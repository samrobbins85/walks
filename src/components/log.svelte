<script lang="ts">
  import { ChartColumn, TableIcon } from "@lucide/svelte";
  import { hoursToHM } from "../utils/time";
  import { Chart, Svg, Axis, Bars, Tooltip } from "layerchart";
  import { scaleBand } from "d3-scale";
  import StatCard from "./statCard.svelte";
  import { timeMonth, timeYear } from "d3-time";
  import FormatDate from "./common/formatDate.svelte";

  let { logEntries } = $props();
  let timeFilter = $state("all-time");
  let display = $state("table");
  const isMonthly = $derived(timeFilter === "12-months");

  const month12Filter = (item) => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11, 1);
    return item.data.date >= twelveMonthsAgo;
  };

  const sortedEntries = $derived(
    logEntries
      .toSorted((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .filter(isMonthly ? month12Filter : () => true)
  );

  const stats = $derived.by(() => {
    const distance = Math.round(
      sortedEntries.reduce((p, c) => p + c.data.walk.data.length, 0)
    );
    const ascent = Math.round(
      sortedEntries.reduce((p, c) => p + c.data.walk.data.elevation, 0)
    );
    return { distance, ascent, count: sortedEntries.length };
  });

  const chartData = $derived.by(() => {
    if (sortedEntries.length === 0) return [];

    const dates = sortedEntries.map((e) => e.data.date);
    const [minDate, maxDate] = [Math.min(...dates), Math.max(...dates)].map(
      (d) => new Date(d)
    );

    const timeRange = isMonthly ? timeMonth : timeYear;
    const intervals = timeRange.range(
      timeRange.floor(minDate),
      timeRange.ceil(maxDate)
    );

    const getKey = (date) =>
      isMonthly
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : date.getFullYear().toString();

    const grouped = Object.fromEntries(
      intervals.map((d) => [getKey(d), { date: d, distance: 0 }])
    );

    sortedEntries.forEach((entry) => {
      grouped[getKey(entry.data.date)].distance += entry.data.walk.data.length;
    });

    return Object.values(grouped).sort((a, b) => a.date - b.date);
  });

  const dateFormat = $derived({
    type: isMonthly ? "month-year" : "year",
    options: { variant: isMonthly ? "short" : "long" },
  }) as unknown as any;

  const desiredBarWidth = 40;
  const bandPadding = 0.4;

  const minChartWidth = $derived(
    Math.max(600, (chartData.length * desiredBarWidth) / (1 - bandPadding))
  );
</script>

<div class="pt-6">
  <div class="flex justify-between flex-wrap items-center">
    <h1 class="text-4xl font-light mb-2">Log</h1>
    <div class="flex gap-4 flex-wrap">
      <div class="bg-gray-50 p-1 flex rounded-xl">
        <button
          onclick={() => (timeFilter = "all-time")}
          class={`rounded-lg px-2 py-1 flex items-center gap-x-2 ${timeFilter === "all-time" ? "bg-gray-200" : ""}`}
          >All time</button
        >
        <button
          onclick={() => (timeFilter = "12-months")}
          class={`rounded-lg px-2 py-1 flex items-center gap-x-2 ${timeFilter === "12-months" ? "bg-gray-200" : ""}`}
          >Past 12 months</button
        >
      </div>
      <div class="bg-gray-50 p-1 flex rounded-lg">
        <button
          onclick={() => (display = "table")}
          class={`rounded-lg px-2 py-1 flex items-center gap-x-2 ${display === "table" ? "bg-gray-200" : ""}`}
        >
          <TableIcon class="size-4" />
          Table</button
        >
        <button
          onclick={() => (display = "analytics")}
          class={`rounded-lg px-2 py-1 flex items-center gap-x-2 ${display === "analytics" ? "bg-gray-200" : ""}`}
        >
          <ChartColumn class="size-4" />
          Analytics</button
        >
      </div>
    </div>
  </div>
  {#if display === "table"}
    <div class="overflow-x-auto">
      <table class="relative min-w-max w-full divide-y divide-gray-300">
        <thead>
          <tr>
            <th
              scope="col"
              class="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-0"
              >Date</th
            >
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >Route</th
            >
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >Distance</th
            >
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >Duration</th
            >
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >Temperature</th
            >
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >Weather</th
            >
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          {#each sortedEntries as log}
            <tr>
              <td
                class="py-4 pr-3 pl-4 text-sm whitespace-nowrap text-gray-500 sm:pl-0"
              >
                <FormatDate date={log.data.date} />
              </td>
              <td class="px-3 py-4 text-sm whitespace-nowrap">
                <a
                  href={`/walks/${log.data.walk.data.slug}`}
                  class="underline font-medium text-black"
                >
                  {log.data.walk.data.title}
                </a>
              </td>
              <td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
                {Math.round(log.data.walk.data.length)}km
              </td>
              <td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
                {hoursToHM(log.data.duration)}
              </td>
              <td class="px-3 py-4 text-sm whitespace-nowrap text-gray-500">
                {log.data.temperature}℃
              </td>
              <td
                class="px-3 py-4 text-sm whitespace-nowrap text-gray-500 flex items-center gap-x-2"
              >
                <img
                  src={log.data.weather.data.image}
                  class="size-8"
                  alt=""
                />{" "}
                {log.data.weather.data.label}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <StatCard label="Total distance" value={`${stats.distance} km`} />
        <StatCard label="Walks" value={stats.count} />
        <StatCard label="Total ascent" value={`${stats.ascent} m`} />
        <StatCard
          label="Average distance"
          value={`${Math.round(stats.distance / stats.count)} km`}
        />
      </div>
      <div class="overflow-x-auto">
        <div
          class="h-[300px] p-4 border border-slate-200 rounded-lg mt-4 z-10"
          style="min-width: {minChartWidth}px;"
        >
          <Chart
            data={chartData}
            x="date"
            xScale={scaleBand().padding(0.4)}
            y="distance"
            yDomain={[0, null]}
            yNice={4}
            padding={{ top: 20, left: 40, right: 20, bottom: 20 }}
            tooltip={{
              mode: "band",
              touchEvents: "auto",
            }}
          >
            <Svg>
              <Axis placement="left" grid rule label="Distance (km)" />
              <Axis placement="bottom" format={dateFormat} rule />
              <Bars class="fill-nord14" />
            </Svg>
            <Tooltip.Root>
              {#snippet children({ data })}
                <Tooltip.Header format={dateFormat} value={data.date} />
                <Tooltip.List>
                  <Tooltip.Item
                    label="Distance"
                    value={`${Math.round(data.distance)} km`}
                  />
                </Tooltip.List>
              {/snippet}
            </Tooltip.Root>
          </Chart>
        </div>
      </div>
    </div>
  {/if}
</div>
