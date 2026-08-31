"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import HTMLFlipBook from "react-pageflip";
import styles from "./Reader.module.css";
import { readReadingPosition, writeReadingPosition } from "@/lib/preferences";
import { readUiLocale } from "@/lib/uiLocale";
import type { TocEntry } from "@/lib/books";

interface ReaderProps {
  /** Book slug -- also the first path segment of its generated page images. */
  slug: string;
  /**
   * Language code (e.g. "he"), the second path segment of its generated
   * page images: public/book-pages/<slug>/<lang>/page-NNNN.webp plus a
   * manifest.json alongside them (see PageManifest below). Reading position
   * is namespaced by both slug AND lang -- two translations of the same
   * book paginate differently, so a saved page index from one is meaningless
   * (and could be entirely out of range) for the other.
   */
  lang: string;
  /**
   * Text direction of the book's content -- see lib/rtl.ts. react-pageflip
   * has no concept of RTL of its own (checked its README: no mention of
   * RTL/direction/Hebrew/Arabic at all), so an RTL book is rendered by
   * mirroring the WHOLE flipbook horizontally (styles.rtlFlip) and then
   * mirroring each page's image a second time (styles.rtlPage) to cancel
   * that back out for the actual picture. Net effect: page content reads
   * normally, but the book opens from the right and "next" turns pages
   * right-to-left, exactly like a physical Hebrew book -- see the
   * goNext/goPrev comment below for why this needs no other RTL-specific
   * branching anywhere else in this component.
   */
  dir?: "rtl" | "ltr";
  /**
   * Chapter table of contents (from the book's frontmatter, via
   * lib/books.ts) -- the LABELS live here, server-rendered, same as
   * before. Only the per-chapter PAGE NUMBER comes from the generated
   * manifest (PageManifest.chapterPages) instead: labels are hand-authored
   * content and stay in the single place that already owns them; page
   * numbers are a derived-from-images artifact and belong with the other
   * generated indexing data.
   */
  toc?: TocEntry[];
  title: string;
  author: string;
}

/**
 * The generated indexing data for one book+language's page images, fetched
 * client-side from public/book-pages/<slug>/<lang>/manifest.json (built by
 * the offline generation pipeline -- see the pipeline's own README/scripts,
 * not part of this repo's build). Deliberately just the parts that can only
 * come from having actually rendered the pages: how many there are, which
 * page each chapter anchor starts on, and every page's plain visible text
 * (the search feature's index -- these are images with no text layer of
 * their own, so this is what search actually matches against instead of an
 * in-image or DOM text search).
 */
interface PageManifest {
  pageCount: number;
  chapterPages: Record<string, number>;
  pageText: string[];
}

// Must match build_page_html.py's PAGE_WIDTH/PAGE_HEIGHT in the generation
// pipeline -- this is the aspect ratio react-pageflip lays pages out at,
// not a hard pixel size (size="stretch" below lets it scale within
// min/max bounds), but a mismatch here would letterbox or crop every page.
const PAGE_WIDTH = 960;
const PAGE_HEIGHT = 1360;

const ZOOM_STEPS = [1, 1.15, 1.3, 1.5] as const;

function pageImageUrl(slug: string, lang: string, index: number): string {
  return `/book-pages/${slug}/${lang}/page-${String(index).padStart(4, "0")}.webp`;
}

function manifestUrl(slug: string, lang: string): string {
  return `/book-pages/${slug}/${lang}/manifest.json`;
}

