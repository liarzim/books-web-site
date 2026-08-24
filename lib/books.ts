import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

const booksDirectory = path.join(process.cwd(), "content/books");

export interface TocEntry {
  label: string;
  /** Heading id to jump to, without the leading "#". */
  anchor: string;
}

export interface BookFrontmatter {
  title: string;
  author: string;
  publishedYear?: number;
  coverImage?: string;
  excerpt?: string;
  /** BCP-47-ish language code, e.g. "en" or "he". Set via the CMS. */
  language?: string;
  toc?: TocEntry[];
  /**
   * A CMS-authored slug, used by the admin editor only to name the file
   * when a book is first created (content/books/<slug>.md). It is NOT the
   * routing source of truth after that -- the filename is. See
   * getAllBooksMeta / getBookBySlug below, which always let the
   * filename-derived slug win.
   */
  slug?: string;
}

export interface BookMeta extends BookFrontmatter {
  slug: string;
}

export interface Book extends BookMeta {
  contentHtml: string;
}

/**
 * All book slugs, derived from filenames in content/books.
 * Used by generateStaticParams to pre-render every book page at build time.
 */
export function getBookSlugs(): string[] {
  if (!fs.existsSync(booksDirectory)) return [];

  return fs
    .readdirSync(booksDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => fileName.replace(/\.md$/, ""));
}

/**
 * Frontmatter-only metadata for every book, for listing pages.
 */
export function getAllBooksMeta(): BookMeta[] {
  return getBookSlugs()
    .map((fileSlug) => {
      const fullPath = path.join(booksDirectory, `${fileSlug}.md`);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data } = matter(fileContents);

      // Spread frontmatter first, then force the filename-derived slug --
      // if a frontmatter `slug` field disagrees with the actual filename,
      // the filename must win, since that's what routing actually uses.
      return {
        ...(data as BookFrontmatter),
        slug: fileSlug,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A standalone title/cover page, prepended to the book's rendered HTML so
 * it becomes the Reader's first virtual page rather than chapter 1. Built
 * as a raw HTML string (not JSX) because it has to live inside the same
 * `contentHtml` blob the Reader paginates via CSS columns -- a page
 * rendered outside that flow (e.g. in BookPage's own JSX) can't become
 * "page 1" of the swipeable reader.
 *
 * `min-height: 100%` fills the entire first column, so chapter 1's
 * heading (the next thing in the flow) never lands in the same column as
 * the cover. Getting it onto its own PAGE too (not just column -- at
 * desktop width two columns make up one visible page) is handled by
 * Reader.tsx's enforceChapterPageStarts, the same JS mechanism that keeps
 * every other chapter off a shared page. An earlier version of this tried
 * `break-after: column` here to force that on its own; it's gone now for
 * the same reason it's gone from every chapter heading in
 * Reader.module.css -- verified empirically unreliable at real-book scale,
 * so relying on it here would just be the one CSS break-before/-after
 * spot in the codebase quietly reintroducing a bug that's fixed
 * everywhere else.
 */
function buildCoverPageHtml(meta: BookFrontmatter): string {
  const coverImageHtml = meta.coverImage
    ? `<img src="${escapeHtml(meta.coverImage)}" alt="" style="max-width:80%;max-height:45%;object-fit:contain;margin:0 auto 1.5rem;display:block;border-radius:4px;" />`
    : "";
  const yearText = meta.publishedYear ? ` · ${meta.publishedYear}` : "";

  return `<div style="min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem 0;">
${coverImageHtml}
<h1 style="margin:0 0 0.5rem;">${escapeHtml(meta.title)}</h1>
<p style="color:var(--muted);margin:0;">${escapeHtml(meta.author)}${escapeHtml(yearText)}</p>
</div>`;
}

/**
 * Stamps `id="<anchor>"` onto each top-level chapter heading (`<h1>`) in
 * the rendered body, in document order, matching them up 1:1 with the
 * frontmatter `toc` array. This is what lets the Reader jump straight to a
 * chapter: it can later find `#chapter-N` in the DOM and read its position
 * without needing the book split into separate per-chapter documents.
 *
 * A no-op (returns bodyHtml unchanged) for books with no `toc` entry, so
 * older books without a table of contents keep working exactly as before.
 */
function injectHeadingIds(bodyHtml: string, toc: TocEntry[] | undefined): string {
  if (!toc || toc.length === 0) return bodyHtml;

  let i = 0;
  return bodyHtml.replace(/<h1(?=[ >])/g, (match) => {
    const anchor = toc[i]?.anchor;
    i += 1;
    return anchor ? `<h1 id="${escapeHtml(anchor)}"` : match;
  });
}

/**
 * Full book, including frontmatter and the Markdown body rendered to HTML.
 * Returns null if no Markdown file matches the given slug.
 */
export async function getBookBySlug(slug: string): Promise<Book | null> {
  const fullPath = path.join(booksDirectory, `${slug}.md`);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);
  const frontmatter = data as BookFrontmatter;

  const processedContent = await remark().use(html).process(content);
  const bodyHtml = injectHeadingIds(processedContent.toString(), frontmatter.toc);
  const contentHtml = buildCoverPageHtml(frontmatter) + bodyHtml;

  return {
    ...frontmatter,
    slug,
    contentHtml,
  };
}

export interface BookSource extends BookMeta {
  /** Raw, unrendered Markdown body -- what the admin editor loads/saves. */
  rawBody: string;
}

/**
 * Like getBookBySlug, but returns the raw Markdown body instead of
 * rendered HTML. Used by the admin editor: editing rendered HTML would be
 * wrong, since the file on disk (and in the GitHub commit) is Markdown.
 */
export function getBookSource(slug: string): BookSource | null {
  const fullPath = path.join(booksDirectory, `${slug}.md`);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    ...(data as BookFrontmatter),
    slug,
    rawBody: content.trim(),
  };
}
