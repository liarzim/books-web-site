import type { NextConfig } from "next";

// Jamstack config: pages under content/books are statically generated at
// build time via generateStaticParams (see app/books/[slug]/page.tsx), so
// they ship as static HTML with no server needed per-request. The
// app/api/auth and app/api/callback routes (Decap CMS's GitHub OAuth
// handshake) are the one part of this app that does need a server --
// Vercel runs those as serverless functions automatically, no extra config.
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Lets editors visit /admin instead of /admin/index.html.
      { source: "/admin", destination: "/admin/index.html" },
    ];
  },
};

export default nextConfig;
