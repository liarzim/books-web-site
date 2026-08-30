"use client";

import { useState } from "react";
import {
  UI_LOCALES,
  UI_LOCALE_AUTONYMS,
  applyUiLocaleToDom,
  readUiLocale,
  writeUiLocale,
  type UiLocale,
} from "@/lib/uiLocale";
import styles from "./LocaleSwitcher.module.css";

/**
 * The site UI language switcher -- lives on the homepage masthead. Picking
 * a language here swaps every translatable string on the CURRENT page
 * immediately (see applyUiLocaleToDom) and persists the choice, so it also
 * applies on the next page -- including a book's issue page, whose own
 * chrome (IssueHero, IssueIndexPreview) carries the same data-i18n
 * attributes. It does NOT touch a book's own content language: that stays
 * whatever language that book's file is actually written in.
 *
 * Initial state reads the DOM attribute the blocking bootstrap script (see
 * app/layout.tsx) already set before hydration, not a fresh localStorage
 * read -- so this never lags a tick behind what the page is actually
 * showing. That can differ from what the server rendered (English), which
 * is the expected, intentional case suppressHydrationWarning covers here,
 * the same pattern as AccessibilityBar's saved theme/text-size.
 */
export default function LocaleSwitcher() {
  const [locale, setLocale] = useState<UiLocale>(() => readUiLocale());

  const selectLocale = (next: UiLocale) => {
    if (next === locale) return;
    applyUiLocaleToDom(next);
    writeUiLocale(next);
    setLocale(next);
  };

  return (
    <div className={styles.switcher} role="group" aria-label="Site language">
      {UI_LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            className={styles.pill}
            aria-current={active ? "true" : undefined}
            suppressHydrationWarning
            onClick={() => selectLocale(option)}
          >
            {UI_LOCALE_AUTONYMS[option]}
          </button>
        );
      })}
    </div>
  );
}
