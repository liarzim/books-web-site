import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Reader from "@/components/Reader";
import IssueHero from "@/components/IssueHero";
import IssueIndexPreview from "@/components/IssueIndexPreview";
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

      <div className={styles.issueBody}>
        <IssueIndexPreview toc={book.toc} />

        {/* Markdown body, parsed with gray-matter + rendered to HTML with
            remark in lib/books.ts, then paginated into virtual pages here.
            Passed as `children` (a Server Component subtree), not a string
            prop -- see the ReaderProps.children comment in Reader.tsx for
            why: a large book's HTML otherwise gets embedded twice in the
            page payload (once in the SSR'd HTML, once again in the
            RSC/Flight hydration data a "use client" component's string
            props are serialized into). The data-book-content marker is how
            Reader.tsx finds this div again from inside `.pages` once it's
            rendered as an opaque child instead of a prop it can inspect. */}
        <Reader slug={slug} dir={dir} toc={book.toc} contentHash={book.contentHash}>
          <div data-book-content dangerouslySetInnerHTML={{ __html: book.contentHtml }} />
        </Reader>
      </div>
    </article>
  );
}
