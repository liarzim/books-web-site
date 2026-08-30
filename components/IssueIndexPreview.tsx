import type { TocEntry } from "@/lib/books";
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
 * the first few real chapter titles and points the reader at the real one.
 * Renders nothing for a book with no `toc` entry, same as the Reader itself.
 */
export default function IssueIndexPreview({ toc, previewCount = 4 }: IssueIndexPreviewProps) {
  if (!toc || toc.length === 0) return null;

  const preview = toc.slice(0, previewCount);
  const remaining = toc.length - preview.length;

  return (
    <div className={styles.indexBox}>
      <div className={styles.indexBoxHead}>
        <h2>In this issue</h2>
        <span className={styles.indexBoxMeta}>{toc.length} chapters</span>
      </div>
      <ul className={styles.indexList}>
        {preview.map((entry, i) => (
          <li key={entry.anchor}>
            <span>{entry.label}</span>
            <span className={styles.indexNum}>{String(i + 1).padStart(2, "0")}</span>
          </li>
        ))}
        {remaining > 0 && (
          <li className={styles.indexMore}>
            + {remaining} more — open Contents below to jump to any chapter
          </li>
        )}
      </ul>
    </div>
  );
}
