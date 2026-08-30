import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import { getBookSource } from "@/lib/books";
import BookForm from "../../BookForm";
import styles from "../../../admin.module.css";

type PageProps = {
  params: Promise<{ slug: string; lang: string }>;
};

export default async function EditBookPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const { slug, lang } = await params;
  const book = getBookSource(slug, lang);
  if (!book) notFound();

  return (
    <main className={styles.main}>
      <h1>Edit {book.title}</h1>
      <BookForm
        mode="edit"
        initialValues={{
          slug: book.slug,
          title: book.title,
          author: book.author ?? "",
          language: book.language ?? "en",
          coverImage: book.coverImage ?? "",
          publishedYear: book.publishedYear ? String(book.publishedYear) : "",
          excerpt: book.excerpt ?? "",
          toc: book.toc ?? [],
          body: book.rawBody,
        }}
      />
    </main>
  );
}
