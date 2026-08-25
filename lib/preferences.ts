// SSR-safe localStorage helpers for reader preferences. Key names here
// must stay in sync with the inline bootstrap script in app/layout.tsx,
// which reads/writes the same keys before React hydrates (to avoid a
// flash of the wrong theme/text size on load).

export type Theme = "light" | "dark" | "high-contrast";

const THEME_KEY = "reader:theme";
const FONT_SCALE_KEY = "reader:font-scale";
const POSITION_KEY_PREFIX = "reader:position:";
const PAGINATION_KEY_PREFIX = "reader:pagination:";

const THEME_VALUES: Theme[] = ["light", "dark", "high-contrast"];

// Discrete steps (not free-form arithmetic) so text size always lands on
// an exact, predictable percentage -- including a true 200%, which is the
// WCAG 2.1 SC 1.4.4 (Resize Text, AA) reference point.
export const FONT_SCALE_STEPS: readonly number[] = [
  0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.75, 1.9, 2,
];
export const FONT_SCALE_DEFAULT = 1;

const isBrowser = () => typeof window !== "undefined";

export function clampFontScale(scale: number): number {
  return FONT_SCALE_STEPS.reduce(
    (closest, step) =>
      Math.abs(step - scale) < Math.abs(closest - scale) ? step : closest,
    FONT_SCALE_STEPS[0],
  );
}

export function nextFontScale(current: number): number {
  const index = FONT_SCALE_STEPS.indexOf(clampFontScale(current));
  return FONT_SCALE_STEPS[Math.min(index + 1, FONT_SCALE_STEPS.length - 1)];
}

export function previousFontScale(current: number): number {
  const index = FONT_SCALE_STEPS.indexOf(clampFontScale(current));
  return FONT_SCALE_STEPS[Math.max(index - 1, 0)];
}

export function readFontScale(): number {
  if (!isBrowser()) return FONT_SCALE_DEFAULT;
  const raw = window.localStorage.getItem(FONT_SCALE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? clampFontScale(parsed) : FONT_SCALE_DEFAULT;
}

export function writeFontScale(scale: number): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(FONT_SCALE_KEY, String(clampFontScale(scale)));
}

export function readTheme(): Theme {
  if (!isBrowser()) return "light";
  const raw = window.localStorage.getItem(THEME_KEY);
  return (THEME_VALUES as string[]).includes(raw ?? "")
    ? (raw as Theme)
    : "light";
}

export function writeTheme(theme: Theme): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(THEME_KEY, theme);
}

/** Returns the saved page index for a book, or null if none is saved. */
export function readReadingPosition(slug: string): number | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(POSITION_KEY_PREFIX + slug);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function writeReadingPosition(slug: string, page: number): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(POSITION_KEY_PREFIX + slug, String(page));
}

/** One spacer Reader.tsx's enforceChapterPageStarts() inserted before a chapter heading. */
export interface PaginationSpacerPlanEntry {
  headingId: string;
  heightPx: number;
}

/**
 * Cached result of Reader.tsx's enforceChapterPageStarts() -- the
 * round-based DOM measurement that pushes chapters onto fresh pages,
 * documented there as costing several seconds on a full-length book at
 * desktop width. That cost only actually depends on (slug, viewport
 * width, column height, content), all of which are normally unchanged
 * between visits on the same device, so the *result* is safe to reuse --
 * Reader.tsx still runs one cheap verification pass over the cached plan
 * before trusting it, and silently recomputes from scratch if anything
 * doesn't check out.
 */
export interface PaginationCacheEntry {
  width: number;
  columnHeight: number;
  contentHash: string;
  spacers: PaginationSpacerPlanEntry[];
}

export function readPaginationCache(slug: string): PaginationCacheEntry | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(PAGINATION_KEY_PREFIX + slug);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PaginationCacheEntry>;
    if (
      typeof parsed.width !== "number" ||
      typeof parsed.columnHeight !== "number" ||
      typeof parsed.contentHash !== "string" ||
      !Array.isArray(parsed.spacers)
    ) {
      return null;
    }
    return parsed as PaginationCacheEntry;
  } catch {
    // Corrupted JSON, disabled storage, etc. -- treat exactly like a miss.
    return null;
  }
}

export function writePaginationCache(slug: string, entry: PaginationCacheEntry): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PAGINATION_KEY_PREFIX + slug, JSON.stringify(entry));
  } catch {
    // Quota exceeded, private-browsing storage limits, etc. -- this cache
    // is a pure speed optimization on top of the always-correct
    // round-based algorithm, never required for correctness, so a failed
    // write just means the next visit recomputes instead of reusing.
  }
}
