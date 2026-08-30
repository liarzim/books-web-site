import { redirect } from "next/navigation";

// The catalog grid moved onto the homepage in Phase 2 (see app/page.tsx),
// so this route is now just a redirect -- kept around instead of removed
// so any existing links/bookmarks to /books still land somewhere useful.
export default function BooksIndexRedirect() {
  redirect("/");
}
