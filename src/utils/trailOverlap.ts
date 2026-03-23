import * as turf from "@turf/turf";

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

function haversineDistance(coord1: number[], coord2: number[]): number {
  const dLat = (coord2[1] - coord1[1]) * DEG_TO_RAD;
  const dLng = (coord2[0] - coord1[0]) * DEG_TO_RAD;
  const lat1 = coord1[1] * DEG_TO_RAD;
  const lat2 = coord2[1] * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function buildSpatialGrid(coords: number[][], cellSize: number) {
  const grid = new Map<string, number[][]>();
  for (const coord of coords) {
    const key = `${Math.floor(coord[0] / cellSize)},${Math.floor(coord[1] / cellSize)}`;
    let cell = grid.get(key);
    if (!cell) {
      cell = [];
      grid.set(key, cell);
    }
    cell.push(coord);
  }
  return grid;
}

function isCloseToGrid(
  coord: number[],
  grid: Map<string, number[][]>,
  cellSize: number,
  bufferKm: number
): boolean {
  const cx = Math.floor(coord[0] / cellSize);
  const cy = Math.floor(coord[1] / cellSize);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cell = grid.get(`${cx + dx},${cy + dy}`);
      if (!cell) continue;
      for (const walkCoord of cell) {
        if (haversineDistance(coord, walkCoord) < bufferKm) return true;
      }
    }
  }
  return false;
}

function findOverlapsOnPath(
  completePathCollection,
  walksCollections,
  bufferKm = 1
) {
  // 1) Collect all walk coordinates from ALL walk collections
  const allWalkCoords: number[][] = [];
  walksCollections.forEach((coll) => {
    coll.features.forEach((f) => {
      if (!f?.geometry) return;
      const { type, coordinates } = f.geometry;
      if (type === "LineString") {
        allWalkCoords.push(...coordinates);
      } else if (type === "MultiLineString") {
        coordinates.forEach((line) => allWalkCoords.push(...line));
      } else if (type === "Point") {
        allWalkCoords.push(coordinates);
      }
    });
  });

  // Build spatial grid index (~1km cells at UK latitudes)
  const cellSize = 0.009;
  const grid = buildSpatialGrid(allWalkCoords, cellSize);

  // Helper: ensure we always iterate arrays of lines
  const asLines = (feature) => {
    const { type, coordinates } = feature.geometry;
    if (type === "LineString") return [coordinates];
    if (type === "MultiLineString") return coordinates;
    return []; // ignore other geom types
  };

  const overlaps = [];

  // 2) For each path feature, compute covered points & extract contiguous segments
  completePathCollection.features.forEach((mainFeature) => {
    if (!mainFeature?.geometry) return;
    const lines = asLines(mainFeature);
    lines.forEach((lineCoords) => {
      if (!Array.isArray(lineCoords) || lineCoords.length < 2) return;

      const covered = new Array(lineCoords.length).fill(false);

      lineCoords.forEach((mainCoord, i) => {
        if (isCloseToGrid(mainCoord, grid, cellSize, bufferKm)) {
          covered[i] = true;
        }
      });

      // Build overlap segments (contiguous covered coords)
      let current = [];
      lineCoords.forEach((coord, i) => {
        if (covered[i]) {
          current.push(coord);
        } else if (current.length >= 2) {
          overlaps.push(turf.lineString(current, mainFeature.properties || {}));
          current = [];
        } else {
          current = [];
        }
      });
      if (current.length >= 2) {
        overlaps.push(turf.lineString(current, mainFeature.properties || {}));
      }
    });
  });

  return turf.featureCollection(overlaps);
}

export function calculateTrailProgress(
  trailGeojson,
  walkGeojsons
) {
  const overlap = findOverlapsOnPath(trailGeojson, walkGeojsons);

  const trailGeojsonLength = turf.length(trailGeojson, { units: "kilometers" });

  let completedDistance = 0;
  for (const feature of overlap.features) {
    completedDistance += turf.length(feature, { units: "kilometers" });
  }

  return {
    overlap,
    completedDistance: Math.round(completedDistance),
    trailGeojsonLength,
  };
}
