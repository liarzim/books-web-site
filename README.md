# Books Web Site

A Jamstack book catalog built with Next.js (App Router), designed to deploy to Vercel with zero extra config.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **gray-matter** — parses Markdown frontmatter
- **remark** / **remark-html** — renders Markdown body to HTML
- **Decap CMS** — visual editor for the Markdown files, at `/admin`

## Content model

Each book is one Markdown file in `content/books/`, named `<slug>.md`. The **filename is the routing source of truth** — it's what `/books/<slug>` actually resolves against, even though `slug` also exists as a frontmatter field editors see in the CMS (Decap uses it only to name the file when an entry is first created; renaming it afterwards doesn't rename the file or change the live URL).

```md
---
title: "Dune"
author: "Frank Herbert"
publishedYear: 1965
coverImage: "/covers/dune.jpg"
excerpt: "A short teaser shown on the listing page."
language: "en"
slug: "dune"
toc:
  - label: "Part One"
    anchor: "part-one"
---

The Markdown body goes here, and becomes the rendered book page content.
```

`toc` is captured as data (an array of `{ label, anchor }` pairs) but isn't rendered anywhere in the UI yet — that's separate follow-up work.

Three sample books are included: `dune.md`, `the-great-gatsby.md`, `dracula.md`.

## Routes

- `/` — landing page
- `/books` — lists every book found in `content/books`
- `/books/[slug]` — reads `content/books/<slug>.md` and renders it; pre-rendered at build time for every existing slug via `generateStaticParams` (that's the Jamstack part — these pages ship as static HTML, no server needed per-request)

## Local setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploying to Vercel

Push this repo to GitHub/GitLab/Bitbucket and import it in Vercel — no configuration needed. Vercel auto-detects Next.js, runs `npm run build`, and statically serves the pre-rendered book pages.

## Adding a book

Drop a new `<slug>.md` file into `content/books/` with the frontmatter shown above, then rebuild (`npm run build`) or redeploy. It will automatically appear on `/books` and at `/books/<slug>`. Or use the CMS below instead of editing files by hand.

## Content editing via Decap CMS

`/admin` is a visual editor (Decap CMS) for the Markdown files in `content/books/`, backed by GitHub: every save becomes a commit to this repo, which triggers a normal Vercel redeploy. It needs a one-time setup before it will work:

1. **Create a GitHub OAuth App** at [github.com/settings/developers](https://github.com/settings/developers) → "New OAuth App":
   - Homepage URL: your deployed site's origin (e.g. `https://books-web-site.vercel.app`)
   - Authorization callback URL: `<that origin>/api/callback`
2. **Set environment variables** — copy `.env.example` to `.env.local` for local testing, and add the same two keys in Vercel → Project Settings → Environment Variables for production:
   - `GITHUB_OAUTH_CLIENT_ID`
   - `GITHUB_OAUTH_CLIENT_SECRET` (from the OAuth App you just created)
3. **Edit `public/admin/config.yml`** — replace the two placeholders near the top:
   - `repo:` → this repo's `owner/repo-name`
   - `base_url:` → the same deployed origin used above
4. Deploy. Anyone who opens `/admin` and has push access to the repo can sign in with GitHub and edit books through the form; anyone without repo access can authenticate but won't be able to save (GitHub itself enforces that, not this app).

Cover images uploaded through the CMS land in `public/images/books/`.
