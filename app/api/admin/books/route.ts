import matter from "gray-matter";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { getRepoFile, putRepoFile } from "@/lib/github";
import { buildFrontmatter, sanitizeSlug, type BookPayload } from "@/lib/adminBookPayload";

export const runtime = "nodejs";

/** Create a new book. */
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const payload = (await request.json()) as BookPayload;
  const slug = sanitizeSlug(payload.slug ?? "");

  if (!slug) {
    return NextResponse.json({ error: "A valid slug is required." }, { status: 400 });
  }
  if (!payload.title?.trim() || !payload.author?.trim()) {
    return NextResponse.json({ error: "Title and author are required." }, { status: 400 });
  }

  const path = `content/books/${slug}.md`;

  const existing = await getRepoFile(path);
  if (existing) {
    return NextResponse.json(
      { error: `A book with slug "${slug}" already exists.` },
      { status: 409 },
    );
  }

  const fileContents = matter.stringify(payload.body ?? "", buildFrontmatter(slug, payload));

  await putRepoFile(
    path,
    fileContents,
    `Add "${payload.title}" (via admin, ${session.email})`,
  );

  return NextResponse.json({ slug });
}
