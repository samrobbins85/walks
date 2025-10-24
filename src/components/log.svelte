<script>
  import { ChartColumn, TableIcon } from "@lucide/svelte";
  import { hoursToHM } from "../utils/time";
  import FormatDate from "./common/formatDate.svelte";
  import { Chart, Svg, Axis, Bars, Tooltip } from "layerchart";
  import { scaleBand } from "d3-scale";
  import { format, PeriodType } from "@layerstack/utils";
  let { logEntries } = $props();
  let timeFilter = $state("all-time");
  let display = $state("table");
  const month12Filter = (item) => {
    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(now.getMonth() - 12);
    return item.data.date >= twelveMonthsAgo;
  };

  const sortedEntries = $derived(
    logEntries
      .toSorted((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .filter(timeFilter === "12-months" ? month12Filter : () => true)
  );

  const totalDistance = $derived(
    Math.round(sortedEntries.reduce((p, c) => p + c.data.walk.data.length, 0))
  );

  const totalAscent = $derived(
    Math.round(
      sortedEntries.reduce((p, c) => p + c.data.walk.data.elevation, 0)
    )
  );

  const chartData = $derived.by(() => {
    const grouped = {};

    sortedEntries.forEach((entry) => {
      const date = entry.data.date;
      let key, groupDate;

      if (timeFilter === "12-months") {
        // Group by month
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        groupDate = new Date(date.getFullYear(), date.getMonth(), 1);
      } else {
        // Group by year
        key = date.getFullYear().toString();
        groupDate = new Date(date.getFullYear(), 0, 1);
      }

      if (!grouped[key]) {
        grouped[key] = {
          date: groupDate,
          distance: 0,
        };
      }

      grouped[key].distance += entry.data.walk.data.length;
    });

    // Convert to array and sort by date
    return Object.values(grouped).sort((a, b) => a.date - b.date);
  });

  const formatDate = (date) => {
    console.log(date);
    const formatted = format(
      date,
      timeFilter === "12-months"
        ? PeriodType.MonthYear
        : PeriodType.CalendarYear,
      { variant: timeFilter === "12-months" ? "short" : "long" }
    );
    console.log(formatted);
    return formatted;
  };

  const desiredBarWidth = 40;
  const bandPadding = 0.4;

  const widthPerPoint = desiredBarWidth / (1 - bandPadding);

  const minChartWidth = $derived(
    Math.max(600, chartData.length * widthPerPoint)
  );
</script>

<div class="pt-6">
  <div class="flex justify-between flex-wrap">
    <h1 class="text-2xl font-light mb-2">Log</h1>
    <div class="flex gap-4 flex-wrap">
      <div class="bg-gray-50 p-1 flex rounded-lg">
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
          <TableIcon />
          Table</button
        >
        <button
          onclick={() => (display = "analytics")}
          class={`rounded-lg px-2 py-1 flex items-center gap-x-2 ${display === "analytics" ? "bg-gray-200" : ""}`}
        >
          <ChartColumn />
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
      <div class="grid md:grid-cols-4 gap-6 mt-4">
        <div
          class="flex flex-col-reverse border px-6 py-4 border-slate-200 rounded-lg"
        >
          <span class="text-2xl font-medium">{totalDistance} km</span>
          <span class="text-slate-500">Total distance</span>
        </div>
        <div
          class="flex flex-col-reverse border px-6 py-4 border-slate-200 rounded-lg"
        >
          <span class="text-2xl font-medium">{sortedEntries.length}</span>
          <span class="text-slate-500">Walks</span>
        </div>
        <div
          class="flex flex-col-reverse border px-6 py-4 border-slate-200 rounded-lg"
        >
          <span class="text-2xl font-medium">{totalAscent} m</span>
          <span class="text-slate-500">Total ascent</span>
        </div>
        <div
          class="flex flex-col-reverse border px-6 py-4 border-slate-200 rounded-lg"
        >
          <span class="text-2xl font-medium"
            >{Math.round(totalDistance / sortedEntries.length)} km</span
          >
          <span class="text-slate-500">Average distance</span>
        </div>
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
            padding={{ top: 20, left: 20, right: 20, bottom: 20 }}
            tooltip={{
              mode: "band",
              touchEvents: "auto",
            }}
          >
            <Svg>
              <Axis placement="left" grid rule />
              <Axis placement="bottom" format={(d) => formatDate(d)} rule />
              <Bars class="fill-emerald-600" />
            </Svg>
            <Tooltip.Root>
              {#snippet children({ data })}
                <Tooltip.Header value={formatDate(data.date)} />
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
