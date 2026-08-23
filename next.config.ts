import type { NextConfig } from "next";

// Jamstack config: pages under content/books are statically generated at
// build time via generateStaticParams (see app/books/[slug]/page.tsx), so
// they ship as static HTML with no server needed per-request. The
// app/api/auth and app/api/callback routes (Decap CMS's GitHub OAuth
// handshake) are the one part of this app that does need a server --
// Vercel runs those as serverless functions automatically, no extra config.
const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Lets editors visit /admin instead of /admin/index.html. This must
      // be a redirect (changes the browser's actual URL), not a rewrite:
      // Decap CMS fetches "config.yml" as a path *relative to the current
      // URL*. A rewrite leaves the address bar at "/admin" (no trailing
      // slash), so that relative fetch resolves to "/config.yml" at the
      // site root -- a 404 -- instead of "/admin/config.yml".
      {
        source: "/admin",
        destination: "/admin/index.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
