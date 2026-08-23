import matter from "gray-matter";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { deleteRepoFile, getRepoFile, putRepoFile } from "@/lib/github";
import { buildFrontmatter, type BookPayload } from "@/lib/adminBookPayload";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

/** Update an existing book. The slug (and so the filename) never changes here. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { slug } = await params;
  const payload = (await request.json()) as BookPayload;

  if (!payload.title?.trim() || !payload.author?.trim()) {
    return NextResponse.json({ error: "Title and author are required." }, { status: 400 });
  }

  const path = `content/books/${slug}.md`;
  const existing = await getRepoFile(path);
  if (!existing) {
    return NextResponse.json({ error: `No book found for slug "${slug}".` }, { status: 404 });
  }

  const fileContents = matter.stringify(payload.body ?? "", buildFrontmatter(slug, payload));

  await putRepoFile(
    path,
    fileContents,
    `Update "${payload.title}" (via admin, ${session.email})`,
    existing.sha,
  );

  return NextResponse.json({ slug });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { slug } = await params;
  const path = `content/books/${slug}.md`;

  const existing = await getRepoFile(path);
  if (!existing) {
    return NextResponse.json({ error: `No book found for slug "${slug}".` }, { status: 404 });
  }

  await deleteRepoFile(path, `Delete "${slug}" (via admin, ${session.email})`, existing.sha);

  return NextResponse.json({ slug });
}
