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

        {/* /admin is a static Decap CMS page served from public/admin, not
            a Next.js route -- a plain anchor gives it a normal full-page
            navigation instead of an App Router client transition. */}
        <a href="/admin" className={styles.card}>
          <span className={styles.cardTitle}>Admin</span>
          <span className={styles.cardDescription}>
            Sign in with GitHub to edit books
          </span>
        </a>
      </nav>
    </main>
  );
}
