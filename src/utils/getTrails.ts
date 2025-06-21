import { getCollection } from "astro:content";

export async function getTrails() {
  const trails = await getCollection("trails");
  const walks = await getCollection("walks");

  type TrailEntry = (typeof trails)[number];
  type WalkEntry = (typeof walks)[number];

  type TrailWithExtras = TrailEntry & {
    walks: WalkEntry[];
    latestWalkDate: Date;
    cover: WalkEntry["data"]["cover"];
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

    trailWalkMap.set(trailId, {
      ...trail,
      walks: relatedWalks,
      latestWalkDate: latestWalks[0].data.date,
      cover: usableCover.data.cover,
    });
  }

  const sortedTrails = Array.from(trailWalkMap.values()).sort(
    (a, b) => b.latestWalkDate.getTime() - a.latestWalkDate.getTime()
  );
  return sortedTrails;
}
