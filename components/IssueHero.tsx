import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./IssueChrome.module.css";

interface IssueHeroProps {
  slug: string;
  title: string;
  author: string;
  publishedYear?: number;
  languages: string[];
  currentLang: string;
}

/**
 * The book "issue" header -- breadcrumb back to the catalog, title/author,
 * and the language switcher. Direction (RTL/LTR) is intentionally not set
 * here: it inherits from the `dir` attribute the page sets on the
 * surrounding <article>, same as the title/author markup did before Phase 2.
 */
export default function IssueHero({
  slug,
  title,
  author,
  publishedYear,
  languages,
  currentLang,
}: IssueHeroProps) {
  return (
    <header className={styles.issueHero}>
      <div className={styles.issueHeroInner}>
        <Link href="/" className={styles.breadcrumb}>
          &larr; All books
        </Link>

        <div className={styles.issueMetaRow}>
          <div>
            <span className={styles.issueKicker}>Issue · Books Web Site</span>
            <h1 className={styles.issueTitle}>{title}</h1>
            <p className={styles.issueAuthor}>
              {author}
              {publishedYear ? ` · ${publishedYear}` : ""}
            </p>
          </div>

          <LanguageSwitcher slug={slug} languages={languages} current={currentLang} />
        </div>
      </div>
    </header>
  );
}
