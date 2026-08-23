import type { BookFrontmatter } from "@/lib/books";

// Shared between the create and update admin API routes, so the two
// never drift apart on what a valid book payload looks like.

export interface BookPayload {
  slug?: string;
  title: string;
  author: string;
  language?: string;
  coverImage?: string;
  publishedYear?: number;
  excerpt?: string;
  toc?: { label: string; anchor: string }[];
  body: string;
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildFrontmatter(slug: string, payload: BookPayload): BookFrontmatter {
  return {
    title: payload.title,
    author: payload.author,
    language: payload.language || "en",
    slug,
    ...(payload.coverImage ? { coverImage: payload.coverImage } : {}),
    ...(payload.publishedYear ? { publishedYear: payload.publishedYear } : {}),
    ...(payload.excerpt ? { excerpt: payload.excerpt } : {}),
    ...(payload.toc && payload.toc.length > 0 ? { toc: payload.toc } : {}),
  };
}
