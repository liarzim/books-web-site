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
          remark in lib/books.ts, then paginated into virtual pages here. */}
      <Reader contentHtml={book.contentHtml} slug={slug} />
    </article>
  );
}
