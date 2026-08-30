import Link from "next/link";
import BookGrid from "@/components/BookGrid";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { getAllBooksMeta } from "@/lib/books";
import { i18nProps, titleCount } from "@/lib/uiLocale";
import styles from "./page.module.css";

export default function Home() {
  const books = getAllBooksMeta();
  const count = titleCount(books.length);

  return (
    <main>
      <header className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <div className={styles.wordmarkRow}>
            {/* "Books Web Site" is the site's own name -- kept identical
                across all three UI languages, so it isn't wrapped with
                i18nProps like the rest of this header. */}
            <span className={styles.kicker}>Books Web Site</span>
            <h1 className={styles.wordmark} {...i18nProps("catalogTitle")} />
            <p className={styles.subtitle} {...i18nProps("catalogSubtitle")} />
          </div>

          <div className={styles.mastheadActions}>
            <LocaleSwitcher />
            <Link href="/admin" className={styles.adminLink} {...i18nProps("adminLink")} />
          </div>
        </div>
      </header>

      <div className={styles.catalog}>
        <div className={styles.catalogHead}>
          <h2 {...i18nProps("titlesHeading")} />
          <span className={styles.catalogCount} {...count} />
        </div>

        <BookGrid books={books} />
      </div>
    </main>
  );
}
