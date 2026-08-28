import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Reader from "@/components/Reader";
import { getBookBySlug, getBookSlugs } from "@/lib/books";
import { bookDir } from "@/lib/rtl";

type PageParams = { slug: string };

type PageProps = {
  params: Promise<PageParams>;
};

// Pre-render every book page at build time from content/books/*.md —
// this is what makes the route static (Jamstack) rather than
// server-rendered on every request.
export async function generateStaticParams(): Promise<PageParams[]> {
  return getBookSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBookBySlug(slug);

  if (!book) {
    return { title: "Book not found" };
  }

  return {
    title: `${book.title} — Books Web Site`,
    description: book.excerpt,
  };
}

export default async function BookPage({ params }: PageProps) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);

  if (!book) {
    notFound();
  }

  // `dir` is set on the whole article (not just the Reader's HTML) so the
  // title and author line line up correctly too, and so it's inherited by
  // everything the Reader renders via dangerouslySetInnerHTML -- the CSS
  // `direction` property inherits down the tree from a `dir` attribute.
  const dir = bookDir(book.language);

  return (
    <article
      dir={dir}
      style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem" }}
    >
      <p>
        <Link href="/books">&larr; All books</Link>
      </p>

      <h1>{book.title}</h1>
      <p style={{ color: "var(--muted)" }}>
        {book.author}
        {book.publishedYear ? ` · ${book.publishedYear}` : ""}
      </p>

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
    </article>
  );
}
