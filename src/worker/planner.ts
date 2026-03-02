import SunCalc from "suncalc";
import {
  fetchTransitOptions,
  type TransitOption,
  type Waypoint,
} from "./google-routes";

export interface TransportLeg {
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

export interface PlanRequest {
  date: string; // "YYYY-MM-DD"
  walkDuration: number; // decimal hours
  startCoords: [number, number]; // [lng, lat]
  endCoords: [number, number]; // [lng, lat]
  outboundLegs: TransportLeg[];
  returnLegs: TransportLeg[];
  bufferStart: number; // minutes
  bufferEnd: number; // minutes
  paceMultiplier: number;
}

export interface TimelineEntry {
  time: string; // "HH:MM"
  label: string;
  type: "depart" | "arrive" | "walk_start" | "walk_end" | "transit" | "info";
  transitDetail?: {
    lineName?: string;
    agencyName?: string;
    vehicleType?: string;
  };
}

export interface PlanResponse {
  sunset: string; // "HH:MM"
  sunsetISO: string;
  timeline: TimelineEntry[];
  sunsetMarginMinutes: number;
  warnings: string[];
}

interface PlannerEnv {
  GOOGLE_MAPS_API_KEY: string;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export async function computeRoutePlan(
  request: PlanRequest,
  env: PlannerEnv,
): Promise<PlanResponse> {
  const warnings: string[] = [];
  const [year, month, day] = request.date.split("-").map(Number);

  // Compute sunset using walk endpoint coordinates
  // SunCalc expects (date, lat, lng) — our coords are [lng, lat]
  const sunsetDate = new Date(year, month - 1, day, 12, 0, 0);
  const sunTimes = SunCalc.getTimes(
    sunsetDate,
    request.endCoords[1],
    request.endCoords[0],
  );
  const sunset = sunTimes.sunset;

  // Safety buffer: finish 30 minutes before sunset
  const daylightDeadline = addMinutes(sunset, -30);

  // Adjusted walk duration
  const adjustedDuration = request.walkDuration * request.paceMultiplier;

  // Determine origin/destination for Google Routes from transport leg place names
  // Return: first return leg's "from" → last return leg's "to"
  // e.g. [Bamburgh→Chathill (bus), Chathill→Newcastle (train)] = Bamburgh→Newcastle
  const returnOrigin = request.returnLegs[0]?.from;
  const returnDest = request.returnLegs[request.returnLegs.length - 1]?.to;

  // Outbound: first outbound leg's "from" → last outbound leg's "to"
  // e.g. [Newcastle→Alnmouth (train)] = Newcastle→Alnmouth
  const outboundOrigin = request.outboundLegs[0]?.from;
  const outboundDest =
    request.outboundLegs[request.outboundLegs.length - 1]?.to;

  // Fetch return and outbound transport in parallel
  const searchStartTime = new Date(year, month - 1, day, 12, 0, 0);
  const outboundSearchTime = new Date(year, month - 1, day, 6, 0, 0);

  const [returnResult, outboundResult] = await Promise.allSettled([
    returnOrigin && returnDest
      ? fetchTransitOptions(
          { type: "address", address: `${returnOrigin}, UK` },
          { type: "address", address: `${returnDest}, UK` },
          searchStartTime,
          env,
        )
      : Promise.resolve([]),
    outboundOrigin && outboundDest
      ? fetchTransitOptions(
          { type: "address", address: `${outboundOrigin}, UK` },
          { type: "address", address: `${outboundDest}, UK` },
          outboundSearchTime,
          env,
        )
      : Promise.resolve([]),
  ]);

  let returnOptions: TransitOption[] = [];
  if (returnResult.status === "fulfilled") {
    returnOptions = returnResult.value;
  } else {
    warnings.push(
      `Could not fetch return transport: ${returnResult.reason}`,
    );
  }

  let outboundOptions: TransitOption[] = [];
  if (outboundResult.status === "fulfilled") {
    outboundOptions = outboundResult.value;
  } else {
    warnings.push(
      `Could not fetch outbound transport: ${outboundResult.reason}`,
    );
  }

  // Find the best return option: latest departure where we can finish walking in time
  let selectedReturn: TransitOption | null = null;

  if (returnOptions.length > 0) {
    const sorted = returnOptions.toSorted(
      (a, b) => b.departureTime.getTime() - a.departureTime.getTime(),
    );

    for (const option of sorted) {
      const latestFinishForThis = addMinutes(
        option.departureTime,
        -request.bufferEnd,
      );
      if (latestFinishForThis <= daylightDeadline) {
        selectedReturn = option;
        break;
      }
    }

    if (!selectedReturn) {
      selectedReturn = sorted[sorted.length - 1];
      warnings.push(
        "No return transport found before sunset. Showing earliest available option.",
      );
    }
  } else if (returnOrigin && returnDest) {
    warnings.push(
      "No return transport options found. Showing sunset-based timing only.",
    );
  }

  // Calculate latest finish time
  let latestFinish: Date;
  if (selectedReturn) {
    const returnBasedFinish = addMinutes(
      selectedReturn.departureTime,
      -request.bufferEnd,
    );
    latestFinish =
      returnBasedFinish < daylightDeadline
        ? returnBasedFinish
        : daylightDeadline;
  } else {
    latestFinish = daylightDeadline;
  }

  // Work backwards to find walk start time
  const walkStartTime = addHours(latestFinish, -adjustedDuration);
  const latestArrival = addMinutes(walkStartTime, -request.bufferStart);

  // Find best outbound option: latest that arrives before latestArrival
  let selectedOutbound: TransitOption | null = null;

  if (outboundOptions.length > 0) {
    const sorted = outboundOptions.toSorted(
      (a, b) => b.arrivalTime.getTime() - a.arrivalTime.getTime(),
    );

    for (const option of sorted) {
      if (option.arrivalTime <= latestArrival) {
        selectedOutbound = option;
        break;
      }
    }

    if (!selectedOutbound) {
      selectedOutbound = sorted[sorted.length - 1];
    }
  }

  // Build the timeline
  const timeline: TimelineEntry[] = [];

  // Outbound legs
  if (selectedOutbound) {
    for (const leg of selectedOutbound.legs) {
      if (leg.mode === "TRANSIT") {
        timeline.push({
          time: formatTime(leg.departureTime),
          label: `${leg.departureStop ?? outboundOrigin} → ${leg.arrivalStop ?? outboundDest}`,
          type: "transit",
          transitDetail: {
            lineName: leg.lineName,
            agencyName: leg.agencyName,
            vehicleType: leg.vehicleType,
          },
        });
      }
    }

    timeline.push({
      time: formatTime(selectedOutbound.arrivalTime),
      label: `Arrive at ${outboundDest}`,
      type: "arrive",
    });
  } else if (outboundDest) {
    timeline.push({
      time: formatTime(latestArrival),
      label: `Arrive at ${outboundDest} by this time`,
      type: "arrive",
    });
  }

  // Walking
  timeline.push({
    time: formatTime(walkStartTime),
    label: "Start walking",
    type: "walk_start",
  });

  timeline.push({
    time: formatTime(latestFinish),
    label: "Finish walking",
    type: "walk_end",
  });

  // Return legs
  if (selectedReturn) {
    for (const leg of selectedReturn.legs) {
      if (leg.mode === "TRANSIT") {
        timeline.push({
          time: formatTime(leg.departureTime),
          label: `${leg.departureStop ?? returnOrigin} → ${leg.arrivalStop ?? returnDest}`,
          type: "transit",
          transitDetail: {
            lineName: leg.lineName,
            agencyName: leg.agencyName,
            vehicleType: leg.vehicleType,
          },
        });
      }
    }

    timeline.push({
      time: formatTime(selectedReturn.arrivalTime),
      label: `Arrive at ${returnDest}`,
      type: "arrive",
    });
  }

  // Sunset margin from walk finish
  const sunsetMarginMinutes = Math.round(
    (sunset.getTime() - latestFinish.getTime()) / (60 * 1000),
  );

  return {
    sunset: formatTime(sunset),
    sunsetISO: sunset.toISOString(),
    timeline,
    sunsetMarginMinutes,
    warnings,
  };
}
