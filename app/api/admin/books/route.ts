import matter from "gray-matter";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { getRepoFile, putRepoFile } from "@/lib/github";
import {
  buildFrontmatter,
  sanitizeLangCode,
  sanitizeSlug,
  type BookPayload,
} from "@/lib/adminBookPayload";

export const runtime = "nodejs";

/**
 * Create a book -- or, when `slug` already names an existing book, add a
 * new language translation to it. Either way this is "create a new
 * content/books/<slug>/<lang>.md file", so the same 409-on-existing-path
 * check below naturally covers both cases: uniqueness is per (slug, lang)
 * pair, not per slug alone.
 */
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const payload = (await request.json()) as BookPayload;
  const slug = sanitizeSlug(payload.slug ?? "");
  const lang = sanitizeLangCode(payload.language);

  if (!slug) {
    return NextResponse.json({ error: "A valid slug is required." }, { status: 400 });
  }
  if (!payload.title?.trim() || !payload.author?.trim()) {
    return NextResponse.json({ error: "Title and author are required." }, { status: 400 });
  }

  const path = `content/books/${slug}/${lang}.md`;

  const existing = await getRepoFile(path);
  if (existing) {
    return NextResponse.json(
      { error: `A "${lang}" translation of "${slug}" already exists.` },
      { status: 409 },
    );
  }

  const fileContents = matter.stringify(payload.body ?? "", buildFrontmatter(slug, payload));

  await putRepoFile(
    path,
    fileContents,
    `Add "${payload.title}" (${lang}, via admin, ${session.email})`,
  );

  return NextResponse.json({ slug, lang });
}
