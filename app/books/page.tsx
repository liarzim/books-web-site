import Link from "next/link";
import { getAllBooksMeta } from "@/lib/books";
import { bookDir } from "@/lib/rtl";

export default function BooksIndexPage() {
  const books = getAllBooksMeta();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <p>
        <Link href="/">&larr; Home</Link>
      </p>
      <h1>Books</h1>

      {books.length === 0 ? (
        <p>No books yet — add a Markdown file to content/books/&lt;slug&gt;.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {books.map((book) => (
            <li
              key={book.slug}
              dir={bookDir(book.language)}
              style={{
                display: "flex",
                gap: "1rem",
                padding: "1rem 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {book.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element -- book
                // covers are arbitrary CMS-provided paths, not build-time
                // known assets, so next/image's static optimization doesn't
                // apply here.
                <img
                  src={book.coverImage}
                  alt=""
                  width={56}
                  height={80}
                  style={{
                    width: 56,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                />
              )}
              <div>
                <Link href={`/books/${book.slug}`}>
                  <strong>{book.title}</strong>
                </Link>
                <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                  {book.author}
                  {book.publishedYear ? ` · ${book.publishedYear}` : ""}
                </div>
                {book.excerpt && <p>{book.excerpt}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
