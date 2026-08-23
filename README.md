# Books Web Site

A Jamstack book catalog built with Next.js (App Router), designed to deploy to Vercel with zero extra config.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **gray-matter** — parses Markdown frontmatter
- **remark** / **remark-html** — renders Markdown body to HTML
- A custom admin editor at `/admin` — Google sign-in (allowlisted), commits straight to GitHub

## Content model

Each book is one Markdown file in `content/books/`, named `<slug>.md`. The **filename is the routing source of truth** — it's what `/books/<slug>` actually resolves against, even though `slug` also exists as a frontmatter field editors see in the admin form (it's used only to name the file when a book is first created; the field is locked after that, since renaming it wouldn't rename the file or change the live URL).

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

Drop a new `<slug>.md` file into `content/books/` with the frontmatter shown above, then rebuild (`npm run build`) or redeploy. It will automatically appear on `/books` and at `/books/<slug>`. Or use the admin editor below instead of editing files by hand.

## Content editing via the admin panel

`/admin` is a custom editor for the Markdown files in `content/books/`. Editors sign in with **Google** (no GitHub account needed); saves are committed to this repo through GitHub's API using one shared, server-only credential, which then triggers a normal Vercel redeploy.

This intentionally trades away Decap CMS's polished editor (rich-text widget, drag-and-drop image upload) for something with no GitHub-account requirement for editors and no extra hosted service — the Markdown body is a plain textarea, and cover images are pasted in as a URL/path rather than uploaded through the form.

Every save is attributed to whichever Google account made it in the commit message, but the actual GitHub commit author is the shared service account — GitHub's own history won't show individual editors by username.

### Members and roles

Who can sign in, and what they can do once they're in, is controlled by `content/members.json` — a JSON file in the repo, the same place books live, editable at `/admin/members`:

```json
[
  {
    "email": "you@gmail.com",
    "role": "admin",
    "addedAt": "2026-08-23T00:00:00.000Z",
    "addedBy": "setup"
  }
]
```

Two roles:

- **admin** — everything an editor can do, plus adding, removing, and re-role-ing members at `/admin/members`.
- **editor** — create, edit, and delete books. No access to the members page.

Adding, removing, or re-roling a member is itself a commit to `members.json` (via the same GitHub API path books use), so it takes effect after the next deploy — usually under a minute on Vercel — and the affected person may need to sign out and back in to pick up a role change. The system won't let you remove or demote the last remaining admin, so you can't lock yourself out that way.

`ADMIN_ALLOWED_EMAILS` / `ADMIN_ALLOWED_DOMAIN` (below) are a separate **failsafe**, not the real member list — they're only consulted for an email that isn't in `members.json` at all, and always grant the `admin` role. Keep your own email there permanently in case `members.json` is ever empty or broken.

### One-time setup

1. **Create a Google OAuth Client** at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) → "Create Credentials" → "OAuth client ID" → Application type: Web application.
   - Authorized redirect URI: `<your deployed origin>/api/admin/auth/callback`
   - You'll also need to configure the OAuth consent screen if you haven't already (Google requires this before the client ID will work).
2. **Create a GitHub fine-grained token** at [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new), scoped to **only this repo**, with **Contents: Read and write** permission. This is the one shared credential the server uses to commit — it's never exposed to editors.
3. **Set environment variables** — copy `.env.example` to `.env.local` for local testing, and add the same keys in Vercel → Project Settings → Environment Variables for production:
   - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
   - `ADMIN_ALLOWED_EMAILS` — your own email, as the lockout failsafe described above (not the general way to add people)
   - `ADMIN_ALLOWED_DOMAIN` — optional
   - `ADMIN_SESSION_SECRET` — any long random string (the `.env.example` comment has a one-liner to generate one)
   - `GITHUB_ADMIN_TOKEN`, `GITHUB_REPO` (`owner/repo-name`), `GITHUB_BRANCH`
4. **Seed the first admin(s)** by editing `content/members.json` before your first deploy (a one-admin seed is already included in this repo — update the email, or add a second entry for a second admin). After that, admins can add more people from `/admin/members` instead of hand-editing the file.
5. Deploy. Anyone listed in `content/members.json` (or matching the failsafe) can sign in at `/admin` with their Google account.
