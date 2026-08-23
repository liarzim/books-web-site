import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import BookForm from "../BookForm";
import styles from "../../admin.module.css";

export default async function NewBookPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  return (
    <main className={styles.main}>
      <h1>New book</h1>
      <BookForm
        mode="create"
        initialValues={{
          slug: "",
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
