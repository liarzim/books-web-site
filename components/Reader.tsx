"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import styles from "./Reader.module.css";
import { readReadingPosition, writeReadingPosition } from "@/lib/preferences";
import type { TocEntry } from "@/lib/books";

interface ReaderProps {
  /** Pre-rendered HTML body of the book (from lib/books.ts). */
  contentHtml: string;
  /** Book slug, used as the localStorage key for the saved read position. */
  slug: string;
  /**
   * Text direction of the book's content -- see lib/rtl.ts. This isn't
   * just cosmetic: CSS multi-column layout overflows to the RIGHT
   * (increasing x) for `direction: ltr` content but to the LEFT
   * (decreasing x) for `direction: rtl` content, since that's the
   * direction the columns actually fill in. The page-turn transform below
   * has to move the opposite way to match, or every page past the first
   * lands on empty overflow space instead of the next column of text.
   */
  dir?: "rtl" | "ltr";
  /**
   * Chapter table of contents (from the book's frontmatter). Each entry's
   * `anchor` must match an `id="..."` stamped onto the corresponding
   * chapter heading by lib/books.ts (injectHeadingIds), which is how the
   * jump-to-chapter panel below finds where each chapter actually landed.
   */
  toc?: TocEntry[];
}

const SWIPE_THRESHOLD_PX = 50;

// Marks a spacer element inserted by enforceChapterPageStarts, so a later
// call can find and remove its own previous work before recomputing.
const CHAPTER_SPACER_ATTR = "data-chapter-spacer";

// Safety cap on how many correction rounds enforceChapterPageStarts will
// run (see that function). Empirically a 59-chapter/~1000-page book
// converges in 4-5 rounds; this just bounds the worst case so a
// pathological document can't loop indefinitely.
const MAX_CHAPTER_SPACER_ROUNDS = 8;

/**
 * Makes every chapter start at the top of a fresh virtual page, instead of
 * wherever it happens to land after the previous chapter's last paragraph.
 *
 * The obvious tool for this is CSS's `break-before: column` on each
 * chapter heading -- and Reader.module.css tried exactly that first. It is
 * NOT reliable here: verified empirically against the full real book (59
 * chapters, ~1000 virtual pages), Chromium's multicol fragmentation
 * silently drops most forced breaks once a document reaches that scale, in
 * a way that depends on exactly what content happens to precede each one
 * -- every break-before/-after variant tried (including the legacy
 * `page-break-before` and `-webkit-column-break-before` aliases) left the
 * majority of chapters starting mid-page. This does the same job from JS
 * instead, which is reliable regardless of surrounding content: measure
 * how far into its current column each chapter heading actually landed,
 * and insert a spacer sized to exactly consume the rest of that column so
 * the heading overflows into a fresh one.
 *
 * Inserting a spacer before chapter N shifts every chapter after it too,
 * so one pass isn't enough -- chapter N+1 may only need a spacer once N's
 * has already been inserted. This iterates in rounds instead of correcting
 * one heading at a time: within a round, every heading's offsetTop is read
 * BEFORE any spacer is written for that round (a batched read), and then
 * every needed spacer is inserted with no reads in between (a batched
 * write). Interleaving a read after each individual write -- i.e. doing
 * this heading-by-heading -- forces a full-document layout reflow per
 * heading, which measured over 11 SECONDS on this book; batching each
 * round down to a single reflow (one for the round's reads, implicitly one
 * more triggered by the next round's reads) brought that under a second.
 */
function enforceChapterPageStarts(pages: HTMLElement) {
  const columnHeight = pages.clientHeight;
  if (!columnHeight) return;

  pages.querySelectorAll(`[${CHAPTER_SPACER_ATTR}]`).forEach((el) => el.remove());

  for (let round = 0; round < MAX_CHAPTER_SPACER_ROUNDS; round += 1) {
    const headings = Array.from(
      pages.querySelectorAll<HTMLElement>('h1[id^="chapter-"]'),
    );
    // Batched read.
    const offsets = headings.map((heading) => heading.offsetTop);

    // Batched write.
    let insertedAny = false;
    headings.forEach((heading, i) => {
      const offset = offsets[i];
      if (offset > 1 && offset < columnHeight) {
        const spacer = document.createElement("div");
        spacer.setAttribute(CHAPTER_SPACER_ATTR, "true");
        spacer.setAttribute("aria-hidden", "true");
        spacer.style.height = `${columnHeight - offset}px`;
        heading.parentNode?.insertBefore(spacer, heading);
        insertedAny = true;
      }
    });

    if (!insertedAny) break;
  }
}

// How long the transient page-turn "flip flair" animation runs. Kept in
// one place since both the CSS keyframes (Reader.module.css) and the JS
// class-removal timer below need to agree on it.
const FLIP_ANIMATION_MS = 320;

