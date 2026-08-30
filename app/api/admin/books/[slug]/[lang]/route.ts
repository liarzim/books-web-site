import matter from "gray-matter";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { deleteRepoFile, getRepoFile, putRepoFile } from "@/lib/github";
import { buildFrontmatter, sanitizeLangCode, type BookPayload } from "@/lib/adminBookPayload";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string; lang: string }> };

/**
 * Update one language translation of a book. Neither the slug nor the
 * language changes here -- both are the filename (content/books/<slug>/
 * <lang>.md), so changing either would mean editing a different file, not
 * updating this one. If the payload's language disagrees with the route's
 * (which the form never lets happen, since it disables that field in edit
 * mode), the route param wins -- see sanitizeLangCode below.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { slug, lang: rawLang } = await params;
  const lang = sanitizeLangCode(rawLang);
  if (lang !== rawLang) {
    return NextResponse.json({ error: "Invalid language code." }, { status: 400 });
  }

  const payload = (await request.json()) as BookPayload;

  if (!payload.title?.trim() || !payload.author?.trim()) {
    return NextResponse.json({ error: "Title and author are required." }, { status: 400 });
  }

  const path = `content/books/${slug}/${lang}.md`;
  const existing = await getRepoFile(path);
  if (!existing) {
    return NextResponse.json(
      { error: `No "${lang}" translation found for slug "${slug}".` },
      { status: 404 },
    );
  }

  const fileContents = matter.stringify(
    payload.body ?? "",
    buildFrontmatter(slug, { ...payload, language: lang }),
  );

  await putRepoFile(
    path,
    fileContents,
    `Update "${payload.title}" (${lang}, via admin, ${session.email})`,
    existing.sha,
  );

  return NextResponse.json({ slug, lang });
}

/** Delete a single translation, leaving the book's other languages intact. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { slug, lang: rawLang } = await params;
  const lang = sanitizeLangCode(rawLang);
  if (lang !== rawLang) {
    return NextResponse.json({ error: "Invalid language code." }, { status: 400 });
  }

  const path = `content/books/${slug}/${lang}.md`;
  const existing = await getRepoFile(path);
  if (!existing) {
    return NextResponse.json(
      { error: `No "${lang}" translation found for slug "${slug}".` },
      { status: 404 },
    );
  }

  await deleteRepoFile(
    path,
    `Delete "${slug}" (${lang}, via admin, ${session.email})`,
    existing.sha,
  );

  return NextResponse.json({ slug, lang });
}
