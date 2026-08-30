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

// Keep these key names in sync with lib/preferences.ts.
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
  } catch (error) {
    // localStorage can throw in some privacy modes -- fall back to defaults.
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
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
