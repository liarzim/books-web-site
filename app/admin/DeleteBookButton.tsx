"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

interface DeleteBookButtonProps {
  slug: string;
  title: string;
}

/**
 * Delete link shown directly on the book list row -- previously the only
 * way to delete a book was to open its full edit form first (BookForm.tsx
 * has always had a delete button, just buried at the bottom of that page).
 * This calls the same DELETE /api/admin/books/[slug] route that button
 * does, so it's the identical operation, just reachable without a detour
 * through Edit.
 */
export default function DeleteBookButton({ slug, title }: DeleteBookButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/books/${slug}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Delete failed (${response.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setPending(false);
    }
  };

  return (
    <>
      <button type="button" onClick={handleDelete} disabled={pending} className={styles.deleteLink}>
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <span role="alert" className={styles.bookRowError}>
          {error}
        </span>
      )}
    </>
  );
}
