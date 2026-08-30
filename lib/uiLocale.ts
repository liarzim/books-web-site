// Site UI language (chrome text: "Catalog", "Titles", "Admin", the book
// issue page's header, etc.) -- NOT to be confused with a book's own
// content language (lib/books.ts / lib/rtl.ts), which is whatever
// language that book's Markdown file is actually written in and is
// completely unaffected by this. A Hebrew UI can browse an English book
// and vice versa.
//
// Persisted the same way as the existing reader preferences (see
// lib/preferences.ts): localStorage, applied to the DOM by a blocking
// inline script in app/layout.tsx before hydration so a returning visitor
// never sees a flash of the wrong language. Unlike the theme switch
// (a pure CSS attribute flip), swapping actual text content needs actual
// text to swap TO -- see the data-i18n-<locale> attributes applied via
// i18nProps below, which every server-rendered translatable string
// carries for all three locales up front. The bootstrap script and
// applyUiLocaleToDom (used by LocaleSwitcher for a live, no-reload switch)
// both just rewrite textContent from those attributes; keep them in sync
// if either changes.

export type UiLocale = "he" | "en" | "ru";

// Display order for the language switcher, per how this was asked for.
export const UI_LOCALES: UiLocale[] = ["he", "en", "ru"];

export const DEFAULT_UI_LOCALE: UiLocale = "en";

export function isRtlUiLocale(locale: UiLocale): boolean {
  return locale === "he";
}

// Each language's own name, in its own script -- always shown as-is
// regardless of the current UI locale (the standard convention for
// language switchers: you don't translate "English" into Hebrew).
export const UI_LOCALE_AUTONYMS: Record<UiLocale, string> = {
  he: "עברית",
  en: "English",
  ru: "Русский",
};

const LOCALE_STORAGE_KEY = "ui:locale";

type UiStringKey =
  | "catalogTitle"
  | "catalogSubtitle"
  | "adminLink"
  | "titlesHeading"
  | "issueKicker"
  | "breadcrumbAllBooks"
  | "inThisIssueHeading";

const UI_STRINGS: Record<UiLocale, Record<UiStringKey, string>> = {
  en: {
    catalogTitle: "Catalog",
    catalogSubtitle: "Browse the catalog and start reading.",
    adminLink: "Admin",
    titlesHeading: "Titles",
    issueKicker: "Issue · Books Web Site",
    breadcrumbAllBooks: "← All books",
    inThisIssueHeading: "In this issue",
  },
  he: {
    catalogTitle: "קטלוג",
    catalogSubtitle: "עיינו בקטלוג והתחילו לקרוא.",
    adminLink: "ניהול",
    titlesHeading: "כותרים",
    issueKicker: "גיליון · Books Web Site",
    breadcrumbAllBooks: "← כל הספרים",
    inThisIssueHeading: "בגיליון זה",
  },
  ru: {
    catalogTitle: "Каталог",
    catalogSubtitle: "Просмотрите каталог и начните читать.",
    adminLink: "Админ",
    titlesHeading: "Книги",
    issueKicker: "Выпуск · Books Web Site",
    breadcrumbAllBooks: "← Все книги",
    inThisIssueHeading: "В этом выпуске",
  },
};

/**
 * A translatable string's value in all three locales, plus the default
 * locale's value as `text` -- what the server actually renders. Spread
 * `attrs` onto the element; put `text` as its children. See i18nProps,
 * the usual way to get both at once for a static dictionary key.
 *
 * Flat on purpose (not `{ text, attrs }`): spreading this directly onto an
 * element -- `<h1 {...i18nProps("catalogTitle")} />` -- sets both the
 * element's `children` (the default-locale text) and its three
 * `data-i18n-<locale>` attributes in one go. A nested shape would silently
 * set a meaningless `text` DOM attribute and leave the element empty
 * instead, since spreading `{ text, attrs }` onto JSX does not turn `text`
 * into `children`.
 */
type TranslatedStrings = { children: string } & Record<`data-i18n-${UiLocale}`, string>;