// This viewer's own chrome text (toolbar tooltips, panel headers, search
// placeholder) -- a small, local counterpart to lib/uiLocale.ts's
// site-wide dictionary rather than an extension of it. lib/uiLocale's
// live-switch mechanism (applyUiLocaleToDom) works by rewriting
// pre-rendered data-i18n-<locale> attributes on SERVER-rendered nodes; this
// entire component is client-rendered and highly dynamic (toggling panels,
// live search results), so wiring it into that same static-attribute
// mechanism would mean re-deriving most of it anyway. This reads the UI
// locale once, at mount -- consistent with the rest of the page at the
// moment the reader opens, but (unlike the rest of the site's chrome) it
// won't relabel itself live if the visitor flips the site language with
// the Reader already open; they'll see the new language next time they
// open a book. A reasonable gap, not a silent one -- worth knowing about if
// it's ever reported as surprising.
const VIEWER_STRINGS = {
  en: {
    loading: "Preparing pages…",
    notReady: "This book hasn't been prepared for the flipbook viewer yet.",
    prevPage: "Previous page",
    nextPage: "Next page",
    firstPage: "First page",
    lastPage: "Last page",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    contents: "Contents",
    thumbnails: "Thumbnails",
    search: "Search",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    close: "Close",
    searchPlaceholder: "Search this book…",
    noResults: "No matches found.",
    resultsCount: (n: number) => (n === 1 ? "1 match" : `${n} matches`),
    page: "Page",
  },
  he: {
    loading: "מכין עמודים…",
    notReady: "הספר הזה עדיין לא הוכן לתצוגת ההפיכה.",
    prevPage: "עמוד קודם",
    nextPage: "עמוד הבא",
    firstPage: "עמוד ראשון",
    lastPage: "עמוד אחרון",
    zoomOut: "הקטן",
    zoomIn: "הגדל",
    contents: "תוכן עניינים",
    thumbnails: "תמונות ממוזערות",
    search: "חיפוש",
    fullscreen: "מסך מלא",
    exitFullscreen: "צא ממסך מלא",
    close: "סגור",
    searchPlaceholder: "חיפוש בספר…",
    noResults: "לא נמצאו התאמות.",
    resultsCount: (n: number) => `${n} תוצאות`,
    page: "עמוד",
  },
  ru: {
    loading: "Подготовка страниц…",
    notReady: "Эта книга ещё не подготовлена для просмотра в виде книги.",
    prevPage: "Предыдущая страница",
    nextPage: "Следующая страница",
    firstPage: "Первая страница",
    lastPage: "Последняя страница",
    zoomOut: "Уменьшить",
    zoomIn: "Увеличить",
    contents: "Содержание",
    thumbnails: "Миниатюры",
    search: "Поиск",
    fullscreen: "Во весь экран",
    exitFullscreen: "Выйти из полноэкранного режима",
    close: "Закрыть",
    searchPlaceholder: "Поиск по книге…",
    noResults: "Совпадений не найдено.",
    resultsCount: (n: number) => `${n} совпадений`,
    page: "Стр.",
  },
} as const;

type Panel = "toc" | "thumbnails" | "search" | null;

