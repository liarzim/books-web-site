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

interface ReaderProps {
  /** Pre-rendered HTML body of the book (from lib/books.ts). */
  contentHtml: string;
  /** Book slug, used as the localStorage key for the saved read position. */
  slug: string;
}

const SWIPE_THRESHOLD_PX = 50;

// useLayoutEffect warns on the server; this swaps to a no-op-safe
// useEffect there and only runs synchronously in the browser, where the
// column measurements below actually need it.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function Reader({ contentHtml, slug }: ReaderProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  const [pageWidth, setPageWidth] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);

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
  // produces. Called on mount, on content change, on resize, and once
  // images finish loading (since that changes column height/flow).
  const recalculate = useCallback(() => {
    const viewport = viewportRef.current;
    const pages = pagesRef.current;
    if (!viewport || !pages) return;

    const width = viewport.clientWidth;
    if (width === 0) return;

    setPageWidth(width);

    const pageCount = Math.max(1, Math.round(pages.scrollWidth / width));
    setTotalPages(pageCount);

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
  // sidebar toggling, etc).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
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
  // into columns, so recount once each one is ready.
  useEffect(() => {
    const images = pagesRef.current?.querySelectorAll("img") ?? [];
    const pending = Array.from(images).filter((img) => !img.complete);

    pending.forEach((img) => img.addEventListener("load", recalculate));
    return () => {
      pending.forEach((img) => img.removeEventListener("load", recalculate));
    };
  }, [recalculate, contentHtml]);

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

  // Keyboard navigation (accessibility / desktop convenience).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

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

  return (
    <div className={styles.wrapper}>
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
          style={{ transform: `translateX(-${currentPage * pageWidth}px)` }}
          // Content comes from Markdown rendered server-side in lib/books.ts.
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
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
