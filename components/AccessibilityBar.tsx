"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import styles from "./AccessibilityBar.module.css";
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_STEPS,
  nextFontScale,
  previousFontScale,
  readFontScale,
  readTheme,
  writeFontScale,
  writeTheme,
  type Theme,
} from "@/lib/preferences";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "high-contrast", label: "High contrast" },
];

const PANEL_ID = "accessibility-panel";

export default function AccessibilityBar() {
  const [open, setOpen] = useState(false);
  const [fontScale, setFontScale] = useState(FONT_SCALE_DEFAULT);
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const themeButtonRefs = useRef<Record<Theme, HTMLButtonElement | null>>({
    light: null,
    dark: null,
    "high-contrast": null,
  });

  // A blocking <head> script (see app/layout.tsx) already applied the
  // saved theme/font-scale to <html> before first paint, to avoid a
  // flash of the wrong appearance. This just brings React's own state in
  // sync with that after mount, so the panel's controls reflect reality.
  useEffect(() => {
    setFontScale(readFontScale());
    setTheme(readTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
    writeFontScale(fontScale);
  }, [fontScale, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (theme === "light") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    writeTheme(theme);
  }, [theme, mounted]);

  // Escape closes the panel and returns focus to the button that opened it.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Clicking outside the panel closes it.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        toggleButtonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // Move focus into the panel when it opens, for keyboard/screen-reader users.
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  const increaseFontScale = () => setFontScale((prev) => nextFontScale(prev));
  const decreaseFontScale = () => setFontScale((prev) => previousFontScale(prev));
  const resetFontScale = () => setFontScale(FONT_SCALE_DEFAULT);

  const selectTheme = (value: Theme) => setTheme(value);

  // Roving-tabindex radiogroup: Tab reaches the group once, arrow keys
  // move (and select) within it -- the standard WAI-ARIA radio pattern.
  const handleThemeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const currentIndex = THEME_OPTIONS.findIndex((option) => option.value === theme);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextOption = THEME_OPTIONS[nextIndex];
      selectTheme(nextOption.value);
      themeButtonRefs.current[nextOption.value]?.focus();
    }
  };

  const fontPercent = Math.round(fontScale * 100);
  const isMinFontScale = fontScale <= FONT_SCALE_STEPS[0];
  const isMaxFontScale = fontScale >= FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1];

  return (
    <div className={styles.barWrapper}>
      {open && (
        <div
          id={PANEL_ID}
          ref={panelRef}
          role="region"
          aria-label="Reading and accessibility settings"
          className={styles.panel}
        >
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Display settings</h2>
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              onClick={() => setOpen(false)}
              aria-label="Close settings panel"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          <div className={styles.group}>
            <h3 id="font-size-label" className={styles.groupLabel}>
              Text size
            </h3>
            <div className={styles.stepper}>
              <button
                type="button"
                onClick={decreaseFontScale}
                disabled={isMinFontScale}
                aria-label="Decrease text size"
              >
                A&minus;
              </button>
              <span
                className={styles.stepperValue}
                aria-live="polite"
                aria-atomic="true"
              >
                {fontPercent}%
              </span>
              <button
                type="button"
                onClick={increaseFontScale}
                disabled={isMaxFontScale}
                aria-label="Increase text size"
              >
                A&plus;
              </button>
              <button
                type="button"
                className={styles.resetButton}
                onClick={resetFontScale}
                aria-label="Reset text size to default"
              >
                Reset
              </button>
            </div>
          </div>

          <div className={styles.group}>
            <h3 id="theme-label" className={styles.groupLabel}>
              Theme
            </h3>
            <div
              role="radiogroup"
              aria-labelledby="theme-label"
              className={styles.radiogroup}
              onKeyDown={handleThemeKeyDown}
            >
              {THEME_OPTIONS.map((option) => {
                const checked = theme === option.value;
                return (
                  <button
                    key={option.value}
                    ref={(el) => {
                      themeButtonRefs.current[option.value] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked ? 0 : -1}
                    className={styles.radioOption}
                    onClick={() => selectTheme(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className={styles.bar} role="toolbar" aria-label="Reading toolbar">
        <button
          ref={toggleButtonRef}
          type="button"
          className={styles.toggleButton}
          aria-expanded={open}
          aria-controls={PANEL_ID}
          aria-haspopup="true"
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">&#9881;</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
