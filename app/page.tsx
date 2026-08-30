import Link from "next/link";
import BookGrid from "@/components/BookGrid";
import { getAllBooksMeta } from "@/lib/books";
import styles from "./page.module.css";

export default function Home() {
  const books = getAllBooksMeta();

  return (
    <main>
      <header className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <div className={styles.wordmarkRow}>
            <span className={styles.kicker}>Books Web Site</span>
            <h1 className={styles.wordmark}>Catalog</h1>
            <p className={styles.subtitle}>Browse the catalog and start reading.</p>
          </div>
          <Link href="/admin" className={styles.adminLink}>
            Admin
          </Link>
        </div>
      </header>

      <div className={styles.catalog}>
        <div className={styles.catalogHead}>
          <h2>Titles</h2>
          <span className={styles.catalogCount}>
            {books.length} {books.length === 1 ? "title" : "titles"}
          </span>
        </div>

        <BookGrid books={books} />
      </div>
    </main>
  );
}
