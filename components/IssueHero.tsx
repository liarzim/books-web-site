import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import { i18nProps } from "@/lib/uiLocale";
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
 * and the per-book LanguageSwitcher (translations of THIS book -- see
 * LanguageSwitcher.tsx). Not to be confused with the site UI language
 * (LocaleSwitcher, lib/uiLocale.ts): title/author are the book's own real
 * content and are never touched by the UI locale; "All books"/"Issue ·
 * Books Web Site" are chrome and do switch with it.
 *
 * `dir` is set explicitly here (not inherited) and marked
 * `data-ui-dir-root` so the UI-locale swap script can flip it -- this
 * header sits inside the surrounding <article dir={bookDir(...)}>, whose
 * direction follows the BOOK's language (Hebrew here), which must not
 * leak into this chrome when the UI locale is, say, Russian.
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
    <header className={styles.issueHero} dir="ltr" data-ui-dir-root>
      <div className={styles.issueHeroInner}>
        <Link href="/" className={styles.breadcrumb} {...i18nProps("breadcrumbAllBooks")} />

        <div className={styles.issueMetaRow}>
          <div>
            <span className={styles.issueKicker} {...i18nProps("issueKicker")} />
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
