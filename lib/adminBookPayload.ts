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

// Language codes now double as filenames (content/books/<slug>/<lang>.md)
// AND as a segment interpolated directly into a GitHub Contents API path
// (see lib/github.ts's callers in the admin API routes) -- so, just like
// sanitizeSlug, this has to guarantee a safe, predictable string, not just
// a tidy-looking one. Stripped to lowercase ASCII letters and hyphens only
// (rules out "..", "/", and anything else path-traversal-shaped), with a
// safe default so an empty/garbage input still produces a valid file.
export function sanitizeLangCode(input: string | undefined): string {
  const cleaned = (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z-]+/g, "");

  return cleaned || "en";
}

export function buildFrontmatter(slug: string, payload: BookPayload): BookFrontmatter {
  return {
    title: payload.title,
    author: payload.author,
    language: sanitizeLangCode(payload.language),
    slug,
    ...(payload.coverImage ? { coverImage: payload.coverImage } : {}),
    ...(payload.publishedYear ? { publishedYear: payload.publishedYear } : {}),
    ...(payload.excerpt ? { excerpt: payload.excerpt } : {}),
    ...(payload.toc && payload.toc.length > 0 ? { toc: payload.toc } : {}),
  };
}