// useLayoutEffect warns on the server; this swaps to a no-op-safe
// useEffect there and only runs synchronously in the browser, where the
// column measurements below actually need it.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function Reader({
  contentHtml,
  slug,
  dir = "ltr",
  toc,
}: ReaderProps) {
  // See the ReaderProps.dir comment: RTL columns overflow leftward, so the
  // sign of the page-turn transform has to flip to follow them there.
  const pageAxisSign = dir === "rtl" ? 1 : -1;

  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  const [pageWidth, setPageWidth] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);

  // Maps a chapter's TOC anchor to the (0-based) virtual page it starts
  // on, so the TOC panel can jump straight there. Recomputed alongside
  // pagination in recalculate().
  const [chapterPages, setChapterPages] = useState<Record<string, number>>({});
  const [isTocOpen, setIsTocOpen] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  // Guards the one-time restore of a saved reading position, so later
  // recalculations (resize, etc.) only clamp the current page instead of
  // re-applying the saved one over wherever the reader actually is.
  const hasRestoredPositionRef = useRef(false);

  // Next.js can reuse this component instance when navigating between two
  // book pages (same route pattern), so slug changing is the signal to
  // treat it as a fresh book rather than relying on remount.
  const previousSlugRef = useRef(slug);

  // Re-measure how many virtual pages the current content + column layout
  // produces. Called on mount, on content change, on resize (width only --
  // see the ResizeObserver below), and once images finish loading (since
  // that changes column height/flow).
  const recalculate = useCallback(() => {
    const viewport = viewportRef.current;
    const pages = pagesRef.current;
    if (!viewport || !pages) return;

    const width = viewport.clientWidth;
    if (width === 0) return;

    // Must run before any of the measurements below: it mutates the DOM
    // (inserting/removing spacers), and every measurement here -- page
    // count, chapter positions -- needs to reflect the corrected layout,
    // not the pre-correction one. See enforceChapterPageStarts for why
    // this can't just be a CSS rule.
    enforceChapterPageStarts(pages);

    setPageWidth(width);

    const pageCount = Math.max(1, Math.round(pages.scrollWidth / width));
    setTotalPages(pageCount);

    // Locate each chapter heading's virtual page. `offsetLeft` is measured
    // relative to the (non-scrolling) `pages` column box and is unaffected
    // by whatever `transform` is currently applied to it, so this doesn't
    // need to touch `currentPage` at all. It IS affected by reading
    // direction though: LTR columns overflow rightward, so a heading N
    // pages in sits at offsetLeft ~= N * width (positive). RTL columns
    // overflow leftward, so the same heading sits at offsetLeft
    // ~= -N * width (negative). Taking the absolute value normalizes both
    // cases back to the same positive 0-based page index.
    const headings = pages.querySelectorAll<HTMLElement>('[id^="chapter-"]');
    const positions: Record<string, number> = {};
    headings.forEach((heading) => {
      const pageIndex = Math.round(Math.abs(heading.offsetLeft) / width);
      positions[heading.id] = Math.min(Math.max(pageIndex, 0), pageCount - 1);
    });
    setChapterPages(positions);

    if (!hasRestoredPositionRef.current) {
      hasRestoredPositionRef.current = true;
      const savedPage = readReadingPosition(slug);
      setCurrentPage(
        savedPage !== null ? Math.min(Math.max(savedPage, 0), pageCount - 1) : 0,
      );
    } else {
      setCurrentPage((prev) => Math.min(prev, pageCount - 1));
    }
  }, [slug]);

  useIsomorphicLayoutEffect(() => {
    if (previousSlugRef.current !== slug) {
      previousSlugRef.current = slug;
      hasRestoredPositionRef.current = false;
    }
    recalculate();
  }, [recalculate, contentHtml, slug]);

  // Persist the reading position once it's been restored (so this never
  // overwrites the saved page with 0 before the restore above runs).
  useEffect(() => {
    if (!hasRestoredPositionRef.current) return;
    writeReadingPosition(slug, currentPage);
  }, [slug, currentPage]);

  // Recalculate on viewport resize (orientation change, window resize,
  // sidebar toggling, etc) -- but only when the WIDTH actually changes.
  // recalculate() re-measures `pages.scrollWidth` over the entire book's
  // multi-column layout, which for a long book is many thousands of DOM
  // nodes wide -- not free. Mobile browsers fire ResizeObserver on their
  // own viewport just from the URL bar showing/hiding as the page is
  // scrolled or touched, which changes only the HEIGHT, not the width,
  // and doesn't require re-pagination at all (column height is fixed via
  // --reader-height, and column-fill: auto already reflows within that).
  // Reacting to those height-only events was the main remaining cause of
  // "it takes a long time to move between pages" -- every scroll on
  // mobile was silently triggering a full recount.
  const lastObservedWidthRef = useRef<number | null>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const width = entry.contentRect.width;
      if (lastObservedWidthRef.current === width) return;
      lastObservedWidthRef.current = width;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recalculate);
    });
    observer.observe(viewport);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [recalculate]);

  // Images loading in after initial layout can change how content flows
  // into columns, so recount once each one is ready. Debounced: a book's
  // images tend to finish loading in a burst right after mount, and
  // recalculate() is no longer cheap now that it also re-runs
  // enforceChapterPageStarts -- reacting to each image individually would
  // mean paying that cost once per image instead of once for the whole
  // burst.
  useEffect(() => {
    const images = pagesRef.current?.querySelectorAll("img") ?? [];
    const pending = Array.from(images).filter((img) => !img.complete);
    if (pending.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRecalculate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recalculate, 200);
    };

    pending.forEach((img) => img.addEventListener("load", scheduleRecalculate));
    return () => {
      if (timer) clearTimeout(timer);
      pending.forEach((img) => img.removeEventListener("load", scheduleRecalculate));
    };
  }, [recalculate, contentHtml]);

  // Brief "flip flair" on every page turn: a transient class (see
  // Reader.module.css's .turning / @keyframes pageFlipFlair) applies a
  // quick rotateY tilt + scale + brightness dip to the viewport, layered
  // on top of (not replacing) the existing translateX slide on .pages.
  // Keeping it on a separate element/property than the positioning
  // transform means it can never fight with or delay the actual page
  // positioning -- it's purely decorative and self-cleans on a timer.
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstPageRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstPageRenderRef.current) {
      // Don't play the flip animation on initial mount / restored position.
      isFirstPageRenderRef.current = false;
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) return;

    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);

    viewport.classList.remove(styles.turning);
    // Force a reflow so re-adding the class restarts the animation even
    // if the previous turn's animation is still finishing.
    void viewport.offsetWidth;
    viewport.classList.add(styles.turning);

    flipTimeoutRef.current = setTimeout(() => {
      viewport.classList.remove(styles.turning);
    }, FLIP_ANIMATION_MS);

    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    };
  }, [currentPage]);

  const goToPage = useCallback(
    (index: number) => {
      setCurrentPage(Math.min(Math.max(index, 0), totalPages - 1));
    },
    [totalPages],
  );

  const goNext = useCallback(
    () => goToPage(currentPage + 1),
    [currentPage, goToPage],
  );
  const goPrev = useCallback(
    () => goToPage(currentPage - 1),
    [currentPage, goToPage],
  );

  const jumpToChapter = useCallback(
    (anchor: string) => {
      const pageIndex = chapterPages[anchor];
      if (pageIndex !== undefined) goToPage(pageIndex);
      setIsTocOpen(false);
    },
    [chapterPages, goToPage],
  );

  // Keyboard navigation (accessibility / desktop convenience).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isTocOpen) {
        setIsTocOpen(false);
        return;
      }
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, isTocOpen]);

  // Click navigation: tap/click the left edge to go back, the right edge
  // to go forward -- the standard e-reader convention.
  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const { left, width } = viewport.getBoundingClientRect();
    const clickX = event.clientX - left;

    if (clickX < width * 0.3) {
      goPrev();
    } else if (clickX > width * 0.7) {
      goNext();
    }
  };

  // Swipe navigation.
  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = event.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;

    if (touchDeltaX.current > SWIPE_THRESHOLD_PX) {
      goPrev();
    } else if (touchDeltaX.current < -SWIPE_THRESHOLD_PX) {
      goNext();
    }

    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  const hasToc = Boolean(toc && toc.length > 0);

  return (
    <div className={styles.wrapper}>
      {hasToc && (
        <div className={styles.tocBar}>
          <button
            type="button"
            className={styles.tocToggle}
            onClick={() => setIsTocOpen((open) => !open)}
            aria-expanded={isTocOpen}
            aria-controls="reader-toc-panel"
          >
            Contents
          </button>
        </div>
      )}

      <div className={styles.readerRow}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            ref={pagesRef}
            className={styles.pages}
            style={{ transform: `translateX(${pageAxisSign * currentPage * pageWidth}px)` }}
            // Content comes from Markdown rendered server-side in lib/books.ts.
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>

        {hasToc && (
          <>
            {isTocOpen && (
              <button
                type="button"
                aria-label="Close table of contents"
                className={styles.tocOverlay}
                onClick={() => setIsTocOpen(false)}
              />
            )}
            <nav
              id="reader-toc-panel"
              className={`${styles.tocPanel} ${isTocOpen ? styles.tocPanelOpen : ""}`}
              aria-label="Table of contents"
              dir={dir}
            >
              <ol className={styles.tocList}>
                {toc!.map((entry) => (
                  <li key={entry.anchor}>
                    <button
                      type="button"
                      className={styles.tocEntry}
                      onClick={() => jumpToChapter(entry.anchor)}
                      aria-current={
                        chapterPages[entry.anchor] === currentPage ? "true" : undefined
                      }
                    >
                      {entry.label}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </>
        )}
      </div>

      <div className={styles.controls} role="group" aria-label="Page navigation">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentPage === 0}
          aria-label="Previous page"
        >
          &larr;
        </button>
        <span className={styles.pageIndicator} aria-live="polite">
          {currentPage + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={currentPage === totalPages - 1}
          aria-label="Next page"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}
