import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    author: z.string().default('Yassine'),
    image: z.string().optional(),
  }),
});

const writeups = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writeups' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    author: z.string().default('Yassine'),
    platform: z.enum(['HackTheBox', 'TryHackMe', 'PicoCTF', 'AngstromCTF', 'Securinets', 'INShAck', 'HacklabESGI', 'Other']),
    difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Insane']).optional(),
    machine: z.string().optional(),
    category: z.string().optional(),
    points: z.number().optional(),
    image: z.string().optional(),
  }),
});

export const collections = { blog, writeups };
