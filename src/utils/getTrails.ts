import { getCollection } from "astro:content";
import { getCover } from "./getImages";
import { calculateTrailProgress } from "./trailOverlap";
import fs from "node:fs/promises";
import path from "node:path";

export async function getTrails() {
  const trails = await getCollection("trails");
  const walks = await getCollection("walks");

  type TrailEntry = (typeof trails)[number];
  type WalkEntry = (typeof walks)[number];

  type TrailWithExtras = TrailEntry & {
    walks: WalkEntry[];
    latestWalkDate: Date;
    cover: any;
    trailGeojson: any;
    overlap: any;
    trailLength: number;
    completedDistance: number;
    percentComplete: number;
  };

  const trailWalkMap = new Map<string, TrailWithExtras>();
  const usedCovers = [];
  for (const trail of trails) {
    const trailId = trail.id;
    const relatedWalks = walks.filter((walk) =>
      walk.data.trails?.some((t) => t.id === trailId)
    );

    const latestWalks = relatedWalks.sort(
      (a, b) => b.data.date.getTime() - a.data.date.getTime()
    );
    const usableCover = latestWalks.find(
      (walk) => !usedCovers.includes(walk.id)
    );
    usedCovers.push(usableCover.id);
    const r2Cover = await getCover(usableCover.data.slug);

    // Load trail GeoJSON
    const trailJsonPath = path.join(
      process.cwd(),
      "src",
      "data",
      "trails",
      `${trailId}.json`
    );
    const trailGeojson = JSON.parse(await fs.readFile(trailJsonPath, "utf-8"));

    // Load walk GeoJSONs
    const walkGeojsons = await Promise.all(
      relatedWalks.map(async (walk) => {
        const walkJsonPath = path.join(
          process.cwd(),
          "src",
          "data",
          "walks",
          walk.data.slug,
          "map.json"
        );
        return JSON.parse(await fs.readFile(walkJsonPath, "utf-8"));
      })
    );

    // Calculate progress using GeoJSON-measured length for accurate percentage
    const { overlap, completedDistance, trailGeojsonLength } = calculateTrailProgress(
      trailGeojson,
      walkGeojsons
    );
    const percentComplete = Math.min(
      100,
      Math.round((completedDistance / trailGeojsonLength) * 100)
    );

    trailWalkMap.set(trailId, {
      ...trail,
      walks: relatedWalks,
      latestWalkDate: latestWalks[0].data.date,
      cover: r2Cover,
      trailGeojson,
      overlap,
      trailLength: Math.round(trailGeojsonLength),
      completedDistance,
      percentComplete,
    });
  }

  const sortedTrails = Array.from(trailWalkMap.values()).sort(
    (a, b) => b.latestWalkDate.getTime() - a.latestWalkDate.getTime()
  );
  return sortedTrails;
}
