import Link from "next/link";
import { getAdminSession } from "@/lib/adminAuth";
import { getAllBooksMeta } from "@/lib/books";
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
          {books.map((book) => (
            <li key={book.slug} className={styles.bookRow}>
              <span>
                {book.title}{" "}
                <span className={styles.bookMeta}>({book.slug})</span>
              </span>
              <Link href={`/admin/books/${book.slug}`}>Edit</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
