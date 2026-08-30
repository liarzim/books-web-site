import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import BookForm from "../BookForm";
import styles from "../../admin.module.css";

type PageProps = {
  searchParams: Promise<{ slug?: string }>;
};

export default async function NewBookPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  // /admin/books/new?slug=<slug> is how the admin list links "+ Translation"
  // -- it reuses this same create page/route, just pre-filling and locking
  // the slug so the new file joins an existing book instead of starting one.
  const { slug } = await searchParams;
  const lockSlug = Boolean(slug);

  return (
    <main className={styles.main}>
      <h1>{lockSlug ? "New translation" : "New book"}</h1>
      <BookForm
        mode="create"
        lockSlug={lockSlug}
        initialValues={{
          slug: slug ?? "",
          title: "",
          author: "",
          language: "en",
          coverImage: "",
          publishedYear: "",
          excerpt: "",
          toc: [],
          body: "",
        }}
      />
    </main>
  );
}
