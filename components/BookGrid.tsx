import Link from "next/link";
import { getBookLanguages, getDefaultBookLanguage, type BookMeta } from "@/lib/books";
import { bookDir } from "@/lib/rtl";
import styles from "./BookGrid.module.css";

interface BookGridProps {
  books: BookMeta[];
}

/**
 * The catalog grid -- used by the homepage (app/page.tsx). Kept as its own
 * component (rather than inlined) so it isn't duplicated if another page
 * ever needs the same catalog listing.
 *
 * Each card links straight to the book's default-language issue page
 * (/books/<slug>/<lang>) rather than the bare /books/<slug> redirect, so a
 * click from the grid never pays for an extra hop.
 */
export default function BookGrid({ books }: BookGridProps) {
  if (books.length === 0) {
    return (
      <p className={styles.empty}>
        No books yet — add a Markdown file to content/books/&lt;slug&gt;/&lt;lang&gt;.md.
      </p>
    );
  }

  return (
    <div className={styles.grid}>
      {books.map((book) => {
        const languages = getBookLanguages(book.slug);
        const defaultLang = getDefaultBookLanguage(book.slug);
        if (!defaultLang) return null;

        return (
          <Link
            key={book.slug}
            href={`/books/${book.slug}/${defaultLang}`}
            className={styles.card}
            dir={bookDir(book.language)}
          >
            <span className={styles.cover}>
              {book.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- book
                // covers are arbitrary CMS-provided paths, not build-time
                // known assets, so next/image's static optimization doesn't
                // apply here.
                <img src={book.coverImage} alt="" className={styles.coverImage} />
              ) : (
                <span className={styles.coverPlate}>
                  <span className={styles.coverTitle}>{book.title}</span>
                </span>
              )}
            </span>
            <span className={styles.body}>
              <span className={styles.title}>{book.title}</span>
              <span className={styles.author}>
                {book.author}
                {book.publishedYear ? ` · ${book.publishedYear}` : ""}
              </span>
              {book.excerpt && <span className={styles.excerpt}>{book.excerpt}</span>}
              {languages.length > 0 && (
                <span className={styles.langs}>
                  {languages.map((lang) => (
                    <span
                      key={lang}
                      className={`${styles.langChip} ${lang === defaultLang ? styles.langChipCurrent : ""}`}
                    >
                      {lang.toUpperCase()}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
