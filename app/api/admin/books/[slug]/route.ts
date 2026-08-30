import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { deleteRepoFile, getRepoFile } from "@/lib/github";
import { getBookLanguages } from "@/lib/books";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * Delete a whole book -- every language translation it has, not just one.
 * (Deleting a single translation is PUT/DELETE .../[slug]/[lang] instead,
 * used by BookForm's in-page delete button.) This is what the admin list's
 * DeleteBookButton calls; its target URL hasn't changed, only what
 * "delete" now means underneath it.
 *
 * getBookLanguages reads from the filesystem bundled into this function at
 * deploy time (see lib/books.ts) rather than the GitHub API, since that's
 * already proven safe for admin reads elsewhere in this codebase -- the
 * actual deletes below still go through the GitHub Contents API, the only
 * thing that can actually write to the repo.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { slug } = await params;
  const languages = getBookLanguages(slug);

  if (languages.length === 0) {
    return NextResponse.json({ error: `No book found for slug "${slug}".` }, { status: 404 });
  }

  for (const lang of languages) {
    const path = `content/books/${slug}/${lang}.md`;
    const existing = await getRepoFile(path);
    if (existing) {
      await deleteRepoFile(path, `Delete "${slug}" (${lang}, via admin, ${session.email})`, existing.sha);
    }
  }

  return NextResponse.json({ slug });
}
