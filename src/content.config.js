import { defineCollection, reference, z } from "astro:content";

import { glob } from "astro/loaders";

const transportLeg = z.object({
  mode: z.enum(["train", "bus", "metro"]),
  line: z.string(),
  from: z.string(),
  to: z.string(),
  operator: z.string(),
  noc: z.string().optional(),
  crs_from: z.string().optional(),
  crs_to: z.string().optional(),
  url: z.string().optional(),
});

const walks = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/walks" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    date: z.date(),
    trails: z.array(reference("trails")).optional(),
    tags: z.array(reference("tags")).optional(),
    length: z.number(),
    elevation: z.number(),
    duration: z.number(),
    highlights: z
      .array(z.object({ name: z.string(), icon: z.string() }))
      .optional(),
    peaks: z.array(reference("peaks")).optional(),
    transport: z
      .object({
        outbound: z.array(transportLeg).optional(),
        return: z.array(transportLeg).optional(),
      })
      .optional(),
  }),
});

const weather = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/data/weather" }),
  schema: z.object({
    image: z.string(),
    label: z.string(),
  }),
});

const logs = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/data/logs" }),
  schema: z.object({
    date: z.date(),
    walk: reference("walks"),
    duration: z.number(),
    temperature: z.number(),
    weather: reference("weather"),
  }),
});

const trails = defineCollection({
  loader: glob({
    pattern: "**/*.yaml",
    base: "./src/data/trails",
  }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    length: z.number(),
    completed: z.number().optional(),
  }),
});

const tags = defineCollection({
  loader: glob({
    pattern: "**/*.yaml",
    base: "./src/data/tags",
  }),
  schema: z.object({ name: z.string(), class: z.string().optional() }),
});

const peaks = defineCollection({
  loader: glob({
    pattern: "**/*.yaml",
    base: "./src/data/peaks",
  }),
  schema: z.object({
    name: z.string(),
    height: z.number(),
    collections: z.array(reference("peakCollections")).optional(),
  }),
});

const peakCollections = defineCollection({
  loader: glob({
    pattern: "**/*.yaml",
    base: "./src/data/peakCollections",
  }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
  }),
});

export const collections = {
  walks,
  trails,
  tags,
  peaks,
  peakCollections,
  logs,
  weather,
};
