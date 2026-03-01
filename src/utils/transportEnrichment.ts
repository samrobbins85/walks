import operatorData from "../data/transport-operators.json";

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

export interface EnrichedTransportLeg extends TransportLeg {
  background: string;
  foreground: string;
}

interface TransportData {
  outbound?: TransportLeg[];
  return?: TransportLeg[];
}

export interface EnrichedTransport {
  outbound?: EnrichedTransportLeg[];
  return?: EnrichedTransportLeg[];
}

const FALLBACK_BACKGROUND = "#64748b";
const FALLBACK_FOREGROUND = "#FFFFFF";

function enrichLeg(leg: TransportLeg): EnrichedTransportLeg {
  const modeKey = leg.mode;

  let opData: { background: string; foreground: string } | undefined;

  // noc is the lookup key for both bus (NOC code) and train (TOC code)
  if (leg.noc) {
    const modeOperators = operatorData[modeKey] as Record<
      string,
      { name: string; background: string; foreground: string }
    >;
    opData = modeOperators[leg.noc];
  }

  return {
    ...leg,
    background: opData?.background ?? FALLBACK_BACKGROUND,
    foreground: opData?.foreground ?? FALLBACK_FOREGROUND,
  };
}

export function enrichTransportLegs(
  transport: TransportData,
): EnrichedTransport {
  return {
    outbound: transport.outbound?.map(enrichLeg),
    return: transport.return?.map(enrichLeg),
  };
}