export default function Reader({ slug, lang, dir = "ltr", toc, title, author }: ReaderProps) {
  const t = useMemo(() => VIEWER_STRINGS[readUiLocale()] ?? VIEWER_STRINGS.en, []);
  const isRtl = dir === "rtl";

  const [manifest, setManifest] = useState<PageManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const flipBookRef = useRef<HTMLFlipBook | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredPositionRef = useRef(false);
  const positionKey = `${slug}:${lang}`;

  // Load the generated manifest once per (slug, lang). A book that hasn't
  // been through the offline page-image generation pass yet has no
  // manifest.json at all -- that 404 is expected for a freshly-added book,
  // not a bug, so it's surfaced as "not ready" rather than a console error.
  useEffect(() => {
    let cancelled = false;
    setManifest(null);
    setManifestError(false);
    hasRestoredPositionRef.current = false;

    fetch(manifestUrl(slug, lang))
      .then((res) => {
        if (!res.ok) throw new Error(`manifest ${res.status}`);
        return res.json();
      })
      .then((data: PageManifest) => {
        if (!cancelled) setManifest(data);
      })
      .catch(() => {
        if (!cancelled) setManifestError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, lang]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const goToPage = useCallback((index: number) => {
    flipBookRef.current?.pageFlip().turnToPage(index);
  }, []);

  // Deliberately direction-agnostic: "next"/"prev" always mean forward/back
  // in READING order (turnToNextPage/turnToPrevPage on the underlying
  // library), regardless of dir. The library's own page index therefore
  // never needs flipping for RTL -- only which PHYSICAL button and arrow
  // key trigger which of these two does (see the JSX below and
  // handleKeyDown), and how the book is drawn (see the ReaderProps.dir
  // comment on the mirroring trick). Keeping the index itself
  // direction-agnostic is what lets TOC jumps, thumbnails, search results,
  // and the saved reading position all just be a page NUMBER, with no
  // separate RTL bookkeeping anywhere else in this component.
  const goNext = useCallback(() => flipBookRef.current?.pageFlip().flipNext(), []);
  const goPrev = useCallback(() => flipBookRef.current?.pageFlip().flipPrev(), []);

  useEffect(() => {
    if (!manifest) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
        return;
      }
      const forwardKey = isRtl ? "ArrowLeft" : "ArrowRight";
      const backwardKey = isRtl ? "ArrowRight" : "ArrowLeft";
      if (event.key === forwardKey) goNext();
      else if (event.key === backwardKey) goPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [manifest, isRtl, goNext, goPrev]);

  const handleInit = useCallback(() => {
    if (hasRestoredPositionRef.current || !manifest) return;
    hasRestoredPositionRef.current = true;
    const saved = readReadingPosition(positionKey);
    if (saved !== null && saved > 0 && saved < manifest.pageCount) {
      goToPage(saved);
    }
  }, [manifest, positionKey, goToPage]);

  const handleFlip = useCallback(
    (index: number) => {
      setCurrentPage(index);
      writeReadingPosition(positionKey, index);
    },
    [positionKey],
  );

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current.requestFullscreen().catch(() => {
        // Fullscreen can be denied by the browser/OS for reasons outside
        // this component's control (permissions policy, user gesture
        // requirements not met, etc.) -- there's nothing useful to do here
        // beyond simply not entering fullscreen.
      });
    }
  }, []);

  const togglePanel = (panel: Exclude<Panel, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const zoom = ZOOM_STEPS[zoomIndex];
  const hasToc = Boolean(toc && toc.length > 0);

  const searchResults = useMemo(() => {
    if (!manifest || searchQuery.trim().length < 2) return [];
    const needle = searchQuery.trim().toLowerCase();
    const results: { page: number; snippet: string }[] = [];
    manifest.pageText.forEach((text, index) => {
      const haystack = text.toLowerCase();
      const at = haystack.indexOf(needle);
      if (at === -1) return;
      const start = Math.max(0, at - 30);
      const end = Math.min(text.length, at + needle.length + 30);
      const snippet = `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
      results.push({ page: index, snippet });
    });
    return results.slice(0, 100);
  }, [manifest, searchQuery]);

  const handleWrapperKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Prevent arrow keys from also scrolling an ancestor page while a panel
    // input has focus (e.g. typing in the search box) -- the global
    // keydown listener above already owns page-turning.
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.stopPropagation();
    }
  };

  if (manifestError) {
    return (
      <div className={styles.notReady} dir={dir}>
        {t.notReady}
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className={styles.loading} dir={dir}>
        {t.loading}
      </div>
    );
  }

  const flipMirrorClass = isRtl ? styles.rtlFlip : "";
  const pageMirrorClass = isRtl ? styles.rtlPage : "";

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper} ${isFullscreen ? styles.wrapperFullscreen : ""}`}
      dir="ltr"
      onKeyDown={handleWrapperKeyDown}
    >
      <div className={styles.topBar}>
        <div className={styles.topBarTitle}>
          <span className={styles.topBarBook}>{title}</span>
          <span className={styles.topBarAuthor}>{author}</span>
        </div>
        <button
          type="button"
          className={styles.searchToggle}
          onClick={() => togglePanel("search")}
          aria-expanded={openPanel === "search"}
          aria-label={t.search}
        >
          <SearchIcon />
        </button>
      </div>

      <div className={styles.stage}>
        <button
          type="button"
          className={`${styles.edgeButton} ${styles.edgeButtonStart}`}
          onClick={isRtl ? goNext : goPrev}
          aria-label={isRtl ? t.nextPage : t.prevPage}
        >
          <ChevronIcon direction="start" />
        </button>

        <div className={`${styles.flipStage} ${flipMirrorClass}`} style={{ "--zoom": zoom } as CSSProperties}>
          <HTMLFlipBook
            ref={flipBookRef}
            width={PAGE_WIDTH}
            height={PAGE_HEIGHT}
            size="stretch"
            minWidth={280}
            maxWidth={1400}
            minHeight={396}
            maxHeight={1980}
            showCover
            usePortrait
            mobileScrollSupport
            drawShadow
            className={styles.flipBook}
            onFlip={(e: { data: number }) => handleFlip(e.data)}
            onInit={handleInit}
          >
            {Array.from({ length: manifest.pageCount }, (_, index) => (
              <div key={index} className={styles.page}>
                <img
                  src={pageImageUrl(slug, lang, index)}
                  alt=""
                  className={`${styles.pageImage} ${pageMirrorClass}`}
                  loading={index < 4 ? "eager" : "lazy"}
                  draggable={false}
                />
              </div>
            ))}
          </HTMLFlipBook>
        </div>

        <button
          type="button"
          className={`${styles.edgeButton} ${styles.edgeButtonEnd}`}
          onClick={isRtl ? goPrev : goNext}
          aria-label={isRtl ? t.prevPage : t.nextPage}
        >
          <ChevronIcon direction="end" />
        </button>
      </div>

      {openPanel === "toc" && hasToc && (
        <SidePanel title={t.contents} onClose={() => setOpenPanel(null)} closeLabel={t.close} dir={dir}>
          <ol className={styles.tocList}>
            {toc!.map((entry) => {
              const page = manifest.chapterPages[entry.anchor];
              return (
                <li key={entry.anchor}>
                  <button
                    type="button"
                    className={styles.tocEntry}
                    onClick={() => {
                      if (page !== undefined) goToPage(page);
                      setOpenPanel(null);
                    }}
                    aria-current={page === currentPage ? "true" : undefined}
                  >
                    <span>{entry.label}</span>
                    {page !== undefined && (
                      <span className={styles.tocPageNum}>{page + 1}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </SidePanel>
      )}

      {openPanel === "search" && (
        <SidePanel title={t.search} onClose={() => setOpenPanel(null)} closeLabel={t.close} dir={dir}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            dir={dir}
            autoFocus
          />
          {searchQuery.trim().length >= 2 && (
            <div className={styles.searchMeta}>
              {searchResults.length > 0 ? t.resultsCount(searchResults.length) : t.noResults}
            </div>
          )}
          <ul className={styles.searchResults}>
            {searchResults.map((result) => (
              <li key={result.page}>
                <button
                  type="button"
                  className={styles.searchResult}
                  onClick={() => {
                    goToPage(result.page);
                    setOpenPanel(null);
                  }}
                >
                  <span className={styles.searchResultPage}>
                    {t.page} {result.page + 1}
                  </span>
                  <span className={styles.searchResultSnippet} dir={dir}>
                    {result.snippet}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SidePanel>
      )}

      {openPanel === "thumbnails" && (
        <div className={styles.thumbSheet}>
          <div className={styles.thumbSheetHeader}>
            <span>{t.thumbnails}</span>
            <button
              type="button"
              className={styles.thumbSheetClose}
              onClick={() => setOpenPanel(null)}
              aria-label={t.close}
            >
              &times;
            </button>
          </div>
          <div className={styles.thumbGrid}>
            {Array.from({ length: manifest.pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`${styles.thumb} ${index === currentPage ? styles.thumbActive : ""}`}
                onClick={() => {
                  goToPage(index);
                  setOpenPanel(null);
                }}
              >
                <img
                  src={pageImageUrl(slug, lang, index)}
                  alt=""
                  loading="lazy"
                  draggable={false}
                />
                <span>{index + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.bottomBar}>
        <div className={styles.bottomBarGroup}>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label={t.zoomOut}
          >
            <ZoomOutIcon />
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label={t.zoomIn}
          >
            <ZoomInIcon />
          </button>
        </div>

        <div className={styles.bottomBarGroup}>
          <button
            type="button"
            onClick={() => goToPage(0)}
            disabled={currentPage === 0}
            aria-label={t.firstPage}
          >
            <ChevronIcon direction="start" double />
          </button>
          <button
            type="button"
            onClick={isRtl ? goNext : goPrev}
            disabled={currentPage === 0}
            aria-label={isRtl ? t.nextPage : t.prevPage}
          >
            <ChevronIcon direction="start" />
          </button>
          <span className={styles.pageIndicator} aria-live="polite">
            {currentPage + 1} / {manifest.pageCount}
          </span>
          <button
            type="button"
            onClick={isRtl ? goPrev : goNext}
            disabled={currentPage === manifest.pageCount - 1}
            aria-label={isRtl ? t.prevPage : t.nextPage}
          >
            <ChevronIcon direction="end" />
          </button>
          <button
            type="button"
            onClick={() => goToPage(manifest.pageCount - 1)}
            disabled={currentPage === manifest.pageCount - 1}
            aria-label={t.lastPage}
          >
            <ChevronIcon direction="end" double />
          </button>
        </div>

        <div className={styles.bottomBarGroup}>
          {hasToc && (
            <button
              type="button"
              onClick={() => togglePanel("toc")}
              aria-expanded={openPanel === "toc"}
              aria-label={t.contents}
            >
              <ListIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => togglePanel("thumbnails")}
            aria-expanded={openPanel === "thumbnails"}
            aria-label={t.thumbnails}
          >
            <GridIcon />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen}
          >
            <FullscreenIcon active={isFullscreen} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SidePanel({
  title,
  onClose,
  closeLabel,
  dir,
  children,
}: {
  title: string;
  onClose: () => void;
  closeLabel: string;
  dir: "rtl" | "ltr";
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        className={styles.panelOverlay}
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div className={styles.sidePanel} dir={dir}>
        <div className={styles.sidePanelHeader}>
          <span>{title}</span>
          <button type="button" onClick={onClose} aria-label={closeLabel}>
            &times;
          </button>
        </div>
        <div className={styles.sidePanelBody}>{children}</div>
      </div>
    </>
  );
}

// Small inline icon set -- kept local to this component rather than
// pulling in an icon library dependency for a handful of glyphs, all of
// which are simple enough to hand-write as plain SVG paths.
function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.6" />
      <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.6" />
      <line x1="6" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.6" />
      <line x1="8.5" y1="6" x2="8.5" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="6" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M7 3v3a1 1 0 0 1-1 1H3M13 3v3a1 1 0 0 0 1 1h3M7 17v-3a1 1 0 0 0-1-1H3M13 17v-3a1 1 0 0 1 1-1h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M3 7V4a1 1 0 0 1 1-1h3M17 7V4a1 1 0 0 0-1-1h-3M3 13v3a1 1 0 0 0 1 1h3M17 13v3a1 1 0 0 1-1 1h-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({
  direction,
  double = false,
}: {
  direction: "start" | "end";
  double?: boolean;
}) {
  // "start"/"end" instead of "left"/"right": the wrapper is force-rendered
  // dir="ltr" (see the Reader wrapper's own dir attribute) so the chrome
  // itself never mirrors, but which SIDE of the screen "forward" is on
  // still depends on the book's own direction -- callers pass "start" for
  // whichever button should point toward the book's own beginning.
  const points = direction === "start" ? "12,4 6,10 12,16" : "8,4 14,10 8,16";
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {double && (
        <polyline
          points={direction === "start" ? "16,4 10,10 16,16" : "4,4 10,10 4,16"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
