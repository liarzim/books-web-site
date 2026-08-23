import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>Books Web Site</h1>
      <p className={styles.subtitle}>Choose how you&apos;d like to continue.</p>

      <nav className={styles.choices} aria-label="Entry points">
        <Link href="/books" className={styles.card}>
          <span className={styles.cardTitle}>Read a book</span>
          <span className={styles.cardDescription}>
            Browse the catalog and start reading
          </span>
        </Link>

        <Link href="/admin" className={styles.card}>
          <span className={styles.cardTitle}>Admin</span>
          <span className={styles.cardDescription}>
            Sign in with Google to edit books
          </span>
        </Link>
      </nav>
    </main>
  );
}
