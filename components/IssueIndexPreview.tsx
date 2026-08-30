import type { TocEntry } from "@/lib/books";
import { chapterCount, i18nProps, moreChaptersNote } from "@/lib/uiLocale";
import styles from "./IssueChrome.module.css";

interface IssueIndexPreviewProps {
  toc: TocEntry[] | undefined;
  previewCount?: number;
}

/**
 * A static, non-interactive teaser of the book's table of contents, shown
 * above the Reader. This is deliberately NOT a second table of contents --
 * the Reader already has its own working "Contents" jump-to-chapter panel
 * (components/Reader.tsx), which Phase 2 leaves untouched (its visual
 * polish is Phase 3's job, not this one's). This component just previews
 * the first few real chapter titles (the book's own content, in the
 * book's own language -- never touched by the UI locale) and points the
 * reader at the real one. Renders nothing for a book with no `toc` entry,
 * same as the Reader itself.
 *
 * `dir`/`data-ui-dir-root`: see the identical comment in IssueHero.tsx --
 * this box's own labels ("In this issue", the chapter count) are UI
 * chrome and must follow the UI locale's direction, not the book's.
 */
export default function IssueIndexPreview({ toc, previewCount = 4 }: IssueIndexPreviewProps) {
  if (!toc || toc.length === 0) return null;

  const preview = toc.slice(0, previewCount);
  const remaining = toc.length - preview.length;

  return (
    <div className={styles.indexBox} dir="ltr" data-ui-dir-root>
      <div className={styles.indexBoxHead}>
        <h2 {...i18nProps("inThisIssueHeading")} />
        <span className={styles.indexBoxMeta} {...chapterCount(toc.length)} />
      </div>
      <ul className={styles.indexList}>
        {preview.map((entry, i) => (
          <li key={entry.anchor}>
            <span>{entry.label}</span>
            <span className={styles.indexNum}>{String(i + 1).padStart(2, "0")}</span>
          </li>
        ))}
        {remaining > 0 && (
          <li className={styles.indexMore} {...moreChaptersNote(remaining)} />
        )}
      </ul>
    </div>
  );
}
