import { defineCollection, reference, z } from "astro:content";

// 2. Import loader(s)
import { glob, file } from "astro/loaders";

// 3. Define your collection(s)
const walks = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/walks" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    geojson: reference("walkGeoJSON"),
  }),
});

const walkGeoJSON = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/data/walks" }),
});

export const collections = { walks, walkGeoJSON };
