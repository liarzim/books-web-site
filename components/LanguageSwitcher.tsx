import Link from "next/link";
import styles from "./IssueChrome.module.css";

interface LanguageSwitcherProps {
  slug: string;
  languages: string[];
  current: string;
}

/**
 * Links to every translation of a book, each a real static page
 * (/books/<slug>/<lang>) -- not a client-side toggle, so a switch is a
 * normal navigation with its own URL, SEO indexing, and shareable link.
 * Renders nothing when there's only one language: a switcher with a single,
 * always-active option has nothing to switch to.
 */
export default function LanguageSwitcher({ slug, languages, current }: LanguageSwitcherProps) {
  if (languages.length < 2) return null;

  return (
    <nav className={styles.langSwitcher} aria-label="Available languages">
      {languages.map((lang) => (
        <Link
          key={lang}
          href={`/books/${slug}/${lang}`}
          className={styles.langPill}
          aria-current={lang === current ? "page" : undefined}
        >
          {lang.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
