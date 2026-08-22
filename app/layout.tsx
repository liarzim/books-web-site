import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import AccessibilityBar from "@/components/AccessibilityBar";
import "./globals.css";

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
    <html lang="en">
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