function toTranslated(strings: Record<UiLocale, string>): TranslatedStrings {
  return {
    children: strings[DEFAULT_UI_LOCALE],
    "data-i18n-he": strings.he,
    "data-i18n-en": strings.en,
    "data-i18n-ru": strings.ru,
  };
}

/** A static UI string, e.g. `<h1 {...i18nProps("catalogTitle")} />`. */
export function i18nProps(key: UiStringKey): TranslatedStrings {
  return toTranslated({
    he: UI_STRINGS.he[key],
    en: UI_STRINGS.en[key],
    ru: UI_STRINGS.ru[key],
  });
}

// Russian plural category for a count -- the classic "one / few / many"
// rule (e.g. 1 книга, 2 книги, 5 книг; but 11 книг, 21 книга). Hebrew and
// English only need a singular/plural split, handled inline below.
function ruPluralIndex(n: number): 0 | 1 | 2 {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 0;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 1;
  return 2;
}

/** "1 title" / "4 titles" (and Hebrew/Russian equivalents), for the catalog count. */
export function titleCount(n: number): TranslatedStrings {
  return toTranslated({
    en: n === 1 ? "1 title" : `${n} titles`,
    he: `${n} ${n === 1 ? "כותר" : "כותרים"}`,
    ru: `${n} ${["книга", "книги", "книг"][ruPluralIndex(n)]}`,
  });
}

/** "1 chapter" / "59 chapters", for the issue index preview's chapter count. */
export function chapterCount(n: number): TranslatedStrings {
  return toTranslated({
    en: n === 1 ? "1 chapter" : `${n} chapters`,
    he: `${n} ${n === 1 ? "פרק" : "פרקים"}`,
    ru: `${n} ${["глава", "главы", "глав"][ruPluralIndex(n)]}`,
  });
}

/** "+ 55 more — open Contents below to jump to any chapter". */
export function moreChaptersNote(remaining: number): TranslatedStrings {
  return toTranslated({
    en: `+ ${remaining} more — open Contents below to jump to any chapter`,
    he: `+ עוד ${remaining} — פתחו את התוכן העניינים למטה כדי לדלג לכל פרק`,
    ru: `+ ещё ${remaining} — откройте «Содержание» ниже, чтобы перейти к любой главе`,
  });
}

const isBrowser = () => typeof window !== "undefined";

export function readUiLocale(): UiLocale {
  if (!isBrowser()) return DEFAULT_UI_LOCALE;
  const raw = document.documentElement.getAttribute("data-ui-locale");
  return (UI_LOCALES as string[]).includes(raw ?? "")
    ? (raw as UiLocale)
    : DEFAULT_UI_LOCALE;
}

export function writeUiLocale(locale: UiLocale): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

/**
 * Applies a UI locale to the live DOM: direction/lang on <html>, every
 * translatable node's text (via its data-i18n-<locale> attribute -- see
 * i18nProps/titleCount/etc. above, which put one on every translatable
 * element up front), and any dir-scoped subtree that needs to resist the
 * ambient direction of the book content it happens to sit inside (see the
 * data-ui-dir-root comment in components/IssueHero.tsx). Used both by the
 * blocking bootstrap script in app/layout.tsx (as a hand-written JS
 * equivalent of this same logic, since that script can't import a TS
 * module -- keep the two in sync) on first load, and directly by
 * LocaleSwitcher for a live, no-reload switch.
 */
export function applyUiLocaleToDom(locale: UiLocale): void {
  if (!isBrowser()) return;

  document.documentElement.setAttribute("lang", locale);
  document.documentElement.setAttribute("dir", isRtlUiLocale(locale) ? "rtl" : "ltr");
  document.documentElement.setAttribute("data-ui-locale", locale);

  document.querySelectorAll<HTMLElement>(`[data-i18n-${locale}]`).forEach((el) => {
    const text = el.getAttribute(`data-i18n-${locale}`);
    if (text !== null) el.textContent = text;
  });

  document.querySelectorAll<HTMLElement>("[data-ui-dir-root]").forEach((el) => {
    el.setAttribute("dir", isRtlUiLocale(locale) ? "rtl" : "ltr");
  });
}
