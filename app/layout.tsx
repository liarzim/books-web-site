import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Frank_Ruhl_Libre, Heebo, JetBrains_Mono } from "next/font/google";
import AccessibilityBar from "@/components/AccessibilityBar";
import "./globals.css";

// Typography for the Phase 2 "issue" redesign (homepage, catalog grid, book
// issue page) only -- exposed as CSS variables here, but never applied to
// `body` itself, so the admin panel and the Reader's own chrome (still
// system-ui, unchanged) don't inherit them. Only the components that
// explicitly reference var(--font-serif) / var(--font-sans-editorial) /
// var(--font-mono-editorial) pick these up. Both Latin and Hebrew subsets
// are loaded since the site's UI chrome is English but book titles/authors
// render in whatever language the book itself is.
const serif = Frank_Ruhl_Libre({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "700"],
  variable: "--font-serif",
  display: "swap",
});
const sansEditorial = Heebo({
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sans-editorial",
  display: "swap",
});
const monoEditorial = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-editorial",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Books Web Site",
  description: "A Jamstack book catalog built with Next.js",
};

// Keep these key names, and the locale-swap logic, in sync with
// lib/preferences.ts and lib/uiLocale.ts (applyUiLocaleToDom) respectively
// -- this hand-written copy is what makes a returning visitor's saved
// theme/text-size/UI-language apply before first paint instead of
// flashing the defaults first. Every translatable string is rendered
// server-side in the default locale (English) with its Hebrew/Russian
// text stashed in data-i18n-<locale> attributes (see lib/uiLocale.ts's
// i18nProps/titleCount/etc.) precisely so this script has real text to
// swap to without a round-trip.
const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("reader:theme");
    if (theme === "dark" || theme === "high-contrast") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    var scale = localStorage.getItem("reader:font-scale");
    if (scale) {
      document.documentElement.style.setProperty("--font-scale", scale);
    }

    var locale = localStorage.getItem("ui:locale");
    if (locale === "he" || locale === "ru") {
      document.documentElement.setAttribute("lang", locale);
      document.documentElement.setAttribute("dir", locale === "he" ? "rtl" : "ltr");
      document.documentElement.setAttribute("data-ui-locale", locale);

      var nodes = document.querySelectorAll("[data-i18n-" + locale + "]");
      for (var i = 0; i < nodes.length; i++) {
        var text = nodes[i].getAttribute("data-i18n-" + locale);
        if (text !== null) nodes[i].textContent = text;
      }

      var dirRoots = document.querySelectorAll("[data-ui-dir-root]");
      for (var j = 0; j < dirRoots.length; j++) {
        dirRoots[j].setAttribute("dir", locale === "he" ? "rtl" : "ltr");
      }
    }
  } catch (error) {
    // localStorage can throw in some privacy modes -- fall back to defaults.
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${serif.variable} ${sansEditorial.variable} ${monoEditorial.variable}`}
    >
      <body>
        {/* Runs before hydration so saved theme/text-size apply on first
            paint instead of flashing the defaults first. */}
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP_SCRIPT}
        </Script>

        {children}

        <AccessibilityBar />
      </body>
    </html>
  );
}
