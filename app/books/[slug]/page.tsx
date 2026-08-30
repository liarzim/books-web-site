import { notFound, redirect } from "next/navigation";
import { getBookSlugs, getDefaultBookLanguage } from "@/lib/books";

type PageParams = { slug: string };

type PageProps = {
  params: Promise<PageParams>;
};

// Pre-render a redirect for every book slug at build time, same as before
// Phase 2 -- this route no longer renders the book itself (see
// app/books/[slug]/[lang]/page.tsx), it just sends the reader to that
// book's default-language issue page, so a bare /books/<slug> link/bookmark
// from before this redesign keeps working.
export async function generateStaticParams(): Promise<PageParams[]> {
  return getBookSlugs().map((slug) => ({ slug }));
}

export default async function BookRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  const lang = getDefaultBookLanguage(slug);

  if (!lang) {
    notFound();
  }

  redirect(`/books/${slug}/${lang}`);
}
