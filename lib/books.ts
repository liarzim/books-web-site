import fs from "fs";
import path from "path";
import { createHash } from "crypto";
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
   * Optional short author's-note/foreword paragraph, rendered as a boxed
   * callout on the cover page itself (below title/author), not as a
   * separate page. Plain text -- HTML-escaped by buildCoverPageHtml, with
   * `\n` (blank lines in the frontmatter) turned into paragraph breaks. Most
   * books won't set this; buildCoverPageHtml simply omits the box when it's
   * absent.
   */
  introduction?: string;
  /**
   * A CMS-authored slug, used by the admin editor only to name the file
   * when a book is first created (content/books/<slug>/<lang>.md). It is
   * NOT the routing source of truth after that -- the directory name is.
   * See getAllBooksMeta / getBookBySlug below, which always let the
   * directory-derived slug win.
   */
  slug?: string;
}

export interface BookMeta extends BookFrontmatter {
  slug: string;
}

export interface Book extends BookMeta {
  contentHtml: string;
  /**
   * Short fingerprint of contentHtml, computed here (server-side) instead
   * of by the Reader client component. This is what lets Reader.tsx accept
   * pre-rendered content as `children` -- an opaque, already-rendered
   * subtree it never needs to read as a string -- while still having a
   * cheap, stable cache key for lib/preferences.ts's pagination cache
   * (which used to hash contentHtml itself on every load, requiring the
   * full string to be present on the client for that purpose alone).
   */
  contentHash: string;
}

/**
 * Every book is a directory under content/books, one Markdown file per
 * language translation inside it (content/books/<slug>/<lang>.md). This
 * lets a single book ("we") carry a Hebrew original and, later, an English
 * translation side by side without either one owning the slug.
 */
function isBookDirectory(entryName: string): boolean {
  const fullPath = path.join(booksDirectory, entryName);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
}

/**
 * All book slugs, derived from directory names in content/books.
 * Used by generateStaticParams to pre-render every book page at build time.
 */
export function getBookSlugs(): string[] {
  if (!fs.existsSync(booksDirectory)) return [];

  return fs.readdirSync(booksDirectory).filter(isBookDirectory);
}

/**
 * Language codes available for a given book slug, derived from the
 * filenames inside content/books/<slug>/ (e.g. ["he", "en"]). Sorted so
 * callers get a stable, predictable order.
 */
export function getBookLanguages(slug: string): string[] {
  const dir = path.join(booksDirectory, slug);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];

  return fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => fileName.replace(/\.md$/, ""))
    .sort();
}

/**
 * The language to show when a route doesn't specify one -- the public book
 * page (content/books/<slug>) and getAllBooksMeta's listing entry both fall
 * back to this. Prefers "he" (today's only language) if present, otherwise
 * whichever language sorts first, so a book is never unreachable just
 * because its first translation isn't Hebrew.
 */
export function getDefaultBookLanguage(slug: string): string | null {
  const languages = getBookLanguages(slug);
  if (languages.length === 0) return null;
  return languages.includes("he") ? "he" : languages[0];
}

/**
 * Resolves a (slug, lang) pair to its file path on disk. When `lang` is
 * omitted, falls back to getDefaultBookLanguage. Returns null if the book
 * or the requested language doesn't exist.
 */
function resolveBookFilePath(slug: string, lang?: string): string | null {
  const resolvedLang = lang ?? getDefaultBookLanguage(slug);
  if (!resolvedLang) return null;

  const fullPath = path.join(booksDirectory, slug, `${resolvedLang}.md`);
  return fs.existsSync(fullPath) ? fullPath : null;
}

/**
 * Frontmatter-only metadata for every book, for listing pages. One entry
 * per slug (its default-language translation), regardless of how many
 * languages that book actually has -- the listing page itself doesn't need
 * to change for Phase 1.
 */
export function getAllBooksMeta(): BookMeta[] {
  return getBookSlugs()
    .map((slug) => {
      const fullPath = resolveBookFilePath(slug);
      if (!fullPath) return null;

      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data } = matter(fileContents);

      // Spread frontmatter first, then force the directory-derived slug --
      // if a frontmatter `slug` field disagrees with the actual directory
      // name, the directory must win, since that's what routing actually
      // uses.
      return {
        ...(data as BookFrontmatter),
        slug,
      };
    })
    .filter((meta): meta is BookMeta => meta !== null)
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

  const introductionHtml = meta.introduction
    ? `<h2 style="margin:1.5rem 0 0.5rem;font-size:1.1rem;">${escapeHtml("הקדמה")}</h2>
<div style="border:1px solid var(--border);border-radius:6px;padding:1rem 1.25rem;max-width:32rem;text-align:center;">
${meta.introduction
  .split(/\n\s*\n/)
  .map((paragraph) => `<p style="margin:0 0 0.75rem;">${escapeHtml(paragraph.trim())}</p>`)
  .join("\n")}
</div>`
    : "";

  return `<div style="min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem 0;">
${coverImageHtml}
<h1 style="margin:0 0 0.5rem;">${escapeHtml(meta.title)}</h1>
<p style="color:var(--muted);margin:0;">${escapeHtml(meta.author)}${escapeHtml(yearText)}</p>
${introductionHtml}
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
 * Returns null if no Markdown file matches the given slug (and, when
 * given, language). When `lang` is omitted, resolves to the book's
 * default language -- see getDefaultBookLanguage.
 */
export async function getBookBySlug(slug: string, lang?: string): Promise<Book | null> {
  const fullPath = resolveBookFilePath(slug, lang);

  if (!fullPath) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);
  const frontmatter = data as BookFrontmatter;

  const processedContent = await remark().use(html).process(content);
  const bodyHtml = injectHeadingIds(processedContent.toString(), frontmatter.toc);
  const contentHtml = buildCoverPageHtml(frontmatter) + bodyHtml;

  // Cheap, stable fingerprint of the rendered content -- not a security
  // hash, just a short string that changes whenever contentHtml does, so
  // the client-side pagination cache (lib/preferences.ts) can key off it
  // without ever needing contentHtml itself as a client prop.
  const contentHash = createHash("sha1").update(contentHtml).digest("hex").slice(0, 16);

  return {
    ...frontmatter,
    slug,
    contentHtml,
    contentHash,
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
 * When `lang` is omitted, resolves to the book's default language.
 */
export function getBookSource(slug: string, lang?: string): BookSource | null {
  const fullPath = resolveBookFilePath(slug, lang);

  if (!fullPath) {
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
