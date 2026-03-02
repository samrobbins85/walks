<script lang="ts">
  import { Compass, Loader2, AlertTriangle, Sun, Clock, Footprints, Train, Bus } from "@lucide/svelte";
  import { hoursToHM } from "../utils/time";

  interface TransportLeg {
    mode: "train" | "bus" | "metro";
    line: string;
    from: string;
    to: string;
    operator: string;
    noc?: string;
    crs_from?: string;
    crs_to?: string;
    url?: string;
  }

  interface TimelineEntry {
    time: string;
    label: string;
    type: "depart" | "arrive" | "walk_start" | "walk_end" | "transit" | "info";
    transitDetail?: {
      lineName?: string;
      agencyName?: string;
      vehicleType?: string;
    };
  }

  interface PlanResponse {
    sunset: string;
    sunsetISO: string;
    timeline: TimelineEntry[];
    sunsetMarginMinutes: number;
    warnings: string[];
  }

  let {
    walkDuration,
    walkLength,
    startCoords,
    endCoords,
    outboundTransport = [],
    returnTransport = [],
  }: {
    walkDuration: number;
    walkLength: number;
    startCoords: [number, number];
    endCoords: [number, number];
    outboundTransport: TransportLeg[];
    returnTransport: TransportLeg[];
  } = $props();

  let isOpen = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let plan = $state<PlanResponse | null>(null);

  // Default to next Saturday
  function getNextSaturday(): string {
    const now = new Date();
    const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + daysUntilSat);
    return saturday.toISOString().split("T")[0];
  }

  let selectedDate = $state(getNextSaturday());
  let paceMultiplier = $state(1.0);
  let bufferStart = $state(15);
  let bufferEnd = $state(15);

  const adjustedDuration = $derived(walkDuration * paceMultiplier);

  async function generatePlan() {
    loading = true;
    error = null;
    plan = null;

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          walkDuration,
          startCoords,
          endCoords,
          outboundLegs: outboundTransport,
          returnLegs: returnTransport,
          bufferStart,
          bufferEnd,
          paceMultiplier,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? `Request failed: ${response.status}`);
      }

      plan = await response.json();
    } catch (e) {
      error = e instanceof Error ? e.message : "An error occurred";
    } finally {
      loading = false;
    }
  }

  function formatSunsetMargin(minutes: number): string {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? "-" : "";
    return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
  }

  function getTransitIcon(vehicleType?: string) {
    if (vehicleType === "BUS") return Bus;
    return Train;
  }
</script>

<div class="mt-8">
  {#if !isOpen}
    <button
      onclick={() => (isOpen = true)}
      class="flex items-center gap-x-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-600 transition-colors"
    >
      <Compass class="size-4" />
      Plan this walk
    </button>
  {:else}
    <div class="bg-slate-50 rounded-lg p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Route Planner
        </h2>
        <button
          onclick={() => { isOpen = false; plan = null; error = null; }}
          class="text-sm text-slate-400 hover:text-slate-600"
        >
          Close
        </button>
      </div>

      <!-- Controls -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label for="plan-date" class="block text-xs text-slate-500 mb-1">Date</label>
          <input
            id="plan-date"
            type="date"
            bind:value={selectedDate}
            class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
          />
        </div>
        <div>
          <label for="pace" class="block text-xs text-slate-500 mb-1">
            Pace: {paceMultiplier.toFixed(1)}x ({hoursToHM(adjustedDuration)})
          </label>
          <input
            id="pace"
            type="range"
            min="0.8"
            max="1.5"
            step="0.1"
            bind:value={paceMultiplier}
            class="w-full"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label for="buffer-start" class="block text-xs text-slate-500 mb-1">
            Buffer at start: {bufferStart} min
          </label>
          <input
            id="buffer-start"
            type="range"
            min="5"
            max="30"
            step="5"
            bind:value={bufferStart}
            class="w-full"
          />
        </div>
        <div>
          <label for="buffer-end" class="block text-xs text-slate-500 mb-1">
            Buffer at end: {bufferEnd} min
          </label>
          <input
            id="buffer-end"
            type="range"
            min="5"
            max="45"
            step="5"
            bind:value={bufferEnd}
            class="w-full"
          />
        </div>
      </div>

      <button
        onclick={generatePlan}
        disabled={loading}
        class="flex items-center gap-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg text-sm transition-colors"
      >
        {#if loading}
          <Loader2 class="size-4 animate-spin" />
          Planning...
        {:else}
          Generate plan
        {/if}
      </button>

      <!-- Error -->
      {#if error}
        <div class="mt-4 flex items-start gap-x-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
          <AlertTriangle class="size-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      {/if}

      <!-- Result -->
      {#if plan}
        <div class="mt-5">
          <!-- Warnings -->
          {#each plan.warnings as warning}
            <div class="mb-3 flex items-start gap-x-2 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
              <AlertTriangle class="size-4 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          {/each}

          <!-- Timeline -->
          <div class="relative pl-6">
            <!-- Vertical line -->
            <div class="absolute left-[7px] top-2 bottom-2 w-px bg-slate-300"></div>

            {#each plan.timeline as entry, i}
              <div class="relative flex items-start gap-x-3 pb-5 last:pb-0">
                <!-- Dot -->
                <div
                  class="absolute left-[-20px] mt-1.5 w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center {
                    entry.type === 'walk_start' || entry.type === 'walk_end'
                      ? 'border-orange-400 bg-orange-50'
                      : entry.type === 'transit'
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-300 bg-white'
                  }"
                >
                  {#if entry.type === 'walk_start' || entry.type === 'walk_end'}
                    <Footprints class="size-2.5 text-orange-500" />
                  {:else if entry.type === 'transit'}
                    <svelte:component this={getTransitIcon(entry.transitDetail?.vehicleType)} class="size-2.5 text-blue-500" />
                  {/if}
                </div>

                <div class="flex items-baseline gap-x-3 min-w-0">
                  <span class="text-sm font-mono text-slate-500 flex-shrink-0 w-12">
                    {entry.time}
                  </span>
                  <div class="text-sm text-slate-700">
                    <span>{entry.label}</span>
                    {#if entry.type === 'walk_start'}
                      <span class="text-slate-400 ml-1">
                        ({hoursToHM(adjustedDuration)} walk, {walkLength} km)
                      </span>
                    {/if}
                    {#if entry.transitDetail?.lineName}
                      <span
                        class="inline-block ml-1 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700"
                      >
                        {entry.transitDetail.lineName}
                      </span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Sunset info -->
          <div class="mt-4 flex items-center gap-x-2 p-3 bg-amber-50 rounded-lg text-sm {
            plan.sunsetMarginMinutes < 30 ? 'text-red-700 bg-red-50' : 'text-amber-700'
          }">
            <Sun class="size-4 flex-shrink-0" />
            <span>
              Sunset at {plan.sunset} — {formatSunsetMargin(plan.sunsetMarginMinutes)} margin
            </span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
