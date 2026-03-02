export interface TransitOption {
  departureTime: Date;
  arrivalTime: Date;
  legs: TransitLeg[];
}

export interface TransitLeg {
  mode: "WALK" | "TRANSIT";
  departureTime: Date;
  arrivalTime: Date;
  departureStop?: string;
  arrivalStop?: string;
  lineName?: string;
  agencyName?: string;
  headsign?: string;
  stopCount?: number;
  vehicleType?: string;
}

interface GoogleRoutesEnv {
  GOOGLE_MAPS_API_KEY: string;
}

export type Waypoint =
  | { type: "address"; address: string }
  | { type: "coords"; lat: number; lng: number };

interface ComputeRoutesResponse {
  routes?: {
    legs?: {
      startTime?: string;
      endTime?: string;
      steps?: {
        travelMode?: string;
        startTime?: string;
        endTime?: string;
        transitDetails?: {
          stopDetails?: {
            departureStop?: { name?: string };
            arrivalStop?: { name?: string };
            departureTime?: string;
            arrivalTime?: string;
          };
          transitLine?: {
            name?: string;
            nameShort?: string;
            agencies?: { name?: string }[];
            vehicle?: { type?: string };
          };
          headsign?: string;
          stopCount?: number;
        };
      }[];
    }[];
  }[];
}

function waypointToBody(wp: Waypoint) {
  if (wp.type === "address") {
    return { address: wp.address };
  }
  return {
    location: {
      latLng: { latitude: wp.lat, longitude: wp.lng },
    },
  };
}

export async function fetchTransitOptions(
  origin: Waypoint,
  destination: Waypoint,
  departureTime: Date,
  env: GoogleRoutesEnv,
): Promise<TransitOption[]> {
  const body = {
    origin: waypointToBody(origin),
    destination: waypointToBody(destination),
    travelMode: "TRANSIT",
    departureTime: departureTime.toISOString(),
    computeAlternativeRoutes: true,
  };

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask":
          "routes.legs.startTime,routes.legs.endTime,routes.legs.steps.travelMode,routes.legs.steps.startTime,routes.legs.steps.endTime,routes.legs.steps.transitDetails",
      },
      body: JSON.stringify(body),
    },
  );

  if (response.status === 429) {
    return [];
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Routes API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as ComputeRoutesResponse;
  return parseRoutesResponse(data);
}

function parseRoutesResponse(data: ComputeRoutesResponse): TransitOption[] {
  if (!data.routes) return [];

  return data.routes
    .map((route) => {
      const leg = route.legs?.[0];
      if (!leg?.startTime || !leg?.endTime) return null;

      const transitLegs: TransitLeg[] = (leg.steps ?? [])
        .filter((step) => step.startTime && step.endTime)
        .map((step) => {
          const td = step.transitDetails;
          return {
            mode: step.travelMode === "TRANSIT" ? "TRANSIT" : "WALK",
            departureTime: new Date(step.startTime!),
            arrivalTime: new Date(step.endTime!),
            departureStop: td?.stopDetails?.departureStop?.name,
            arrivalStop: td?.stopDetails?.arrivalStop?.name,
            lineName:
              td?.transitLine?.nameShort ?? td?.transitLine?.name,
            agencyName: td?.transitLine?.agencies?.[0]?.name,
            headsign: td?.headsign,
            stopCount: td?.stopCount,
            vehicleType: td?.transitLine?.vehicle?.type,
          } satisfies TransitLeg;
        });

      return {
        departureTime: new Date(leg.startTime),
        arrivalTime: new Date(leg.endTime),
        legs: transitLegs,
      } satisfies TransitOption;
    })
    .filter((opt): opt is TransitOption => opt !== null);
}
