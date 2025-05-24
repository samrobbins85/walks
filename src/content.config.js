import { defineCollection, reference, z } from "astro:content";

// 2. Import loader(s)
import { glob } from "astro/loaders";

// 3. Define your collection(s)
const walks = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/walks" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string(),
      description: z.string(),
      geojson: reference("walkGeoJSON"),
      cover: image(),
      date: z.date(),
    }),
});

const walkGeoJSON = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/data/walks" }),
});

export const collections = { walks, walkGeoJSON };
