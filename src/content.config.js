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
      trails: z.array(reference("trails")).optional(),
      tags: z.array(reference("tags")).optional(),
      length: z.number().optional(),
      elevation: z.number().optional(),
      duration: z.number().optional(),
      highlights: z
        .array(z.object({ name: z.string(), icon: z.string() }))
        .optional(),
    }),
});

const walkGeoJSON = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/data/walks",
  }),
});

const trails = defineCollection({
  loader: glob({
    pattern: "**/*.yaml",
    base: "./src/data/trails",
    schema: z.object({
      name: z.string(),
      description: z.string(),
      length: z.number(),
    }),
  }),
});

const tags = defineCollection({
  loader: glob({
    pattern: "**/*.yaml",
    base: "./src/data/tags",
    schema: z.object({ name: z.string() }),
  }),
});

export const collections = { walks, walkGeoJSON, trails, tags };
