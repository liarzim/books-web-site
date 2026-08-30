import Link from "next/link";
import { getAdminSession } from "@/lib/adminAuth";
import { getAllBooksMeta, getBookLanguages } from "@/lib/books";
import DeleteBookButton from "./DeleteBookButton";
import styles from "./admin.module.css";

export default async function AdminPage() {
  const session = await getAdminSession();

  if (!session) {
    return (
      <main className={styles.centered}>
        <h1>Admin sign-in</h1>
        <p className={styles.subtitle}>
          Sign in with an approved Google account to edit books.
        </p>
        <a href="/api/admin/auth" className={styles.signInButton}>
          Sign in with Google
        </a>
      </main>
    );
  }

  const books = getAllBooksMeta();

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <div>
          <h1>Admin</h1>
          <p className={styles.subtitle}>
            Signed in as {session.email} ({session.role})
          </p>
        </div>
        <div className={styles.headerActions}>
          {session.role === "admin" && (
            <Link href="/admin/members" className={styles.secondaryButton}>
              Manage members
            </Link>
          )}
          <form action="/api/admin/logout" method="POST">
            <button type="submit" className={styles.secondaryButton}>
              Sign out
            </button>
          </form>
        </div>
      </div>

      <Link href="/admin/books/new" className={styles.button}>
        + New book
      </Link>

      {books.length === 0 ? (
        <p>No books yet.</p>
      ) : (
        <ul className={styles.bookList}>
          {books.map((book) => {
            const languages = getBookLanguages(book.slug);
            return (
              <li key={book.slug} className={styles.bookRow}>
                <span>
                  {book.title}{" "}
                  <span className={styles.bookMeta}>({book.slug})</span>
                </span>
                <span className={styles.bookRowActions}>
                  {languages.map((lang) => (
                    <Link
                      key={lang}
                      href={`/admin/books/${book.slug}/${lang}`}
                      className={styles.langBadge}
                    >
                      {lang.toUpperCase()}
                    </Link>
                  ))}
                  <Link
                    href={`/admin/books/new?slug=${book.slug}`}
                    className={styles.langBadge}
                  >
                    + Translation
                  </Link>
                  <DeleteBookButton slug={book.slug} title={book.title} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
