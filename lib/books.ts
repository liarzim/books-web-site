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
   * A CMS-authored slug, used by Decap only to name the file when an entry
   * is first created (content/books/<slug>.md). It is NOT the routing
   * source of truth after that -- the filename is. See getAllBooksMeta /
   * getBookBySlug below, which always let the filename-derived slug win.
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

  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  return {
    ...(data as BookFrontmatter),
    slug,
    contentHtml,
  };
}
