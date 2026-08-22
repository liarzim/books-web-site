import Link from "next/link";
import { getAllBooksMeta } from "@/lib/books";

export default function BooksIndexPage() {
  const books = getAllBooksMeta();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <p>
        <Link href="/">&larr; Home</Link>
      </p>
      <h1>Books</h1>

      {books.length === 0 ? (
        <p>No books yet — add a Markdown file to content/books.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {books.map((book) => (
            <li
              key={book.slug}
              style={{
                padding: "1rem 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <Link href={`/books/${book.slug}`}>
                <strong>{book.title}</strong>
              </Link>
              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                {book.author}
                {book.publishedYear ? ` · ${book.publishedYear}` : ""}
              </div>
              {book.excerpt && <p>{book.excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
