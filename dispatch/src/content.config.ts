// Content collections. One markdown file per issue in src/content/issues/,
// named by publish date (2026-08-26.md) — the filename is the URL slug.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const issues = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/issues' }),
  schema: z.object({
    /** Issue number, shown in the issue bar ("Issue 12"). */
    number: z.number().int().positive(),
    /** Publish date (YYYY-MM-DD). Formatted in UTC so the day never shifts. */
    date: z.coerce.date(),
    /** Headline for the archive list, RSS, and <title>. */
    title: z.string(),
    /** One-sentence summary for RSS and meta description. */
    summary: z.string().optional(),
    /** Stations for the live conditions strip, in display order. */
    stations: z
      .array(z.object({ id: z.union([z.string(), z.number()]).transform(String), name: z.string() }))
      .default([]),
    /** Drafts build locally but are skipped in production. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { issues };
