import type { NextConfig } from "next";

// Jamstack config: pages under content/books are statically generated at
// build time via generateStaticParams (see app/books/[slug]/[lang]/page.tsx
// -- app/books/[slug]/page.tsx is now just a static redirect to a book's
// default-language page), so they ship as static HTML with no server needed
// per-request. The
// app/api/admin/* routes (Google sign-in + committing edits to GitHub) are
// the part of this app that does need a server -- Vercel runs those as
// serverless functions automatically, no extra config. /admin itself is a
// normal Next.js route now, so it needs no rewrite/redirect of its own.
const nextConfig: NextConfig = {};

export default nextConfig;
