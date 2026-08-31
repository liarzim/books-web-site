import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Reader from "@/components/Reader";
import IssueHero from "@/components/IssueHero";
import { getBookBySlug, getBookLanguages, getBookSlugs } from "@/lib/books";
import { bookDir } from "@/lib/rtl";
import styles from "@/components/IssueChrome.module.css";

type PageParams = { slug: string; lang: string };

type PageProps = {
  params: Promise<PageParams>;
};

// Pre-render every (slug, lang) combination at build time -- one static
// page per translation, so each has its own real URL, metadata, and SEO
// indexing rather than a client-side language toggle over one URL.
export async function generateStaticParams(): Promise<PageParams[]> {
  return getBookSlugs().flatMap((slug) =>
    getBookLanguages(slug).map((lang) => ({ slug, lang })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, lang } = await params;
  const book = await getBookBySlug(slug, lang);

  if (!book) {
    return { title: "Book not found" };
  }

  return {
    title: `${book.title} — Books Web Site`,
    description: book.excerpt,
  };
}

export default async function BookIssuePage({ params }: PageProps) {
  const { slug, lang } = await params;
  const book = await getBookBySlug(slug, lang);

  if (!book) {
    notFound();
  }

  const languages = getBookLanguages(slug);

  // `dir` is set on the whole article (not just the Reader's HTML) so the
  // hero (title/author) lines up correctly too, and so it's inherited by
  // everything the Reader renders via dangerouslySetInnerHTML -- the CSS
  // `direction` property inherits down the tree from a `dir` attribute.
  const dir = bookDir(book.language);

  return (
    <article dir={dir}>
      <IssueHero
        slug={slug}
        title={book.title}
        author={book.author}
        publishedYear={book.publishedYear}
        languages={languages}
        currentLang={lang}
      />

      {/* IssueIndexPreview (a standalone TOC preview box) used to live here,
          between the hero and the Reader -- it's gone now that the Reader
          has its own TOC/search side panel covering the same job, so
          keeping both meant showing the table of contents twice before a
          visitor even reached the book. */}

      {/* readerSection is deliberately its OWN wider container, not
          styles.issueBody (max-width: 880px) -- that width is right for the
          hero's title/author reading line and was right for the old
          issueBody TOC box, but it starved the flipbook of the screen width
          it actually has to work with. The hero above keeps its own
          880px-capped look; only the Reader gets the fuller-bleed
          container. */}
      <div className={styles.readerSection}>
        {/* Phase 3b: the book's pages are pre-rendered to images by an
            offline generation pipeline (not part of this build -- see
            public/book-pages/<slug>/<lang>/), and Reader fetches that
            manifest client-side rather than receiving live HTML content.
            book.contentHtml (still computed above, for metadata/other
            consumers) is intentionally NOT threaded through here anymore --
            the elaborate `children`-prop-not-string-prop technique this
            replaced existed solely to avoid double-serializing that HTML
            into the page payload, so now that Reader has no use for the
            HTML at all, the right fix is to stop computing that cost here
            rather than pass it through unused. TOC LABELS still come from
            here (book.toc, hand-authored frontmatter) -- only the
            per-chapter PAGE NUMBER comes from the generated manifest, see
            the ReaderProps.toc comment in Reader.tsx. */}
        <Reader
          slug={slug}
          lang={lang}
          dir={dir}
          toc={book.toc}
          title={book.title}
          author={book.author}
        />
      </div>
    </article>
  );
}
